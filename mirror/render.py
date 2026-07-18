#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mirror/render.py — 基于 Playwright 无头浏览器的整站渲染镜像脚本（xianbao.fun 适配版）

目标站点 new.xianbao.fun 是 Z-BlogPHP（线报酷主题），特性：
  - 列表页为服务端渲染（首页 /page/N/ 分页，尾页约 1298 页，全站文章约 6.5 万篇）。
  - 文章页带「评论」，且评论为 **AJAX 动态加载**（初始 HTML 中 #AjaxCommentBegin
    为空容器），需等 JS 把评论注入 DOM 后才能完整抓取。
  - 图片等多存于外部 CDN（v.yuebuy.cn 等），本脚本**仅下载同源资源**，
    外链资源保持热链（与 qke.net 策略一致，控制仓库体积）。

相比 qke.net 版的变化：
  1. 默认目标 / 输出目录 / 部署前缀改为 xianbao.fun / xianbao / "/"（根域名部署）。
  2. 去掉多语言别名与独立移动页逻辑（xianbao 为响应式单版本）。
  3. 新增「分页上限」：仅收录 /page/N/ 与 /<分类>/page/N/ 中 N<=RECENT_LIST_PAGES
     的页码，避免爬虫顺着尾页一路抓到全站，把预算留给近期内容（详见 README）。
  4. 文章页渲染后**等待 AJAX 评论注入**再抓取 DOM（networkidle + 短暂 settle）。
  5. 通用化第三方统计脚本剥离（51.la / Clarity / 百度 / Google / CNZZ / Matomo）。

依赖：playwright、beautifulsoup4
浏览器：默认自动下载的 chromium；可用环境变量覆盖：
  - PLAYWRIGHT_BROWSERS_PATH
  - PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH（Vercel/Netlify serverless 等已内置 chromium 的环境）

可调环境变量：
  TARGET_URL          目标站点根（默认 https://new.xianbao.fun）
  OUT_DIR             输出目录（默认 xianbao）
  PAGES_PREFIX        部署路径前缀（默认 / ；GitHub Pages 项目页改为 /<repo>）
  MAX_PAGES           最大抓取页面数（默认 3000）
  RECENT_LIST_PAGES   仅收录前 N 页分页（默认 50，控制抓取范围）
  NAV_TIMEOUT_MS      单页导航超时（默认 30000）
  CRAWL_DELAY_MS      每页之间的礼貌延时（默认 200）
  COMMENT_WAIT_MS     评论等待上限（默认 6000）
"""
import os
import re
import sys
import time
import json
import ssl
import glob
import urllib.request
from pathlib import Path
from urllib.parse import urlparse, unquote, urljoin
from collections import deque

from bs4 import BeautifulSoup, Doctype, NavigableString
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
TARGET = os.environ.get("TARGET_URL", "https://new.xianbao.fun").rstrip("/")
OUT_DIR = Path(os.environ.get("OUT_DIR", "xianbao"))
ORIGIN = TARGET
ORIGIN_NETLOC = urlparse(TARGET).netloc
# 部署到 Vercel / Netlify 等根域名时前缀为 /；GitHub Pages 项目页改为 /<repo>。
PAGES_PREFIX = os.environ.get("PAGES_PREFIX", "/")

MAX_PAGES = int(os.environ.get("MAX_PAGES", "3000"))
RECENT_LIST_PAGES = int(os.environ.get("RECENT_LIST_PAGES", "50"))
NAV_TIMEOUT_MS = int(os.environ.get("NAV_TIMEOUT_MS", "30000"))
CRAWL_DELAY_MS = int(os.environ.get("CRAWL_DELAY_MS", "200"))
COMMENT_WAIT_MS = int(os.environ.get("COMMENT_WAIT_MS", "6000"))

# 种子：仅首页。BFS 会自动顺着被「分页上限」约束过的 /page/N/ 抓取近期内容，
# 文章链接主要来自首页与各近期列表页，从而把预算集中在最新内容上。
SEEDS = [TARGET + "/"]

TEXT_EXT = {".html", ".htm", ".css", ".js", ".mjs", ".json", ".xml",
            ".svg", ".txt", ".map", ".webmanifest", ".php"}

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
# URL -> 本地路径
# ---------------------------------------------------------------------------
def url_to_local(url: str):
    p = urlparse(url)
    if p.netloc and p.netloc != ORIGIN_NETLOC:
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


def fix_url(val: str) -> str:
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
        if parsed.netloc != ORIGIN_NETLOC:
            return v + ("#" + frag if frag else "")
        path = parsed.path or "/"
    elif v.startswith("/"):
        path = v
    else:
        return v + ("#" + frag if frag else "")
    base, ext = os.path.splitext(path)
    if ext == "" and not path.endswith("/"):
        path = path + ".html"
    if PAGES_PREFIX.endswith("/") and path.startswith("/"):
        path = path[1:]
    return PAGES_PREFIX + path + ("#" + frag if frag else "")


def discover_links(html: str, base_url: str):
    """从 HTML 提取站内链接，返回绝对 origin URL 列表（已去除分页超界项）。"""
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
        if href.startswith(PAGES_PREFIX):
            href = href[len(PAGES_PREFIX):]
            if href == "":
                href = "/"
            elif not href.startswith("/") and not href.startswith(("http://", "https://")):
                href = "/" + href
        if href.startswith("http://") or href.startswith("https://"):
            if urlparse(href).netloc != ORIGIN_NETLOC:
                continue
            absu = href
        elif href.startswith("/"):
            absu = ORIGIN + href
        else:
            absu = urljoin(base_url, href)
            if urlparse(absu).netloc != ORIGIN_NETLOC:
                continue
        if os.path.splitext(urlparse(absu).path)[1].lower() in SKIP_EXT:
            continue
        clean = absu.split("#")[0]
        if clean.endswith("/"):
            clean = clean[:-1]
        # 分页上限：/page/N/ 或 /<分类>/page/N/ 中 N > RECENT_LIST_PAGES 的页码不收录，
        # 避免爬虫一路抓到全站尾页（约 6.5 万篇），把预算留给近期内容。
        pm = re.search(r"/page/(\d+)/?$", clean)
        if pm and int(pm.group(1)) > RECENT_LIST_PAGES:
            continue
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


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    visited = set()
    queue = deque()
    for s in SEEDS:
        if s not in visited:
            visited.add(s)
            queue.append(s)

    saved_assets = set()
    raw_docs = {}
    pages_saved = 0
    assets_saved = 0

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
                nonlocal assets_saved
                url = response.url
                if urlparse(url).netloc != ORIGIN_NETLOC:
                    return
                rt = response.request.resource_type
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
                if rt == "document":
                    try:
                        raw_docs[local] = body.decode("utf-8", errors="replace")
                    except Exception:
                        pass
                    return
                if local in saved_assets:
                    return
                outp = OUT_DIR / local
                outp.parent.mkdir(parents=True, exist_ok=True)
                try:
                    if is_text(url, ctype):
                        text = body.decode("utf-8", errors="replace")
                        outp.write_text(rewrite_text_asset(text, url), encoding="utf-8")
                    else:
                        outp.write_bytes(body)
                    saved_assets.add(local)
                    assets_saved += 1
                except Exception as e:
                    print(f"::warning:: 资源保存失败 {url}: {e}", file=sys.stderr)

            page.on("response", on_response)

            while queue and len(visited) < MAX_PAGES:
                url = queue.popleft()
                _nav_ok = False
                for _attempt in range(3):
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
                        _nav_ok = True
                        break
                    except PWTimeout:
                        print(f"::warning:: 导航超时（第 {_attempt+1}/3 次）{url}", file=sys.stderr)
                    except Exception as e:
                        print(f"::warning:: 导航失败（第 {_attempt+1}/3 次）{url}: {e}", file=sys.stderr)
                    if _attempt < 2:
                        time.sleep(2 ** _attempt)
                if not _nav_ok:
                    continue

                local = url_to_local(url)
                if local is None:
                    continue

                raw = raw_docs.get(local, "")
                is_redirect = bool(extract_refresh_tag(raw))
                dom = None

                if is_redirect:
                    rendered = rewrite_html(raw)
                else:
                    # 评论为 AJAX 加载（Z-BlogPHP）：文章页先等待评论注入完成，再抓取 DOM。
                    # 用 networkidle + 短暂 settle，避免无评论页无限空等。
                    if url.rstrip("/").endswith(".html"):
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

                outp = OUT_DIR / local
                outp.parent.mkdir(parents=True, exist_ok=True)
                outp.write_text(rendered, encoding="utf-8")
                pages_saved += 1
                print(f"  [page] {url} -> {local}" + ("  (重定向页)" if is_redirect else ""))

                found = discover_links(raw if raw else "", url)
                if dom:
                    found += discover_links(dom, url)
                for abs_url in found:
                    if abs_url not in visited and len(visited) < MAX_PAGES:
                        visited.add(abs_url)
                        queue.append(abs_url)

                if CRAWL_DELAY_MS > 0:
                    time.sleep(CRAWL_DELAY_MS / 1000.0)

        finally:
            browser.close()

    filled = fill_missing({})
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

    meta = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "target": TARGET,
        "pages": pages_saved,
        "assets": assets_saved,
        "filled": filled,
        "stripped_scripts": stripped,
        "stripped_analytics": stripped_analytics,
        "html_count": _html_count,
    }
    (OUT_DIR / ".mirror-meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"==> 渲染完成：页面 {pages_saved} 个，资源 {assets_saved} 个（补全 {filled}），"
          f"剥离脚本 {stripped} 个，分析脚本 {stripped_analytics} 个，"
          f"HTML 校验 {_html_count} 个，输出目录 {OUT_DIR}")


def _is_relative_ref(ref):
    return not ref.startswith(("http://", "https://", "/", "//", "data:",
                                "javascript:", "mailto:", "tel:", "#"))


def fill_missing(raw_url_map=None):
    """扫描已保存文件中所有站内引用，下载 Playwright 未捕获的缺失资源。"""
    import urllib.request as _ur
    if raw_url_map is None:
        raw_url_map = {}
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
                if urlparse(resolved).netloc == ORIGIN_NETLOC:
                    refs.add(resolved)
        for m in re.findall(r'srcset\s*=\s*["\']([^"\']+)["\']', text):
            for part in m.split(","):
                toks = part.strip().split()
                if toks:
                    refs.add(toks[0])
                    if base_url and _is_relative_ref(toks[0]):
                        resolved = urljoin(base_url, toks[0])
                        if urlparse(resolved).netloc == ORIGIN_NETLOC:
                            refs.add(resolved)
        for m in re.findall(r'url\(\s*["\']?([^)"\']+)["\']?\s*\)', text):
            refs.add(m)
            if base_url and _is_relative_ref(m):
                resolved = urljoin(base_url, m)
                if urlparse(resolved).netloc == ORIGIN_NETLOC:
                    refs.add(resolved)
    ctx = ssl.create_default_context()
    req_hd = {"User-Agent": USER_AGENT, "Accept-Language": "zh-CN,zh;q=0.9"}
    count = 0
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
            if urlparse(ref).netloc != ORIGIN_NETLOC:
                continue
            absu = ref
        elif ref.startswith("/"):
            absu = ORIGIN + ref
        else:
            continue
        absu = absu.split("#")[0]
        local = url_to_local(absu)
        if not local or (OUT_DIR / local).exists():
            continue
        body = None
        ctype = ""
        for _attempt in range(3):
            try:
                req = _ur.Request(absu, headers=req_hd)
                with _ur.urlopen(req, timeout=30, context=ctx) as r:
                    body = r.read()
                ctype = r.headers.get("content-type", "")
                break
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
    """剥离第三方统计脚本（51.la / Clarity / 百度 / Google / CNZZ / Matomo 等），
    避免每日渲染顺序/重复变化导致的无意义 git diff 噪音。镜像站点的导航、布局与
    已烘焙进 DOM 的注入内容均不依赖它们，移除不影响任何功能。"""
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
