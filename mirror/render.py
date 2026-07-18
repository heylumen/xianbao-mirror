#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mirror/render.py — 基于 Playwright 无头浏览器的「状态化增量」整站镜像脚本
（xianbao.fun / 线报酷 适配版，仅镜像 5 个指定分类）

相比旧版的差异（迁移到增量 + 分类白名单）：
  1. 仅镜像 ALLOWED_CATEGORIES 指定的 5 个分类（含其文章页），其余页面（首页/
     其他分类/关于/免责等）一律不抓取；这些非白名单链接在镜像页内改写为
     「原站绝对地址」，点击会跳转到活站，避免 404。
  2. 源域名从 DOMAIN_POOL（6 个已验证内容一致的 HTTPS 域名）中随机轮换，
     分散单域名请求频次，增强隐蔽性。
  3. 状态化：进度写入 xianbao/.crawl-state.json 并提交仓库。
     - crawl 模式：每天每分类抓 PAGES_PER_RUN_PER_CAT 个列表页，直到各分类抓完，
       自动切换 maintenance 模式。
     - maintenance 模式：每天只检查各分类第 1 页（捕获新帖）+ 抽样复查已抓帖
       的内容哈希，仅当内容/评论变化时重存，大幅降低负载。
  4. 每篇已抓文章记录内容签名（content_signature，取正文文本哈希，隔离阅读量/
     侧边栏等易变元素），用于「只校验差异、不重复全量存储」。
  5. 渲染时生成 search.json 搜索索引 + search.html 搜索页（MiniSearch 前端检索），
     满足「站内搜索内容」的核心诉求。
  6. 资源（CSS/JS/图片）本地化保存，且已存在则跳过重复下载，减少源站压力。

依赖：playwright、beautifulsoup4
浏览器：默认自动下载的 chromium；可用环境变量覆盖（见文件末尾说明）。
"""

import os
import re
import sys
import time
import json
import ssl
import glob
import hashlib
import random
import urllib.request
from pathlib import Path
from urllib.parse import urlparse, unquote, urljoin, quote
from collections import deque

from bs4 import BeautifulSoup, Doctype, NavigableString
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
_ur = urllib.request  # 补全下载用的 urllib 别名

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
# 仅镜像这 5 个分类（slug 白名单）。分类列表页 /category-<slug>/ 与文章页
# /<slug>/<数字ID>.html 都会被收录，其余一律排除。
ALLOWED_CATEGORIES = ["zuankeba", "xinzuanba", "xiaodigu", "huluxia", "xiaodao"]

# 已验证内容完全一致的 6 个 HTTPS 域名（线报酷发布页列出）。每次运行随机选一个作
# TARGET，分散单域名请求频次。所有域名内容相同、URL 结构一致，轮换不会碎片镜像。
DOMAIN_POOL = [
    "new.xianbao.fun",
    "news.xianbao.fun",
    "new.ixbk.net",
    "news.ixbk.net",
    "new.ixbk.fun",
    "news.ixbk.fun",
]
ALL_NETLOCS = set(DOMAIN_POOL)

TARGET = os.environ.get("TARGET_URL", "").rstrip("/") or random.choice(DOMAIN_POOL)
OUT_DIR = Path(os.environ.get("OUT_DIR", "xianbao"))
ORIGIN = TARGET
ORIGIN_NETLOC = urlparse(TARGET).netloc
# 部署到 Vercel / Netlify 等根域名时前缀为 /；GitHub Pages 项目页改为 /<repo>。
PAGES_PREFIX = os.environ.get("PAGES_PREFIX", "/")

# 每轮运行抓取的列表页数量（每分类）。控制每日增量节奏，避免单次过长暴露。
PAGES_PER_RUN_PER_CAT = int(os.environ.get("PAGES_PER_RUN_PER_CAT", "6"))
# maintenance 模式下每天抽样复查的已抓文章数（检测新评论/内容更新）。
RECHECK_PER_RUN = int(os.environ.get("RECHECK_PER_RUN", "200"))
# 单轮运行渲染页面总数安全上限（防止意外失控）。
MAX_PAGES_PER_RUN = int(os.environ.get("MAX_PAGES_PER_RUN", "400"))
# 分类列表页连续「无新文章」达到此次数，判定该分类已抓完。
CONSEC_MISS_LIMIT = int(os.environ.get("CONSEC_MISS_LIMIT", "3"))
# 单分类列表页安全上限（防止死循环）。
MAX_CAT_PAGES = int(os.environ.get("MAX_CAT_PAGES", "5000"))

# 失效地址（永久 404/410）记录：达到阈值后下次不再爬取，减少原站负担与暴露面。
DEAD_FAIL_LIMIT = int(os.environ.get("DEAD_FAIL_LIMIT", "2"))
# 失效记录的存活周期（天）：到期后再试一次（应对源站临时恢复）。0 = 永不过期。
DEAD_TTL_DAYS = int(os.environ.get("DEAD_TTL_DAYS", "90"))

NAV_TIMEOUT_MS = int(os.environ.get("NAV_TIMEOUT_MS", "30000"))
CRAWL_DELAY_MS = int(os.environ.get("CRAWL_DELAY_MS", "200"))
COMMENT_WAIT_MS = int(os.environ.get("COMMENT_WAIT_MS", "6000"))

TEXT_EXT = {".html", ".htm", ".css", ".js", ".mjs", ".json", ".xml",
            ".svg", ".txt", ".map", ".webmanifest", ".php"}

# 资源型扩展名：这类 URL 一律本地化（与页面链接的「是否白名单」判定无关）。
ASSET_EXT = {
    ".css", ".js", ".mjs", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
    ".woff", ".woff2", ".ttf", ".eot", ".webp", ".mp4", ".webm", ".json",
    ".xml", ".map", ".webmanifest", ".zip", ".7z", ".pdf",
}

# 分类列表页 / 文章页 路径正则（由 ALLOWED_CATEGORIES 动态生成）
_CAT_ALT = "|".join(ALLOWED_CATEGORIES)
CAT_RE = re.compile(r"^/category-(?:" + _CAT_ALT + r")(?:/\d+)?/?$")
ART_RE = re.compile(r"^/(?:" + _CAT_ALT + r")/\d+\.html$")


# ---------------------------------------------------------------------------
# 指纹伪装：注入到每个页面的初始化脚本（降低被识别为自动化工具的概率）
# ---------------------------------------------------------------------------
STEALTH_JS = r"""
(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  if (!window.chrome) {
    window.chrome = { runtime: {}, app: { isInstalled: false }, webstore: {} };
  }
  Object.defineProperty(navigator, 'languages', {
    get: () => ['zh-CN', 'zh', 'en-US', 'en']
  });
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const make = (name, desc, ext) => {
        const p = { name, description: desc, filename: ext,
          length: 1, item: () => p[0], namedItem: () => p[0],
          0: { type: 'application/x-' + ext, suffixes: ext, description: desc } };
        return p;
      };
      return [make('Chrome PDF Plugin', 'Portable Document Format', 'pdf'),
              make('Chrome PDF Viewer', '', 'pdf'),
              make('Native Client', '', 'nexe')];
    }
  });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
  Object.defineProperty(screen, 'width', { get: () => 1536 });
  Object.defineProperty(screen, 'height', { get: () => 864 });
  Object.defineProperty(screen, 'availWidth', { get: () => 1536 });
  Object.defineProperty(screen, 'availHeight', { get: () => 824 });
  Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
  Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
  const WEBCL = {
    37445: 'Google Inc. (Intel)',
    37446: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'
  };
  for (const Ctx of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Ctx) continue;
    const orig = Ctx.prototype.getParameter;
    Ctx.prototype.getParameter = function (p) {
      if (WEBCL[p]) return WEBCL[p];
      return orig.call(this, p);
    };
  }
  document.addEventListener('DOMContentLoaded', function () {
    const m = document.querySelector('meta[http-equiv="refresh" i]');
    if (m) m.remove();
  });
})()
"""

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

SKIP_EXT = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".css", ".js", ".mjs",
            ".woff", ".woff2", ".ttf", ".svg", ".json", ".webp", ".mp4",
            ".webm", ".pdf", ".map", ".xml", ".webmanifest", ".zip", ".7z", ".key"}


# ---------------------------------------------------------------------------
# URL 工具
# ---------------------------------------------------------------------------
def url_to_local(url: str):
    """同站 URL -> 本地相对路径（去掉 netloc，按 path 落地；与源域名无关，
    因此轮换域名不会碎片镜像）。"""
    p = urlparse(url)
    if p.netloc and p.netloc not in ALL_NETLOCS:
        return None
    path = unquote(p.path)
    if path == "" or path == "/":
        path = "/index.html"
    elif path.endswith("/"):
        path = path + "index.html"
    else:
        base, ext = os.path.splitext(path)
        if ext == "":
            path = path + ".html"
    path = re.sub(r'[*:"<>|?]', "_", path).lstrip("/")
    return path


def is_asset_path(path: str) -> bool:
    ext = os.path.splitext(path)[1].lower()
    return ext in ASSET_EXT


def _encode_url(absu: str) -> str:
    """对非 ASCII / 空格路径做百分号编码，避免 urllib 抛 ascii/控制字符错误
    （日志里大量 'ascii' codec can't encode / URL can't contain control characters）。"""
    try:
        p = urlparse(absu)
        if not p.netloc:
            return absu
        enc_path = quote(p.path, safe="/%@")
        enc_query = quote(p.query, safe="=&%@")
        return p._replace(path=enc_path, query=enc_query).geturl()
    except Exception:
        return absu


def is_allowed(url: str) -> bool:
    """是否白名单内页面（分类列表页 / 文章页 / 根）。跨域名（含同源其他分类/
    静态页）一律 False。"""
    p = urlparse(url)
    if p.netloc and p.netloc not in ALL_NETLOCS:
        return False
    path = p.path or "/"
    if path in ("/", ""):
        return True
    return bool(CAT_RE.match(path) or ART_RE.match(path))


def fix_url(val: str) -> str:
    """改写单条链接：
    - 跨站 / 协议相对 / 特殊协议：原样返回。
    - 同源资源（CSS/JS/图片等）：改写为本地前缀。
    - 同源页面：白名单内 -> 本地前缀；非白名单 -> 原站绝对地址（跳活站）。
    """
    v = (val or "").strip()
    if not v:
        return v
    frag = ""
    if "#" in v:
        v, frag = v.split("#", 1)
    if v.startswith("//"):
        return v + ("#" + frag if frag else "")
    if v.startswith(("http://", "https://")):
        parsed = urlparse(v)
        if parsed.netloc not in ALL_NETLOCS:
            return v + ("#" + frag if frag else "")
        path = parsed.path or "/"
        netloc = parsed.netloc
    elif v.startswith("/"):
        path = v
        netloc = ORIGIN_NETLOC
    else:
        # 无协议相对路径：无法判定归属，原样保留
        return v + ("#" + frag if frag else "")

    # 内部页面先规范化 .html，再判定白名单
    if not path.endswith("/"):
        base, ext = os.path.splitext(path)
        if ext == "":
            path = path + ".html"

    if is_asset_path(path):
        local = path.lstrip("/")
        return PAGES_PREFIX + local + ("#" + frag if frag else "")

    # 页面
    if is_allowed("https://" + netloc + path):
        if PAGES_PREFIX.endswith("/") and path.startswith("/"):
            path = path[1:]
        return PAGES_PREFIX + path + ("#" + frag if frag else "")
    # 非白名单页面 -> 原站绝对地址（点击跳活站），已含规范化 .html
    return "https://" + netloc + path + ("#" + frag if frag else "")


def discover_article_links(html: str, base_url: str):
    """从 HTML 提取「文章页」站内链接（仅 ART_RE 匹配），返回绝对 URL 列表。
    列表页/其他分类/静态页一律不返回，避免 BFS 失控。"""
    if not html:
        return []
    out = []
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("javascript:", "mailto:", "tel:",
                                         "#", "//", "data:")):
            continue
        if href.startswith("http://") or href.startswith("https://"):
            if urlparse(href).netloc not in ALL_NETLOCS:
                continue
            absu = href
        elif href.startswith("/"):
            absu = ORIGIN + href
        else:
            absu = urljoin(base_url, href)
            if urlparse(absu).netloc not in ALL_NETLOCS:
                continue
        if os.path.splitext(urlparse(absu).path)[1].lower() in SKIP_EXT:
            continue
        clean = absu.split("#")[0]
        if clean.endswith("/"):
            clean = clean[:-1]
        if ART_RE.match(urlparse(clean).path or ""):
            out.append(clean)
    return out


def rewrite_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    attrs = ("href", "src", "data-src", "poster", "data-href", "data-url", "srcset")
    for tag in soup.find_all(True):
        for a in attrs:
            val = tag.get(a)
            if isinstance(val, str) and val.strip():
                if a == "srcset":
                    parts = [s.strip() for s in val.split(",")]
                    new_parts = []
                    for part in parts:
                        toks = part.split()
                        if toks:
                            toks[0] = fix_url(toks[0])
                            new_parts.append(" ".join(toks))
                        else:
                            new_parts.append(part)
                    tag[a] = ", ".join(new_parts)
                else:
                    tag[a] = fix_url(val.strip())
        style = tag.get("style")
        if style and "url(" in style:
            tag["style"] = re.sub(
                r"url\(\s*['\"]?(.*?)['\"]?\s*\)",
                lambda m: "url(" + fix_url(m.group(1)) + ")",
                style,
            )
    for meta in soup.find_all("meta"):
        if meta.get("http-equiv", "").lower() == "refresh":
            c = meta.get("content", "")
            if c:
                meta["content"] = re.sub(
                    r"URL=([^\s]+)",
                    lambda m: "URL=" + fix_url(m.group(1)),
                    c,
                )
    _t = soup.find("title")
    if _t:
        _tt = _t.get_text()
        if _tt:
            _t.clear()
            _t.append(_tt.replace("new.xianbao.fun", "线报酷镜像"))
    for c in list(soup.contents):
        if isinstance(c, Doctype):
            break
        if isinstance(c, NavigableString):
            c.extract()
        else:
            break
    out = str(soup)
    out = re.sub(
        r"(window\.)?location\.href\s*=\s*(['\"])([^'\"]+)\2",
        lambda m: (m.group(1) or "") + "location.href = " + m.group(2)
                  + fix_url(m.group(3)) + m.group(2),
        out,
    )
    if not re.match(r'\s*<!DOCTYPE', out, re.IGNORECASE):
        out = "<!DOCTYPE html>\n" + out
    return out


def rewrite_text_asset(text: str, url: str = "") -> str:
    _prefix = PAGES_PREFIX.rstrip("/")
    text = re.sub(r"https?://" + re.escape(ORIGIN_NETLOC), _prefix, text)
    if url.endswith(".css"):
        text = re.sub(
            r"url\(\s*['\"]?(/[^/'\"][^'\"()]*?)['\"]?\s*\)",
            lambda m: "url(" + _prefix + m.group(1) + ")",
            text,
        )
    if url.endswith((".js", ".mjs")):
        text = re.sub(
            r"(href|src)(\s*=\s*\\?['\"])(/(?:zh|ja|en)/[A-Za-z0-9_#-]+)(\\?['\"])",
            lambda m: m.group(1) + m.group(2) + fix_url(m.group(3)) + m.group(4),
            text,
        )
    return text


def is_text(url: str, ctype: str) -> bool:
    ext = os.path.splitext(urlparse(url).path)[1].lower()
    if ext in TEXT_EXT:
        return True
    return ctype.startswith(("text/", "application/javascript", "application/json"))


def extract_refresh_tag(raw_html: str):
    m = re.search(r"<meta[^>]*http-equiv\s*=\s*[\"']?refresh[\"']?[^>]*>",
                  raw_html, re.I)
    return m.group(0) if m else None


def fix_refresh_tag(tag: str) -> str:
    return re.sub(r"URL=([^\s\"']+)",
                  lambda m: "URL=" + fix_url(m.group(1)),
                  tag, flags=re.I)


def inject_refresh(html: str, tag: str) -> str:
    if re.search(r"http-equiv\s*=\s*[\"']?refresh[\"']?", html, re.I):
        return html
    if re.search(r"<head[^>]*>", html, re.I):
        return re.sub(r"(<head[^>]*>)",
                      lambda m: m.group(1) + tag,
                      html, count=1, flags=re.I)
    if re.search(r"<html[^>]*>", html, re.I):
        return re.sub(r"(<html[^>]*>)",
                      lambda m: m.group(1) + tag,
                      html, count=1, flags=re.I)
    return tag + html


def content_signature(html: str) -> str:
    """取正文文本哈希作为内容签名（隔离阅读量/侧边栏等易变元素），
    仅当正文或评论区变化时才判定为「已更新」。"""
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return hashlib.sha256(html.encode("utf-8")).hexdigest()
    for t in soup(["script", "style"]):
        t.decompose()
    main = (soup.select_one("#post-content, .post-content, article .content, "
                            ".article-content, #article_content, .content")
            or soup.body)
    text = main.get_text(" ", strip=True) if main else ""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# 状态管理
# ---------------------------------------------------------------------------
def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _now_ts():
    return int(time.time())


def is_dead(state, path):
    """path 是否已被记录为永久失效（且在存活期内）。"""
    rec = (state or {}).get("dead", {}).get(path)
    if not rec:
        return False
    if DEAD_TTL_DAYS > 0 and (time.time() - rec.get("ts", 0)) > DEAD_TTL_DAYS * 86400:
        return False  # 到期后允许再试一次
    return True


def record_dead(state, path, reason, permanent=True):
    """记录一次永久失效。累计达到 DEAD_FAIL_LIMIT 后该地址即被视为 dead。"""
    d = state.setdefault("dead", {})
    rec = d.get(path) or {"reason": reason, "fails": 0, "ts": 0, "permanent": True}
    rec["fails"] = rec.get("fails", 0) + 1
    rec["reason"] = reason
    rec["ts"] = _now_ts()
    rec["permanent"] = permanent
    d[path] = rec


def default_state():
    return {
        "version": 2,
        "target": TARGET,
        "allowed_categories": list(ALLOWED_CATEGORIES),
        "mode": "crawl",
        "category_cursor": {s: 1 for s in ALLOWED_CATEGORIES},
        "category_exhausted": {s: False for s in ALLOWED_CATEGORIES},
        "category_miss": {s: 0 for s in ALLOWED_CATEGORIES},
        "crawled": {},          # path -> {hash, local, last_check}
        "dead": {},             # path -> {reason, fails, ts, permanent} 永久失效页（不再爬）
        "dead_assets": {},      # 绝对URL -> {reason, ts} 永久失效资源（不再补）
        "recheck_idx": 0,
        "completed_at": None,
        "stats": {"pages": 0, "articles": 0, "rechecks": 0, "updated": 0},
    }


def load_state(path: Path):
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            # 合并缺省字段，兼容旧状态
            base = default_state()
            base.update({k: v for k, v in data.items()
                         if k in base and k not in ("category_cursor",
                                                    "category_exhausted",
                                                    "category_miss", "crawled")})
            for s in ALLOWED_CATEGORIES:
                base["category_cursor"][s] = data.get(
                    "category_cursor", {}).get(s, 1)
                base["category_exhausted"][s] = data.get(
                    "category_exhausted", {}).get(s, False)
                base["category_miss"][s] = data.get(
                    "category_miss", {}).get(s, 0)
            base["crawled"] = data.get("crawled", {})
            base["recheck_idx"] = data.get("recheck_idx", 0)
            base["completed_at"] = data.get("completed_at")
            return base
        except Exception as e:
            print(f"::warning:: 状态文件损坏，重置：{e}", file=sys.stderr)
    return default_state()


def save_state(path: Path, state):
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2),
                    encoding="utf-8")


# ---------------------------------------------------------------------------
# 搜索索引 + 落地页
# ---------------------------------------------------------------------------
SEARCH_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>线报酷镜像 · 站内搜索</title>
<link rel="stylesheet" href="/lib/xianbao-override.css">
<script src="https://cdn.jsdelivr.net/npm/minisearch@7/dist/umd/index.min.js"></script>
<style>
  body{font-family:system-ui,"Microsoft YaHei",sans-serif;background:#f6f7fb;color:#222;margin:0}
  .wrap{max-width:780px;margin:0 auto;padding:32px 16px}
  h1{font-size:22px;margin:0 0 16px}
  #q{width:100%;box-sizing:border-box;padding:14px 16px;font-size:16px;border:1px solid #d7dbe5;border-radius:12px;outline:none}
  #q:focus{border-color:#4f7cff;box-shadow:0 0 0 3px rgba(79,124,255,.15)}
  #r{margin-top:18px}
  .it{padding:14px 0;border-bottom:1px solid #eceef3}
  .it a{font-size:16px;color:#1f4fd6;text-decoration:none;font-weight:600}
  .it a:hover{text-decoration:underline}
  .it p{margin:6px 0 0;color:#666;font-size:13px;line-height:1.6}
  .meta{color:#999;font-size:12px;margin-top:4px}
</style>
</head>
<body>
<div class="wrap">
  <h1>线报酷镜像 · 站内搜索</h1>
  <input id="q" placeholder="输入关键词，如 红包 / 活动 / 教程…" autofocus>
  <div id="r"></div>
</div>
<script>
fetch('/search.json').then(r=>r.json()).then(function(docs){
  if(!window.MiniSearch){document.getElementById('r').innerHTML='<p>搜索组件加载失败（请检查网络是否能访问 jsdelivr CDN）。</p>';return;}
  var ms=new MiniSearch({fields:['title','body'],storeFields:['title','url','body']});
  ms.addAll(docs);
  var q=document.getElementById('q'),r=document.getElementById('r');
  function go(){
    var t=q.value.trim();
    if(!t){r.innerHTML='';return;}
    var res=ms.search(t,{prefix:true,fuzzy:0.2,boost:{title:2}});
    if(!res.length){r.innerHTML='<p>没有找到相关结果。</p>';return;}
    r.innerHTML=res.slice(0,50).map(function(x){
      return '<div class="it"><a href="'+x.url+'">'+x.title+'</a>'
        +'<p>'+((x.body||'').slice(0,140))+'</p></div>';
    }).join('');
  }
  q.addEventListener('input',go);
}).catch(function(e){
  document.getElementById('r').innerHTML='<p>搜索索引加载失败：'+e+'</p>';
});
</script>
</body>
</html>
"""


def build_search_index(out_dir: Path):
    items = []
    for p in out_dir.rglob("*.html"):
        rel = p.relative_to(out_dir).as_posix()
        if not ART_RE.match("/" + rel):
            continue
        try:
            html = p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        soup = BeautifulSoup(html, "html.parser")
        title = (soup.title.get_text(strip=True) if soup.title else "") or rel
        title = title.replace("线报酷镜像", "").strip().strip("-").strip() or rel
        for t in soup(["script", "style"]):
            t.decompose()
        main = (soup.select_one("#post-content, .post-content, article .content, "
                                ".article-content, #article_content, .content")
                or soup.body)
        text = main.get_text(" ", strip=True) if main else ""
        items.append({"title": title, "url": "/" + rel, "body": text[:300]})
    items.sort(key=lambda x: x["title"])
    (out_dir / "search.json").write_text(
        json.dumps(items, ensure_ascii=False), encoding="utf-8")
    (out_dir / "search.html").write_text(SEARCH_HTML, encoding="utf-8")
    return len(items)


def build_hub(out_dir: Path):
    lis = "".join(
        f'<li><a href="/category-{s}/">{s}</a></li>' for s in ALLOWED_CATEGORIES)
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>线报酷镜像</title>
<link rel="stylesheet" href="/lib/xianbao-override.css">
<style>body{{font-family:system-ui,"Microsoft YaHei",sans-serif;background:#f6f7fb;color:#222;margin:0}}
.wrap{{max-width:680px;margin:0 auto;padding:40px 16px}}
h1{{font-size:24px;margin:0 0 8px}}
p{{color:#666}}ul{{line-height:2;font-size:16px}}
a{{color:#1f4fd6;text-decoration:none}}a:hover{{text-decoration:underline}}
.bar{{margin-top:24px}}<a href="/search.html" style="display:inline-block;padding:10px 18px;background:#1f4fd6;color:#fff;border-radius:10px">🔍 站内搜索</a></style>
</head>
<body><div class="wrap">
<h1>线报酷镜像</h1>
<p>本镜像仅增量备份以下 5 个分类（每日更新，含评论）：</p>
<ul>{lis}</ul>
<div class="bar"><a href="/search.html">🔍 站内搜索</a></div>
</div></body></html>"""
    (out_dir / "index.html").write_text(html, encoding="utf-8")


# ---------------------------------------------------------------------------
# 渲染页面（单页）
# ---------------------------------------------------------------------------
def render_page(page, url: str, path: str, raw_docs: dict, state=None):
    """导航并渲染单页，返回 (ok, rendered_html, raw_html)。
    若响应为永久失效（404/410），记录到 state.dead 并跳过，下次不再爬取。"""
    _status = None
    _nav_ok = False
    for _attempt in range(3):
        try:
            _resp = page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
            _nav_ok = True
            _status = _resp.status if _resp is not None else None
            break
        except PWTimeout:
            print(f"::warning:: 导航超时（第 {_attempt+1}/3 次）{url}", file=sys.stderr)
        except Exception as e:
            print(f"::warning:: 导航失败（第 {_attempt+1}/3 次）{url}: {e}", file=sys.stderr)
        if _attempt < 2:
            time.sleep(2 ** _attempt)
    if not _nav_ok:
        return (False, None, None)
    if _status in (404, 410) and state is not None:
        record_dead(state, path, f"HTTP {_status}", permanent=True)
        print(f"==> 永久失效（{_status}），已记录跳过：{url}")
        return (False, None, None)

    local = url_to_local(url)
    raw = raw_docs.get(local, "")
    is_redirect = bool(extract_refresh_tag(raw))
    dom = None

    if is_redirect:
        rendered = rewrite_html(raw)
    else:
        # 文章页需等待 AJAX 评论注入（Z-BlogPHP）
        if path.rstrip("/").endswith(".html"):
            try:
                page.wait_for_load_state("networkidle", timeout=4000)
            except Exception:
                pass
            try:
                page.wait_for_timeout(1500)
            except Exception:
                pass
        try:
            dom = page.evaluate("document.documentElement.outerHTML")
        except Exception as e:
            print(f"::warning:: 读取 DOM 失败 {url}: {e}", file=sys.stderr)
            dom = raw
        rendered = rewrite_html(dom)
        if raw and not is_redirect:
            tag = extract_refresh_tag(raw)
            if tag:
                rendered = inject_refresh(rendered, fix_refresh_tag(tag))
    return (True, rendered, raw)


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main():
    print(f"==> TARGET 域名（随机轮换）：{TARGET}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state(OUT_DIR / ".crawl-state.json")
    state["target"] = TARGET

    raw_docs = {}
    pages_rendered = 0

    exe_path = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None

    with sync_playwright() as p:
        launch_kwargs = dict(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-infobars",
                "--lang=zh-CN",
            ],
        )
        if exe_path:
            launch_kwargs["executable_path"] = exe_path
        browser = p.chromium.launch(**launch_kwargs)

        try:
            context = browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1536, "height": 864},
                device_scale_factor=1,
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                color_scheme="light",
                accept_downloads=False,
            )
            context.add_init_script(STEALTH_JS)
            page = context.new_page()
            page.set_default_timeout(NAV_TIMEOUT_MS)

            def on_response(response):
                url = response.url
                if urlparse(url).netloc not in ALL_NETLOCS:
                    return
                local = url_to_local(url)
                if local is None:
                    return
                try:
                    body = response.body()
                except Exception:
                    return
                if body is None:
                    return
                ctype = response.headers.get("content-type", "")
                if response.request.resource_type == "document":
                    try:
                        raw_docs[local] = body.decode("utf-8", errors="replace")
                    except Exception:
                        pass
                    return
                # 资源：已存在则跳过重复下载（减少源站压力）
                if (OUT_DIR / local).exists():
                    return
                outp = OUT_DIR / local
                outp.parent.mkdir(parents=True, exist_ok=True)
                try:
                    if is_text(url, ctype):
                        text = body.decode("utf-8", errors="replace")
                        outp.write_text(rewrite_text_asset(text, url), encoding="utf-8")
                    else:
                        outp.write_bytes(body)
                except Exception as e:
                    print(f"::warning:: 资源保存失败 {url}: {e}", file=sys.stderr)

            page.on("response", on_response)

            def save_page(path: str, rendered: str, kind: str):
                nonlocal pages_rendered
                url = TARGET + path
                local = url_to_local(url)
                outp = OUT_DIR / local
                outp.parent.mkdir(parents=True, exist_ok=True)
                outp.write_text(rendered, encoding="utf-8")
                sig = content_signature(rendered)
                now = _now()
                if kind == "recheck":
                    prev = state["crawled"].get(path, {})
                    if prev.get("hash") != sig:
                        state["stats"]["updated"] += 1
                    rec = state["crawled"].setdefault(
                        path, {"hash": sig, "local": local, "last_check": now})
                    rec["hash"] = sig
                    rec["local"] = local
                    rec["last_check"] = now
                else:
                    is_new = path not in state["crawled"]
                    state["crawled"][path] = {
                        "hash": sig, "local": local, "last_check": now}
                    if is_new:
                        if ART_RE.match(path):
                            state["stats"]["articles"] += 1
                        else:
                            state["stats"]["pages"] += 1
                pages_rendered += 1

            def bfs_articles(seed_paths, label=""):
                nonlocal pages_rendered
                queue = deque(sorted(seed_paths))
                seen = set(state["crawled"].keys())
                while queue and pages_rendered < MAX_PAGES_PER_RUN:
                    path = queue.popleft()
                    if path in seen or path in state["crawled"] or is_dead(state, path):
                        continue
                    seen.add(path)
                    url = TARGET + path
                    ok, rendered, raw = render_page(page, url, path, raw_docs, state)
                    if not ok:
                        continue
                    save_page(path, rendered, "article")
                    if CRAWL_DELAY_MS > 0:
                        time.sleep(CRAWL_DELAY_MS / 1000.0)
                    found = discover_article_links(raw if raw else rendered, url)
                    for a in found:
                        ap = urlparse(a).path
                        if (ap not in seen and ap not in state["crawled"]
                                and not is_dead(state, ap)):
                            queue.append(ap)

            if state["mode"] == "crawl":
                new_articles = set()
                for slug in ALLOWED_CATEGORIES:
                    if state["category_exhausted"][slug]:
                        continue
                    start = state["category_cursor"][slug]
                    end = start + PAGES_PER_RUN_PER_CAT - 1
                    for n in range(start, end + 1):
                        if n > MAX_CAT_PAGES:
                            state["category_exhausted"][slug] = True
                            break
                        path = f"/category-{slug}/" if n == 1 else f"/category-{slug}/{n}/"
                        url = TARGET + path
                        ok, rendered, raw = render_page(page, url, path, raw_docs, state)
                        if not ok:
                            state["category_miss"][slug] += 1
                            if state["category_miss"][slug] >= CONSEC_MISS_LIMIT:
                                state["category_exhausted"][slug] = True
                                print(f"==> 分类 {slug} 判定已抓完（{n} 页无新内容）")
                                break
                            continue
                        save_page(path, rendered, "list")
                        if CRAWL_DELAY_MS > 0:
                            time.sleep(CRAWL_DELAY_MS / 1000.0)
                        arts = discover_article_links(raw if raw else rendered, url)
                        fresh = [urlparse(a).path for a in arts
                                 if urlparse(a).path not in state["crawled"]]
                        if fresh:
                            state["category_miss"][slug] = 0
                            new_articles.update(fresh)
                        else:
                            state["category_miss"][slug] += 1
                            if state["category_miss"][slug] >= CONSEC_MISS_LIMIT:
                                state["category_exhausted"][slug] = True
                                print(f"==> 分类 {slug} 判定已抓完（连续无新文章）")
                                break
                    state["category_cursor"][slug] = end + 1
                # BFS 渲染新发现的文章
                bfs_articles(new_articles, "crawl")
                if all(state["category_exhausted"][s] for s in ALLOWED_CATEGORIES):
                    state["mode"] = "maintenance"
                    state["completed_at"] = _now()
                    print("==> 全部分类抓取完成，进入 maintenance（维护/增量更新）模式")
            else:
                # maintenance：检查各分类第 1 页捕获新帖 + 抽样复查更新
                new_articles = set()
                for slug in ALLOWED_CATEGORIES:
                    path = f"/category-{slug}/"
                    url = TARGET + path
                    ok, rendered, raw = render_page(page, url, path, raw_docs, state)
                    if not ok:
                        continue
                    save_page(path, rendered, "list")
                    if CRAWL_DELAY_MS > 0:
                        time.sleep(CRAWL_DELAY_MS / 1000.0)
                    arts = discover_article_links(raw if raw else rendered, url)
                    for a in arts:
                        ap = urlparse(a).path
                        if ap not in state["crawled"]:
                            new_articles.add(ap)
                bfs_articles(new_articles, "maintenance-new")
                # 抽样复查已抓文章（检测新评论/内容更新）
                paths = list(state["crawled"].keys())
                if paths:
                    idx = state["recheck_idx"] % len(paths)
                    step = max(1, len(paths) // max(1, RECHECK_PER_RUN)) \
                        if RECHECK_PER_RUN < len(paths) else 1
                    sample = paths[idx: idx + RECHECK_PER_RUN] \
                        if idx + RECHECK_PER_RUN <= len(paths) \
                        else paths[idx:] + paths[: RECHECK_PER_RUN - (len(paths) - idx)]
                    state["recheck_idx"] = (idx + RECHECK_PER_RUN) % len(paths)
                    for path in sample:
                        url = TARGET + path
                        ok, rendered, raw = render_page(page, url, path, raw_docs, state)
                        if not ok:
                            continue
                        save_page(path, rendered, "recheck")
                        state["stats"]["rechecks"] += 1
                        if CRAWL_DELAY_MS > 0:
                            time.sleep(CRAWL_DELAY_MS / 1000.0)
        finally:
            browser.close()

    # 落地索引与首页 hub
    n_idx = build_search_index(OUT_DIR)
    build_hub(OUT_DIR)

    # 后处理：补全缺失资源 + 剥离注入/分析脚本
    fill_missing(state)
    stripped = strip_injection_scripts(set())
    stripped_analytics = strip_analytics_scripts()

    (OUT_DIR / ".nojekyll").write_text("", encoding="utf-8")

    if not (OUT_DIR / "index.html").exists():
        print("::error::产物校验失败：index.html 不存在，疑似抓取失败，中止", file=sys.stderr)
        sys.exit(1)
    _html_count = len(glob.glob(str(OUT_DIR / "**" / "*.html"), recursive=True))
    if _html_count < 5:
        print(f"::error::产物校验失败：仅 {_html_count} 个 HTML 页面，疑似异常，中止", file=sys.stderr)
        sys.exit(1)

    save_state(OUT_DIR / ".crawl-state.json", state)

    meta = {
        "generated_at": _now(),
        "target": TARGET,
        "mode": state["mode"],
        "completed_at": state["completed_at"],
        "pages_rendered_this_run": pages_rendered,
        "crawled_total": len(state["crawled"]),
        "search_index_items": n_idx,
        "stats": state["stats"],
        "stripped_scripts": stripped,
        "stripped_analytics": stripped_analytics,
        "dead_pages": len(state.get("dead", {})),
        "dead_assets": len(state.get("dead_assets", {})),
        "html_count": _html_count,
    }
    (OUT_DIR / ".mirror-meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"==> 渲染完成：本轮渲染 {pages_rendered} 页，已抓总计 {len(state['crawled'])} 个，"
          f"搜索索引 {n_idx} 条，模式={state['mode']}，"
          f"失效页记录 {len(state.get('dead', {}))} 个 / 失效资源 {len(state.get('dead_assets', {}))} 个，"
          f"HTML 校验 {_html_count} 个，输出目录 {OUT_DIR}")


def _is_relative_ref(ref):
    return not ref.startswith(("http://", "https://", "/", "//", "data:",
                                "javascript:", "mailto:", "tel:", "#"))


def fill_missing(state=None, raw_url_map=None):
    """扫描已保存文件中所有「站内资源」引用，下载 Playwright 未捕获的缺失资源。
    仅补全资源（CSS/JS/图片/字体等），不抓取页面（页面由主爬虫负责，且可避免误抓
    /record/<用户>.html 等 404 噪声与中文/空格路径崩溃）。对永久失效（404/410）的资源
    记录到 state.dead_assets，下次不再重试。"""
    if raw_url_map is None:
        raw_url_map = {}
    dead_assets = (state or {}).get("dead_assets", {}) or {}
    refs = set()
    files = (glob.glob(str(OUT_DIR / "**" / "*.html"), recursive=True)
             + glob.glob(str(OUT_DIR / "**" / "*.css"), recursive=True)
             + glob.glob(str(OUT_DIR / "**" / "*.js"), recursive=True))
    for fp in files:
        try:
            text = open(fp, encoding="utf-8", errors="replace").read()
        except Exception:
            continue
        rel_path = os.path.relpath(fp, OUT_DIR).replace(os.sep, "/")
        base_url = raw_url_map.get(rel_path)
        for m in re.findall(r'(?:href|src|data-src|poster)\s*=\s*["\']([^"\']+)["\']', text):
            refs.add(m)
            if base_url and _is_relative_ref(m):
                resolved = urljoin(base_url, m)
                if urlparse(resolved).netloc in ALL_NETLOCS:
                    refs.add(resolved)
        for m in re.findall(r'srcset\s*=\s*["\']([^"\']+)["\']', text):
            for part in m.split(","):
                toks = part.strip().split()
                if toks:
                    refs.add(toks[0])
                    if base_url and _is_relative_ref(toks[0]):
                        resolved = urljoin(base_url, toks[0])
                        if urlparse(resolved).netloc in ALL_NETLOCS:
                            refs.add(resolved)
        for m in re.findall(r'url\(\s*["\']?([^)"\']+)["\']?\s*\)', text):
            refs.add(m)
            if base_url and _is_relative_ref(m):
                resolved = urljoin(base_url, m)
                if urlparse(resolved).netloc in ALL_NETLOCS:
                    refs.add(resolved)
    ctx = ssl.create_default_context()
    req_hd = {"User-Agent": USER_AGENT, "Accept-Language": "zh-CN,zh;q=0.9"}
    count = 0
    skipped_dead = 0
    for ref in refs:
        if ref.startswith(PAGES_PREFIX):
            ref = ref[len(PAGES_PREFIX):]
            if not ref:
                continue
            if not ref.startswith("/") and not ref.startswith(("http://", "https://")):
                ref = "/" + ref
        if not ref or ref.startswith(("//", "data:", "javascript:", "mailto:",
                                       "tel:", "#")):
            continue
        if ref.startswith(("http://", "https://")):
            if urlparse(ref).netloc not in ALL_NETLOCS:
                continue
            absu = ref
        elif ref.startswith("/"):
            absu = ORIGIN + ref
        else:
            continue
        absu = absu.split("#")[0]
        # 仅补全资源（非页面），避免误抓 /record/<用户>.html 等 404 个人主页
        if not is_asset_path(urlparse(absu).path):
            continue
        if absu in dead_assets:
            skipped_dead += 1
            continue  # 已记录失效，不再重试
        local = url_to_local(absu)
        if not local or (OUT_DIR / local).exists():
            continue
        body = None
        ctype = ""
        req_url = _encode_url(absu)  # 处理中文/空格路径，避免 ascii/控制字符错误
        for _attempt in range(3):
            try:
                req = _ur.Request(req_url, headers=req_hd)
                with _ur.urlopen(req, timeout=30, context=ctx) as r:
                    body = r.read()
                ctype = r.headers.get("content-type", "")
                break
            except _ur.HTTPError as he:
                if he.code in (404, 410):
                    if state is not None:
                        state.setdefault("dead_assets", {})[absu] = {
                            "reason": f"HTTP {he.code}", "ts": _now_ts()}
                    print(f"::warning:: 资源永久失效（{he.code}），已记录跳过：{absu}",
                          file=sys.stderr)
                    break
                print(f"::warning:: 补全下载失败（第 {_attempt+1}/3 次）{absu}: HTTP {he.code}",
                      file=sys.stderr)
            except Exception as e:
                print(f"::warning:: 补全下载失败（第 {_attempt+1}/3 次）{absu}: {e}", file=sys.stderr)
            if _attempt < 2:
                time.sleep(2 ** _attempt)
        if body is None:
            continue
        outp = OUT_DIR / local
        outp.parent.mkdir(parents=True, exist_ok=True)
        if is_text(absu, ctype):
            outp.write_text(rewrite_text_asset(body.decode("utf-8", "replace"), absu), encoding="utf-8")
        else:
            outp.write_bytes(body)
        count += 1
    if count:
        print(f"  [fill] 补全资源 {count} 个")
    if skipped_dead:
        print(f"  [fill] 跳过已记录失效资源 {skipped_dead} 个")
    return count


def strip_injection_scripts(raw_saved=None):
    """剥离 document.write/writeln 注入型脚本标签（注入内容已烘焙进 DOM）。"""
    if raw_saved is None:
        raw_saved = set()
    js_files = glob.glob(str(OUT_DIR / "**" / "*.js"), recursive=True)
    injection_basenames = set()
    for jf in js_files:
        try:
            src = open(jf, encoding="utf-8", errors="replace").read()
        except Exception:
            continue
        if re.search(r"document\.(write|writeln)\s*\(", src):
            injection_basenames.add(os.path.basename(jf))
    if not injection_basenames:
        print("==> 未发现 document.write 注入型脚本，跳过剥离")
        return 0
    print(f"==> 识别到注入型脚本：{sorted(injection_basenames)}")
    removed = 0
    html_files = (glob.glob(str(OUT_DIR / "**" / "*.html"), recursive=True)
                  + glob.glob(str(OUT_DIR / "**" / "*.htm"), recursive=True))
    for hf in html_files:
        try:
            soup = BeautifulSoup(open(hf, encoding="utf-8", errors="replace").read(),
                                 "html.parser")
        except Exception:
            continue
        changed = False
        for tag in soup.find_all("script"):
            src = tag.get("src", "")
            if src:
                base = src.split("?")[0].rstrip("/").split("/")[-1]
                if base in injection_basenames:
                    tag.decompose()
                    removed += 1
                    changed = True
            else:
                if re.search(r"document\.(write|writeln)\s*\(", tag.text or ""):
                    tag.decompose()
                    removed += 1
                    changed = True
        if changed:
            try:
                open(hf, "w", encoding="utf-8").write(str(soup))
            except Exception as e:
                print(f"::warning:: 重写 {hf} 失败: {e}", file=sys.stderr)
    print(f"==> 已剥离注入型 <script> 标签 {removed} 个")
    return removed


def strip_analytics_scripts():
    """剥离第三方统计脚本（51.la / Clarity / 百度 / Google / CNZZ / Matomo 等）。"""
    ANALYTICS_PATTERNS = [
        r"sdk\.51\.la", r"data-la-ev=", r"LA\.init\s*\(",
        r"clarity\.ms", r"clarity\.js",
        r"hm\.baidu\.com", r"cnzz\.com", r"web\.js\.counter\.qq\.com",
        r"googletagmanager\.com", r"google-analytics\.com", r"gtag\(",
        r"matomo\.", r"piwik\.",
    ]
    combined = re.compile("|".join(ANALYTICS_PATTERNS), re.IGNORECASE)
    html_files = (glob.glob(str(OUT_DIR / "**" / "*.html"), recursive=True)
                  + glob.glob(str(OUT_DIR / "**" / "*.htm"), recursive=True))
    removed = 0
    for hf in html_files:
        try:
            soup = BeautifulSoup(open(hf, encoding="utf-8", errors="replace").read(),
                                 "html.parser")
        except Exception:
            continue
        changed = False
        for tag in soup.find_all("script"):
            src = tag.get("src", "") or ""
            text = tag.get_text() or ""
            if combined.search(src) or combined.search(text):
                tag.decompose()
                removed += 1
                changed = True
        if changed:
            try:
                open(hf, "w", encoding="utf-8").write(str(soup))
            except Exception as e:
                print(f"::warning:: 重写 {hf} 失败: {e}", file=sys.stderr)
    if removed:
        print(f"==> 已剥离第三方分析脚本标签 {removed} 个")
    else:
        print("==> 未发现第三方分析脚本，跳过剥离")
    return removed


if __name__ == "__main__":
    main()
