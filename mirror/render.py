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
import subprocess
import urllib.request
from pathlib import Path
from urllib.parse import urlparse, unquote, urljoin, quote
from collections import deque

from bs4 import BeautifulSoup, Doctype, NavigableString, Comment
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

# 论坛后端域名：源站 new.xianbao.fun 是门户（Z-BlogPHP），帖子原文在 v1.xianbao.net
# （Discuz 的 /thread-TID-页-序号.html 格式）。列表页把帖子链接指向该论坛域名，
# 若不处理，点击会跳回源站论坛，且 discover_article_links 因 netloc 不在白名单而
# 漏抓 -> 新赚客吧等分类“一个帖子都没有”。下面把论坛链接映射回门户同分类本地路径。
FORUM_NETLOCS = {"v1.xianbao.net"}
THREAD_RE = re.compile(r"^/thread-(\d+)-(\d+)-(\d+)\.html$")
DEFAULT_THREAD_SLUG = "xinzuanba"  # 当前仅新赚客吧列表使用论坛链接；作兜底分类
ALL_SOURCE_NETLOCS = ALL_NETLOCS | FORUM_NETLOCS


def forum_thread_to_local(url: str, cat_slug: str = None):
    """v1.xianbao.net/thread-TID-页-序号.html -> /{cat_slug}/TID.html（门户本地路径）。
    非论坛帖子链接返回 None。cat_slug 缺省时回退 DEFAULT_THREAD_SLUG。"""
    try:
        p = urlparse(url)
    except Exception:
        return None
    if p.netloc not in FORUM_NETLOCS:
        return None
    m = THREAD_RE.match(p.path or "")
    if not m:
        return None
    slug = cat_slug or DEFAULT_THREAD_SLUG
    return PAGES_PREFIX + f"{slug}/{m.group(1)}.html"


def slug_from_path(path: str):
    """从源站路径/URL 推导分类 slug：/category-xinzuanba/10/ -> xinzuanba；
    /xinzuanba/6655611.html -> xinzuanba；
    https://new.xianbao.fun/category-xinzuanba/ -> xinzuanba（discover 的 base_url 是完整 URL）。"""
    p = (path or "").strip()
    if "://" in p:
        p = urlparse(p).path
    p = p.strip("/")
    if p.startswith("category-"):
        p = p[len("category-"):]
    return (p.split("/")[0] or DEFAULT_THREAD_SLUG)

TARGET = os.environ.get("TARGET_URL", "").rstrip("/") or random.choice(DOMAIN_POOL)
if not TARGET.startswith(("http://", "https://")):
    TARGET = "https://" + TARGET
OUT_DIR = Path(os.environ.get("OUT_DIR", "xianbao"))
ORIGIN = TARGET
ORIGIN_NETLOC = urlparse(TARGET).netloc
# 部署到 Vercel / Netlify 等根域名时前缀为 /；GitHub Pages 项目页改为 /<repo>。
PAGES_PREFIX = os.environ.get("PAGES_PREFIX", "/")

# 每轮运行抓取的列表页数量（每分类）。控制每日增量节奏，避免单次过长暴露。
PAGES_PER_RUN_PER_CAT = int(os.environ.get("PAGES_PER_RUN_PER_CAT", "6"))
# maintenance 模式下每天抽样复查的已抓文章数（检测新评论/内容更新）。
RECHECK_PER_RUN = int(os.environ.get("RECHECK_PER_RUN", "200"))
# 单轮运行渲染页面总数硬上限（列表页 + 文章页合计），防封 IP / 控 Actions 额度。
# 实测 5 分类合计约 2.6 万篇，按 200/天约需 130 天（约 4 个半月）；源站请求分散在
# 单次运行的深夜窗口内（约 0.3 req/s），隐蔽性良好；稳后可调大到 300 提速。
MAX_PAGES_PER_RUN = int(os.environ.get("MAX_PAGES_PER_RUN", "200"))
# 每渲染多少页做一次「检查点提交」（commit + push 状态与新页面），
# 使中途取消/崩溃也不丢进度、次日不重复爬。0 = 关闭检查点（仅跑完才提交）。
CHECKPOINT_EVERY = int(os.environ.get("CHECKPOINT_EVERY", "10"))
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


def fix_url(val: str, cat_slug: str = None) -> str:
    """改写单条链接：
    - 跨站 / 特殊协议：原样返回。
    - 协议相对链接 //domain/path：若 domain 属于源站则按内部链接处理，否则保留。
    - 同源资源（CSS/JS/图片等）：改写为本地前缀。
    - 同源页面：白名单内 -> 本地前缀；非白名单 -> 本地相对路径（不再跳活站）。
    """
    v = (val or "").strip()
    if not v:
        return v
    frag = ""
    if "#" in v:
        v, frag = v.split("#", 1)
    if v.startswith("//"):
        # 协议相对链接：先按 https 解析，判断是否为源站；若属于源站则按内部链接处理，
        # 否则保持协议相对（外部 CDN 等）。这样可避免点击后跳到源站。
        parsed = urlparse("https:" + v)
        _fl = forum_thread_to_local("https:" + v, cat_slug)
        if _fl is not None:
            return _fl + ("#" + frag if frag else "")
        if parsed.netloc not in ALL_NETLOCS:
            return v + ("#" + frag if frag else "")
        path = parsed.path or "/"
        netloc = parsed.netloc
    elif v.startswith(("http://", "https://")):
        parsed = urlparse(v)
        _fl = forum_thread_to_local(v, cat_slug)
        if _fl is not None:
            return _fl + ("#" + frag if frag else "")
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
    # 非白名单页面 -> 改为本地相对路径（留在镜像站内，不再跳转到原站）；
    # 这些分类未镜像，点击会 404，但至少不会把用户带离镜像。
    local = path.lstrip("/")
    if PAGES_PREFIX.endswith("/") and path.startswith("/"):
        local = path[1:]
    return PAGES_PREFIX + local + ("#" + frag if frag else "")


def strip_chrome(html: str, cat_slug: str = None) -> str:
    """剥离文章页的站外模板（顶部导航 / 侧边热门榜 / 页脚外链 / 悬浮搜索 /
    二维码工具条等），仅保留正文 + 评论，并插入「返回列表」链接，使镜像页
    自包含、点击内部链接不再跳转到原站。

    保留白名单分类的站内链接（已由 fix_url 改写为本地路径），只删除明显属于
    原站框架的容器；文章正文与 AJAX 评论均保留。
    """
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return html
    # 1) 整块删除的站外框架容器
    for tag in ("header", "footer", "aside"):
        for el in soup.find_all(tag):
            el.decompose()
    CHROME_RE = re.compile(r"(nav2-ul|rank-list|guanzhu|toolbar|xianbao-search-fab)", re.I)
    for el in soup.find_all(class_=CHROME_RE):
        el.decompose()
    # 2) 残留的二维码 / 本页二维码工具条（指向原站）
    for el in soup.select(".qr, #qr, #toolbar"):
        el.decompose()
    # 2b) 历史上的悬浮搜索按钮样式块（已无对应 <a>，属死代码）
    for st in soup.find_all("style"):
        if st.string and "xianbao-search-fab" in st.string:
            st.decompose()
    # 3) 插入「返回列表」链接（仅当能确定分类时）
    if cat_slug:
        body = soup.body
        if body is not None:
            a = soup.new_tag("a", href=f"/category-{cat_slug}/")
            a["class"] = "back-to-list"
            a["style"] = ("display:inline-block;margin:14px 0 0;color:#1f4fd6;"
                          "text-decoration:none;font-size:14px;font-weight:600")
            a.string = "← 返回列表"
            body.insert(0, a)
            body.insert(0, Comment("xianbao-chrome-stripped"))
    return str(soup)


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
            _n = urlparse(href).netloc
            if _n in FORUM_NETLOCS:
                _tm = THREAD_RE.match(urlparse(href).path or "")
                if _tm:
                    # 论坛帖子链接 -> 门户同分类绝对 URL，交给下方 ART_RE 统一判定
                    _slug = slug_from_path(base_url) or DEFAULT_THREAD_SLUG
                    absu = TARGET + f"/{_slug}/{_tm.group(1)}.html"
                else:
                    continue
            elif _n not in ALL_NETLOCS:
                continue
            else:
                absu = href
        elif href.startswith("/"):
            absu = urljoin(ORIGIN, href)
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


def rewrite_html(html: str, cat_slug: str = None) -> str:
    soup = BeautifulSoup(html, "html.parser")
    attrs = ("href", "src", "data-src", "poster", "data-href", "data-url",
             "data-yuanurl", "srcset", "action")
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
                            toks[0] = fix_url(toks[0], cat_slug)
                            new_parts.append(" ".join(toks))
                        else:
                            new_parts.append(part)
                    tag[a] = ", ".join(new_parts)
                else:
                    tag[a] = fix_url(val.strip(), cat_slug)
        style = tag.get("style")
        if style and "url(" in style:
            tag["style"] = re.sub(
                r"url\(\s*['\"]?(.*?)['\"]?\s*\)",
                lambda m: "url(" + fix_url(m.group(1), cat_slug) + ")",
                style,
            )
    for meta in soup.find_all("meta"):
        if meta.get("http-equiv", "").lower() == "refresh":
            c = meta.get("content", "")
            if c:
                meta["content"] = re.sub(
                    r"URL=([^\s]+)",
                    lambda m: "URL=" + fix_url(m.group(1), cat_slug),
                    c,
                )
    _t = soup.find("title")
    if _t:
        _tt = _t.get_text()
        if _tt:
            for _loc in ALL_NETLOCS:
                _tt = _tt.replace(_loc, "线报酷镜像")
            _t.clear()
            _t.append(_tt)
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
                  + fix_url(m.group(3), cat_slug) + m.group(2),
        out,
    )
    out = re.sub(
        r"(window\.)?location\s*=\s*(['\"])([^'\"]+)\2",
        lambda m: (m.group(1) or "") + "location = " + m.group(2)
                  + fix_url(m.group(3), cat_slug) + m.group(2),
        out,
    )
    out = re.sub(
        r"(window\.)?location\.(replace|assign)\s*\(\s*(['\"])([^'\"]+)\3\s*\)",
        lambda m: (m.group(1) or "") + "location." + m.group(2) + "("
                  + m.group(3) + fix_url(m.group(4), cat_slug) + m.group(3) + ")",
        out,
    )
    out = re.sub(
        r"window\.open\s*\(\s*(['\"])([^'\"]+)\1\s*",
        lambda m: "window.open(" + m.group(1) + fix_url(m.group(2), cat_slug) + m.group(1),
        out,
    )
    # 兜底：剔除任何残留的源站绝对/协议相对域名。典型场景是分享二维码组件
    # `<img src="//x.com/api/qr.php?d=https://news.xianbao.fun/...">` 的 d= 参数——
    # 该属性的 netloc 是二维码 API 而非源站，fix_url 不会改写其内部的源站 URL，
    # 故在此做全局兜底，把源站域名整体抹掉、保留本地路径（d=/category-xxx/）。
    # 由于仅匹配 ALL_NETLOCS，外部链接（京东/阿里 CDN 等）不受影响。幂等可重入。
    out = re.sub(
        r"(?:https?:)?//(?:" + "|".join(re.escape(n) for n in ALL_SOURCE_NETLOCS) + r")",
        "",
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
        "pending": set(),       # 已发现但尚未渲染的文章 path 集合（跨运行续爬，保证全量不丢页）
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
            base["pending"] = set(data.get("pending", []))
            base["recheck_idx"] = data.get("recheck_idx", 0)
            base["completed_at"] = data.get("completed_at")
            return base
        except Exception as e:
            print(f"::warning:: 状态文件损坏，重置：{e}", file=sys.stderr)
    return default_state()


def _json_default(o):
    # 状态文件可能含 set（pending），JSON 无法直接序列化，转成排序列表
    if isinstance(o, set):
        return sorted(o)
    if isinstance(o, Path):
        return str(o)
    return str(o)


def save_state(path: Path, state):
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2,
                                default=_json_default), encoding="utf-8")


def drain_frontier(page, raw_docs, save_page, state, counter):
    """排空「待处理文章队列」（状态文件中的 pending，已持久化）。

    关键设计：发现的文章 URL 先进入 pending（写入 .crawl-state.json），本函数按
    每日上限渲染其中一部分；未渲染的与本次新发现的都留在 pending，下次运行继续排空。
    这样即使单日达到 MAX_PAGES_PER_RUN 上限，也不会丢失任何已发现的文章——
    保证「整个网站全量备份」的目标（旧版用局部变量导致已发现文章被丢弃）。
    """
    # 按分类分桶后 round-robin 排空，避免某一大类（如 xiaodigu）因字母序靠前且
    # 队列庞大，把单轮 MAX_PAGES_PER_RUN 预算吃光，导致靠后的分类（zuankeba/
    # xinzuanba）文章永远排不到而被“饿死”（既没 crawled 也没 dead，下次仍 0 篇）。
    def _slug(p):
        return (p.strip("/").split("/")[0] or "_")

    buckets = {}
    for p in state["pending"]:
        buckets.setdefault(_slug(p), []).append(p)
    for k in buckets:
        buckets[k].sort()
    ptr = {k: 0 for k in buckets}
    active = deque(k for k in buckets if buckets[k])
    seen = set(state["crawled"].keys())
    while active and counter[0] < MAX_PAGES_PER_RUN:
        k = active.popleft()
        if ptr[k] >= len(buckets[k]):
            continue
        path = buckets[k][ptr[k]]
        ptr[k] += 1
        if ptr[k] < len(buckets[k]):
            active.append(k)
        state["pending"].discard(path)
        if path in seen or is_dead(state, path):
            continue
        seen.add(path)
        url = TARGET + path
        ok, rendered, raw = render_page(page, url, path, raw_docs, state)
        if not ok:
            continue
        save_page(path, rendered, "article")
        if CRAWL_DELAY_MS > 0:
            time.sleep(CRAWL_DELAY_MS / 1000.0)
        for a in discover_article_links(raw if raw else rendered, url):
            ap = urlparse(a).path
            if ap not in seen and ap not in state["crawled"] and not is_dead(state, ap):
                sk = _slug(ap)
                if sk not in buckets:
                    buckets[sk] = []
                    ptr[sk] = 0
                    active.append(sk)
                buckets[sk].append(ap)
                state["pending"].add(ap)


# 检查点计数（模块级，供 save_page 闭包累加后触发 checkpoint）
_pages_since_ckpt = 0


def _git(*args):
    """包装 git 调用；失败返回带 stderr 的 CompletedProcess（不抛异常）。"""
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True,
                              timeout=120)
    except Exception as e:  # 超时 / git 不存在
        return subprocess.CompletedProcess(args, 1, "", str(e))


def checkpoint(state, note=""):
    """把已爬进度（状态文件 + 新页面）提交并推送到 GitHub。

    作用：即便本次运行被手动取消或崩溃，已提交的进度会保留，次日从断点继续、
    不重复爬取。非 git 工作区（如本地无仓库）时仅落地状态文件、跳过提交。
    """
    global _pages_since_ckpt
    _pages_since_ckpt = 0
    try:
        save_state(OUT_DIR / ".crawl-state.json", state)
    except Exception as e:
        print(f"::warning:: 状态保存失败: {e}", file=sys.stderr)
    # 仅当处于 git 工作区才尝试提交
    if _git("rev-parse", "--is-inside-work-tree").stdout.strip() != "true":
        return
    _git("add", "xianbao/")
    if _git("diff", "--cached", "--quiet").returncode == 0:
        return  # 无变更，无需提交
    msg = (f"mirror checkpoint: {state['mode']} "
           f"累计{len(state['crawled'])} 失效{len(state.get('dead', {}))} {note}").strip()
    c = _git("commit", "-m", msg)
    if c.returncode != 0:
        print(f"::warning:: checkpoint 提交失败: {c.stderr[:200]}", file=sys.stderr)
        return
    # 与远端同步后再推送，避免非快进拒绝（不同步也尝试，失败留待下次 checkpoint）
    _git("pull", "--rebase", "origin", "main")
    p = _git("push", "origin", "main")
    if p.returncode != 0:
        print(f"::warning:: checkpoint 推送失败（下次重试）: {p.stderr[:200]}",
              file=sys.stderr)


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
  var params=new URLSearchParams(window.location.search);
  var initial=params.get('q');
  if(initial){{ q.value=initial; go(); }}
}).catch(function(e){
  document.getElementById('r').innerHTML='<p>搜索索引加载失败：'+e+'</p>';
});
</script>
</body>
</html>
"""


def build_search_index(out_dir: Path):
    items = []
    for idx, p in enumerate(out_dir.rglob("*.html")):
        rel = p.relative_to(out_dir).as_posix()
        if not ART_RE.match("/" + rel):
            continue
        try:
            html = p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        soup = BeautifulSoup(html, "html.parser")
        title = (soup.title.get_text(strip=True) if soup.title else "") or rel
        title = title.replace("线报酷镜像", "").replace("线报酷", "").strip().strip("-").strip() or rel
        for t in soup(["script", "style"]):
            t.decompose()
        main = (soup.select_one("#post-content, .post-content, article .content, "
                                ".article-content, #article_content, .content")
                or soup.body)
        text = main.get_text(" ", strip=True) if main else ""
        items.append({
            "id": str(idx + 1),
            "title": title,
            "url": "/" + rel,
            "body": text[:300],
        })
    items.sort(key=lambda x: x["title"])
    (out_dir / "search.json").write_text(
        json.dumps(items, ensure_ascii=False), encoding="utf-8")
    (out_dir / "search.html").write_text(SEARCH_HTML, encoding="utf-8")
    return len(items)


def _build_panel(cat_id: str, cat_label: str, items: list) -> str:
    if not items:
        content = '<div class="empty">暂无文章</div>'
    else:
        lis = []
        for it in items:
            title = it["title"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
            lis.append(
                f'<div class="it"><a href="{it["url"]}">{title}</a></div>')
        content = '<div class="list">' + "\n".join(lis) + '</div>'
    active = " active" if cat_id == "all" else ""
    return (
        f'<div id="{cat_id}" class="panel{active}">\n'
        f'  <h2 style="font-size:18px;margin:0 0 12px">{cat_label}'
        f'<span class="count">{len(items)} 篇</span></h2>\n'
        f'  {content}\n'
        f'</div>'
    )


def build_hub(out_dir: Path):
    """生成首页：顶部标签切换分类，下方列出各分类文章（含评论链接）。"""
    cat_names = {
        "zuankeba": "赚客吧",
        "xinzuanba": "新赚客吧",
        "xiaodigu": "小嘀咕",
        "huluxia": "葫芦侠",
        "xiaodao": "小刀",
    }
    by_cat = {s: [] for s in ALLOWED_CATEGORIES}
    for p in out_dir.rglob("*.html"):
        rel = p.relative_to(out_dir).as_posix()
        if not ART_RE.match("/" + rel):
            continue
        try:
            html = p.read_text(encoding="utf-8", errors="replace")
            soup = BeautifulSoup(html, "html.parser")
            title = (soup.title.get_text(strip=True) if soup.title else rel)
            title = title.replace("线报酷镜像", "").replace("线报酷", "").strip().strip("-").strip()
        except Exception:
            title = rel
        if not title:
            title = rel
        m = re.search(r"/([^/]+)/(\d+)\.html$", "/" + rel)
        if not m:
            continue
        cat, art_id = m.group(1), int(m.group(2))
        if cat in by_cat:
            by_cat[cat].append({"id": art_id, "url": "/" + rel, "title": title})

    # 每分类按文章 ID 降序（最新在前）
    for cat in by_cat:
        by_cat[cat].sort(key=lambda x: x["id"], reverse=True)

    all_items = []
    for cat in ALLOWED_CATEGORIES:
        all_items.extend(by_cat[cat])
    all_items.sort(key=lambda x: x["id"], reverse=True)

    tabs = ['<span class="tab active" data-cat="all">全部</span>']
    panels = [_build_panel("all", "全部", all_items[:25])]
    for cat in ALLOWED_CATEGORIES:
        tabs.append(f'<span class="tab" data-cat="{cat}">{cat_names[cat]}</span>')
        panels.append(_build_panel(cat, cat_names[cat], by_cat[cat][:25]))

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>线报酷镜像</title>
<link rel="stylesheet" href="/lib/xianbao-override.css">
<style>
body{{font-family:system-ui,"Microsoft YaHei",sans-serif;background:#f6f7fb;color:#222;margin:0}}
.wrap{{max-width:900px;margin:0 auto;padding:24px 16px}}
h1{{font-size:24px;margin:0 0 8px}}
.desc{{color:#666;margin:0 0 18px}}
.search-bar{{display:flex;gap:10px;margin-bottom:18px;max-width:520px}}
.search-bar input{{flex:1;padding:12px 16px;font-size:15px;border:1px solid #d7dbe5;border-radius:12px;outline:none}}
.search-bar input:focus{{border-color:#1f4fd6;box-shadow:0 0 0 3px rgba(31,79,214,.12)}}
.search-bar button{{padding:0 20px;background:#1f4fd6;color:#fff;border:none;border-radius:12px;font-size:15px;cursor:pointer}}
.search-bar button:hover{{background:#1746b8}}
.tabs{{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}}
.tab{{padding:8px 16px;border-radius:20px;background:#fff;border:1px solid #d7dbe5;cursor:pointer;font-size:14px;transition:all .2s}}
.tab:hover{{border-color:#1f4fd6;color:#1f4fd6}}
.tab.active{{background:#1f4fd6;color:#fff;border-color:#1f4fd6}}
.panel{{display:none}}
.panel.active{{display:block}}
.list{{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.05);overflow:hidden}}
.it{{padding:14px 16px;border-bottom:1px solid #eceef3}}
.it:last-child{{border-bottom:none}}
.it a{{color:#222;text-decoration:none;font-size:16px;font-weight:600}}
.it a:hover{{color:#1f4fd6;text-decoration:underline}}
.it .meta{{color:#999;font-size:12px;margin-top:4px}}
.empty{{padding:30px;text-align:center;color:#999}}
.count{{color:#999;font-size:13px;margin-left:8px}}
</style>
</head>
<body>
<div class="wrap">
  <h1>线报酷镜像</h1>
  <p class="desc">本镜像仅增量备份 5 个分类（每日更新，含评论）。</p>
  <div class="search-bar">
    <input type="text" id="searchInput" placeholder="输入关键词，如 红包 / 活动 / 教程…">
    <button id="searchBtn">搜索</button>
  </div>
  <div class="tabs">
{chr(10).join('    ' + t for t in tabs)}
  </div>
{chr(10).join(panels)}
</div>
<script>
function doSearch(){{
  var q = document.getElementById('searchInput').value.trim();
  if (q) {{ window.location.href = '/search.html?q=' + encodeURIComponent(q); }}
}}
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keydown', function(e){{
  if (e.key === 'Enter') {{ doSearch(); }}
}});
document.querySelectorAll('.tab').forEach(function(tab){{
  tab.addEventListener('click', function(){{
    var cat = this.dataset.cat;
    document.querySelectorAll('.tab').forEach(function(t){{ t.classList.remove('active'); }});
    document.querySelectorAll('.panel').forEach(function(p){{ p.classList.remove('active'); }});
    this.classList.add('active');
    document.getElementById(cat).classList.add('active');
  }});
}});
</script>
</body>
</html>"""
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
    cat_slug = slug_from_path(path)
    raw = raw_docs.get(local, "")
    is_redirect = bool(extract_refresh_tag(raw))
    dom = None

    if is_redirect:
        rendered = rewrite_html(raw, cat_slug=cat_slug)
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
        rendered = rewrite_html(dom, cat_slug=cat_slug)
        if raw and not is_redirect:
            tag = extract_refresh_tag(raw)
            if tag:
                rendered = inject_refresh(rendered, fix_refresh_tag(tag))
    # 文章页：剥离站外模板，使镜像自包含（分类内链接已为本地路径）
    if local and ART_RE.match("/" + local):
        cat_slug = local.split("/")[0]
        rendered = strip_chrome(rendered, cat_slug=cat_slug)
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
    counter = [0]          # 本轮已渲染页面数（受 MAX_PAGES_PER_RUN 约束）
    run_start_ts = _now_ts()  # 本轮起始时间戳，供后处理只扫描「本轮新产生」的文件

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
                counter[0] += 1
                # 检查点提交：每渲染 CHECKPOINT_EVERY 页就把进度推到 GitHub，
                # 中途取消/崩溃也不丢进度，次日从断点继续（不重复爬）。
                global _pages_since_ckpt
                _pages_since_ckpt += 1
                if CHECKPOINT_EVERY > 0 and _pages_since_ckpt >= CHECKPOINT_EVERY:
                    checkpoint(state, path)

            # ---- 通用：各分类第 1 页捕获新发布帖（crawl / maintenance 均执行）----
            for slug in ALLOWED_CATEGORIES:
                path = f"/category-{slug}/"
                url = TARGET + path
                ok, rendered, raw = render_page(page, url, path, raw_docs, state)
                if not ok:
                    continue
                save_page(path, rendered, "list")
                if CRAWL_DELAY_MS > 0:
                    time.sleep(CRAWL_DELAY_MS / 1000.0)
                for a in discover_article_links(raw if raw else rendered, url):
                    ap = urlparse(a).path
                    if ap not in state["crawled"]:
                        state["pending"].add(ap)

            if state["mode"] == "crawl":
                cap_hit = False
                for slug in ALLOWED_CATEGORIES:
                    if state["category_exhausted"][slug]:
                        continue
                    start = state["category_cursor"][slug]
                    end = start + PAGES_PER_RUN_PER_CAT - 1
                    for n in range(start, end + 1):
                        if n == 1:
                            # 第 1 页已在上方通用步骤处理，避免重复渲染
                            continue
                        if n > MAX_CAT_PAGES:
                            state["category_exhausted"][slug] = True
                            break
                        path = f"/category-{slug}/{n}/"
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
                        if counter[0] >= MAX_PAGES_PER_RUN:
                            state["category_cursor"][slug] = n + 1
                            cap_hit = True
                            break
                        if CRAWL_DELAY_MS > 0:
                            time.sleep(CRAWL_DELAY_MS / 1000.0)
                        fresh_found = False
                        for a in discover_article_links(raw if raw else rendered, url):
                            ap = urlparse(a).path
                            if ap not in state["crawled"]:
                                state["pending"].add(ap)
                                fresh_found = True
                        if fresh_found:
                            state["category_miss"][slug] = 0
                        else:
                            state["category_miss"][slug] += 1
                            if state["category_miss"][slug] >= CONSEC_MISS_LIMIT:
                                state["category_exhausted"][slug] = True
                                print(f"==> 分类 {slug} 判定已抓完（连续无新文章）")
                                break
                    if not cap_hit:
                        state["category_cursor"][slug] = end + 1
                    if cap_hit:
                        break
                # 所有分类已抓完 且 待处理队列清空 -> 转 maintenance
                if (all(state["category_exhausted"][s] for s in ALLOWED_CATEGORIES)
                        and not state["pending"]):
                    state["mode"] = "maintenance"
                    state["completed_at"] = _now()
                    print("==> 全部分类抓取完成，进入 maintenance（维护/增量更新）模式")

            # ---- 排空待处理队列（跨运行续爬，保证全量备份不丢页）----
            drain_frontier(page, raw_docs, save_page, state, counter)

            # ---- maintenance：抽样复查已抓文章（检测新评论/内容更新）----
            if state["mode"] == "maintenance":
                paths = list(state["crawled"].keys())
                if paths:
                    idx = state["recheck_idx"] % len(paths)
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
                        if counter[0] >= MAX_PAGES_PER_RUN:
                            break
                        if CRAWL_DELAY_MS > 0:
                            time.sleep(CRAWL_DELAY_MS / 1000.0)
        finally:
            browser.close()

    # 落地索引与首页 hub
    n_idx = build_search_index(OUT_DIR)
    build_hub(OUT_DIR)

    # 后处理：补全缺失资源 + 剥离注入/分析脚本
    # （仅扫描本轮新产生的文件，避免随镜像增长而每轮全量重扫导致超时）
    fill_missing(state, since=run_start_ts)
    stripped = strip_injection_scripts(set(), since=run_start_ts)
    stripped_analytics = strip_analytics_scripts(since=run_start_ts)

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
        "pages_rendered_this_run": counter[0],
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

    print(f"==> 渲染完成：本轮渲染 {counter[0]} 页，已抓总计 {len(state['crawled'])} 个，"
          f"搜索索引 {n_idx} 条，模式={state['mode']}，"
          f"失效页记录 {len(state.get('dead', {}))} 个 / 失效资源 {len(state.get('dead_assets', {}))} 个，"
          f"HTML 校验 {_html_count} 个，输出目录 {OUT_DIR}")


def _is_relative_ref(ref):
    return not ref.startswith(("http://", "https://", "/", "//", "data:",
                                "javascript:", "mailto:", "tel:", "#"))


def fill_missing(state=None, raw_url_map=None, since=None):
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
        if since is not None:
            try:
                if os.path.getmtime(fp) < since:
                    continue
            except OSError:
                continue
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
            absu = urljoin(ORIGIN, ref)
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


def strip_injection_scripts(raw_saved=None, since=None):
    """剥离 document.write/writeln 注入型脚本标签（注入内容已烘焙进 DOM）。"""
    if raw_saved is None:
        raw_saved = set()
    js_files = glob.glob(str(OUT_DIR / "**" / "*.js"), recursive=True)
    injection_basenames = set()
    for jf in js_files:
        if since is not None:
            try:
                if os.path.getmtime(jf) < since:
                    continue
            except OSError:
                continue
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
        if since is not None:
            try:
                if os.path.getmtime(hf) < since:
                    continue
            except OSError:
                continue
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


def strip_analytics_scripts(since=None):
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
        if since is not None:
            try:
                if os.path.getmtime(hf) < since:
                    continue
            except OSError:
                continue
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
