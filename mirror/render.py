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
import shutil
import hashlib
import random
import mimetypes
import subprocess
import urllib.request
from pathlib import Path
from urllib.parse import (urlparse, unquote, urljoin, quote, parse_qs,
                          urlunparse)
from collections import deque
import codecs

from bs4 import BeautifulSoup, Doctype, NavigableString, Comment
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
_ur = urllib.request  # 补全下载用的 urllib 别名

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
# 仅镜像这 5 个分类（slug 白名单）。分类列表页 /category-<slug>/ 与文章页
# /<slug>/<数字ID>.html 都会被收录，其余一律排除。
ALLOWED_CATEGORIES = ["zuankeba", "xinzuanba", "xiaodigu", "huluxia", "xiaodao"]
CAT_LABELS = {
    "zuankeba": "赚客吧",
    "xinzuanba": "新赚吧",
    "xiaodigu": "小嘀咕",
    "huluxia": "葫芦侠三楼",
    "xiaodao": "小刀娱乐网",
}

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

# 无歧义“源站家族”域名：这些是源站后端（门户/论坛/各分类原始后端），不是电商或活动，
# 任何位置的 <a href> 都应中和，避免点击离开镜像。www.x6d.com 已纳入——对 xiaodao 分类
# 它既是源站后端又是优惠内容链接，用户明确要求 xiaodao 完全不跳源站（连优惠也留站内），
# 故按域名整体中和（xiaodao 优惠链接因此不再可点）。
SOURCE_HOST_RE = re.compile(
    r"^(?:new|news)\.(?:xianbao\.fun|ixbk\.(?:net|fun))$"
    r"|^(?:app\.xdglt\.com|app\.xiaodigu\.cn|www\.zuanke8\.com|www\.x6d\.com"
    r"|v1\.xianbao\.net|v2\.xianbao\.net)$"
    r"|^(?:[a-z0-9-]+\.)*xianbao\.net$"
    r"|^(?:[a-z0-9-]+\.)*ixbk\.(?:net|fun)$"
    # 源站家族其余子域（h5.xdglt.com / m.xiaodigu.cn 等）：一并中和，避免点击跳回源站
    r"|^(?:[a-z0-9-]+\.)*xdglt\.com$"
    r"|^(?:[a-z0-9-]+\.)*xiaodigu\.cn$",
    re.I,
)


def _looks_like_domain_lock(text: str) -> bool:
    """识别源站「域名锁定 / 防盗链」重定向脚本。

    源站（new.xianbao.fun 等）在文章页注入一段内联脚本：检测当前 hostname 是否在其
    官方域名列表内，不在就把访客 ``window.location.href = "http://new.xianbao.fun"``
    甩回源站。该脚本常做 hex 混淆（如 ``window["\\x6c\\x6f..."]["\\x68\\x72..."]``），
    原样搬进镜像后会让文章页一加载就跳回源站。对镜像毫无意义，必须删除。

    判定：内联脚本同时含 ``hostname``、``location``、某源站域名，且把 location 赋值为
    http(s) 源站 URL（方括号或点号记法均可）。
    """
    try:
        _dec = codecs.decode(text, "unicode_escape")
    except Exception:
        _dec = text
    _c = text + "\n" + _dec
    if not ("hostname" in _c and "location" in _c):
        return False
    if not re.search(r"(xianbao|ixbk|xiaodigu|xdglt|zuanke8|x6d)", _c, re.I):
        return False
    # 把 location（任意记法：window.location.href / window["location"]["href"]）
    # 赋值为 http(s):// 源站 URL，即视为域名锁定重定向脚本。
    if re.search(r'location.{0,30}=.{0,6}https?://', _c, re.I):
        return True
    return False


def strip_source_addr(html: str) -> str:
    """外科手术式删除「原文地址：/ 阅读原文 / 查看原文」整行（<div>/<p> 包裹的
    ``<strong>`` + 源站链接）。对镜像无意义且暴露源站，用户要求删除。仅删除匹配块、
    不影响文档其余字节（无 favicon / analytics 漂移）。用于已提交 HTML 的就地清理。"""
    html = re.sub(
        r'<div[^>]*>\s*<strong[^>]*>\s*(?:原文地址|阅读原文|查看原文)[^<]*</strong>.*?</div>',
        '', html, flags=re.S)
    html = re.sub(
        r'<p[^>]*>\s*<strong[^>]*>\s*(?:原文地址|阅读原文|查看原文)[^<]*</strong>.*?</p>',
        '', html, flags=re.S)
    return html


def strip_common_js(html: str) -> str:
    """外科手术式删除源站主题 ``common.js`` 引用。该脚本在移动端会重新初始化评论控件，
    并把文本节点中的 URL 自动链接化，破坏 ``.author`` 链接结构，导致用户名显示异常、
    同时出现两个「顺序」按钮。仅删除匹配脚本标签，不影响文档其余字节。"""
    return re.sub(
        r'<script[^>]*src="[^"]*common\.js[^"]*"[^>]*>\s*</script>',
        '', html, flags=re.S | re.I)


def strip_push_scripts(html: str) -> str:
    """外科手术式删除源站实时推送脚本（``meta.php``）。该脚本是源站动态端点，
    内容为：调用未定义的 ``initGM``、启动 ``/plus/worker.js`` 实时推送、重新注入
    已剥离的源站侧栏（SidebarModule「十二小时榜」）与置顶公告——在静态镜像上
    全部失效或破坏自包含（2026-09-05 全站体检发现每篇必现 initGM ReferenceError）。
    ⚠️ 注意：``c_html_js_add.php`` 虽也是 .php 后缀，但它是爬虫落盘的**合法静态
    资产**（定义 zbpConfig/zbp，dark-mode.js 等主题脚本依赖），必须保留——
    「删除所有 .php 脚本」会引入 zbp is not defined（体检复测踩坑）。"""
    return re.sub(
        r'<script[^>]*src="[^"]*meta\.php[^"]*"[^>]*>\s*</script>',
        '', html, flags=re.S | re.I)


def localize_iconfont(html: str) -> str:
    """把源站 iconfont 外链（at.alicdn.com 的 CSS 与字体）替换为本地副本
    ``/lib/iconfont.css``，并删除对应的 dns-prefetch。外部 CDN 偶发超时会让
    全站图标显示为方框/空白（woff2 加载 ERR_TIMED_OUT 实测复现）。"""
    html = html.replace(
        '<link href="https://at.alicdn.com/t/c/font_1640420_ez6c8oh0s95.css" rel="stylesheet"/>',
        '<link href="/lib/iconfont.css?v=1" rel="stylesheet"/>')
    html = html.replace(
        '<link href="https://at.alicdn.com/" rel="dns-prefetch"/>', '')
    return html


def strip_breadcrumb_icon(html: str) -> str:
    """外科手术式把面包屑分隔符 ``<i class="iconfont icon-right"></i>`` 替换为文本
    「 › 」，避免依赖外部 iconfont CDN（at.alicdn.com）导致分隔符不显示、面包屑挤成
    「首页赚客吧文章正文」一团。用于已提交 HTML 的就地清理。"""
    return re.sub(r'<i[^>]*class="[^"]*icon-right[^"]*"[^>]*>\s*</i>', ' › ', html)


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
# 每渲染多少页做一次「检查点提交」（只做本地 commit 并落地状态文件，不 push，
# 以免每个检查点都触发一次线上部署），使中途取消/崩溃也不丢进度、次日不重复爬。
# 默认 120（此前默认为 0，即关闭检查点；CI 已显式设为 120，此处对齐以免本地
# 运行时因缺少环境变量而丢失整轮进度）。0 = 关闭检查点（仅跑完才落盘）。
CHECKPOINT_EVERY = int(os.environ.get("CHECKPOINT_EVERY", "120"))
# 分类列表页连续「无新文章」达到此次数，判定该分类已抓完。
CONSEC_MISS_LIMIT = int(os.environ.get("CONSEC_MISS_LIMIT", "3"))
# 单分类列表页安全上限（防止死循环）。
MAX_CAT_PAGES = int(os.environ.get("MAX_CAT_PAGES", "5000"))

# 镜像「分类索引页 / 首页」每页展示的帖子数。
# 刻意与源站列表页每页约 100 帖保持一致（实测源站 category-zuankeba 每页 101 帖、
# 共 152 页），这样镜像的「N 页」与源站「N 页」可直接对比，一眼看出抓取进度差距。
# 改小时会让镜像页数虚高、反而看不清差距；保持 100 才是源站口径。
# 如需覆盖可用环境变量 INDEX_PAGE_SIZE（默认 100）。
INDEX_PAGE_SIZE = int(os.environ.get("INDEX_PAGE_SIZE", "100"))

# 失效地址（永久 404/410）记录：达到阈值后下次不再爬取，减少原站负担与暴露面。
DEAD_FAIL_LIMIT = int(os.environ.get("DEAD_FAIL_LIMIT", "2"))
# 失效记录的存活周期（天）：到期后再试一次（应对源站临时恢复）。0 = 永不过期。
DEAD_TTL_DAYS = int(os.environ.get("DEAD_TTL_DAYS", "90"))

NAV_TIMEOUT_MS = int(os.environ.get("NAV_TIMEOUT_MS", "30000"))
CRAWL_DELAY_MS = int(os.environ.get("CRAWL_DELAY_MS", "200"))
# 延迟上限：实际休眠在 [CRAWL_DELAY_MS, CRAWL_DELAY_MAX_MS] 区间内**随机**取值，
# 避免固定间隔那种过于规整的请求节律被源站识别为爬虫（更像人类访问）。
# 保持原有语义：CRAWL_DELAY_MS=0 仍表示「关闭延迟」（单测依赖该行为）。
CRAWL_DELAY_MAX_MS = int(os.environ.get("CRAWL_DELAY_MAX_MS", "600"))
# 是否跳过文章页的「懒加载滚动」。
# 背景：滚动的本意是触发源站 IntersectionObserver 懒加载，让占位符
# <img src="/plus/api/image.php?imgurl=<真实CDN>> 被 JS 替换为真实地址。
# 但两条证据表明它是冗余的：
#   ① 9/5 全站扫描在**已滚动过**的页面上仍发现 10810 个残留占位符；
#   ② 2026-09-05 真实浏览器 A/B（4 篇真实文章，滚动前后逐一对比 img 的 src）：
#      占位符与非占位符数量**完全无变化**（如 /zuankeba/6956164.html 滚动前后均为
#      占位符=2、其他=101），即滚动未触发任何替换；且页面里 101 个 img 本就是
#      真实 URL，仅 0–2 个是占位符。
# 真正生效的是 localize_images：解析 imgurl 参数后经源站 image.php 代理取图
# （9/5 修复率 99%）。
# 故默认置 1：跳过「滚动 + 其后 1.5s 等待」，约省 2.3s/页（600 页/轮 ≈ 20 分钟）。
# 回退到旧行为：设 SKIP_LAZY_SCROLL=0。
SKIP_LAZY_SCROLL = os.environ.get("SKIP_LAZY_SCROLL", "1") == "1"

TEXT_EXT = {".html", ".htm", ".css", ".js", ".mjs", ".json", ".xml",
            ".svg", ".txt", ".map", ".webmanifest", ".php"}


def _crawl_delay():
    """抓取间隔：在 [CRAWL_DELAY_MS, CRAWL_DELAY_MAX_MS] 区间内随机休眠。

    固定间隔的请求节律过于规整，容易被源站识别为爬虫；随机化后更接近人类访问。
    CRAWL_DELAY_MS=0 时直接返回，保持「关闭延迟」的原有语义（单测依赖）。
    """
    lo = max(0, CRAWL_DELAY_MS)
    if lo <= 0:
        return
    hi = max(lo, CRAWL_DELAY_MAX_MS)
    time.sleep(random.uniform(lo, hi) / 1000.0)

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

# UA 池：每轮运行随机取一个，避免长期以**完全固定**的 UA 请求源站。
# 刻意只在「桌面 Chrome / Windows」这一形态内轮换相近的小版本（124/125/126），
# 不引入移动端或异类浏览器 —— 否则源站可能返回不同版式，反而影响渲染结果。
USER_AGENT_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
]
USER_AGENT = random.choice(USER_AGENT_POOL)

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


# 源站图片懒加载代理：静态 HTML 里 <img src="/plus/api/image.php"> 只是占位符，
# 图片滚动进入视口后由 JS（IntersectionObserver）替换为
# /plus/api/image.php?imgurl=<真实图片URL>。该代理 URL 才是能取到图片字节的地址
# （真实 CDN 做了 Referer 防盗链，直接下载会被 403；必须经源站代理转发）。
# 因此这里把代理 URL 规范化为绝对形式（落在源站主域名上），交给 localize_images
# 通过代理下载、并保存在真实 CDN 路径下，避免不同图片碰撞到同一本地文件。
_IMG_PROXY_RE = re.compile(r"/plus/api/image\.php\b", re.I)


def _proxy_abs_url(val: str):
    """若 val 是源站图片代理 URL（相对 /plus/api/image.php 或绝对均可），
    返回规范化的绝对代理 URL（落在 ORIGIN_NETLOC 上）；否则返回 None。"""
    if not _IMG_PROXY_RE.search(val or ""):
        return None
    m = re.search(r"/plus/api/image\.php\?(.*)$", val, re.I | re.S)
    if not m:
        return None
    qs = parse_qs(m.group(1))
    real = qs.get("imgurl") or qs.get("url")
    if not real:
        return None
    real = unquote(real[0])
    if not real.startswith(("http://", "https://")):
        # 解码后仍是相对/无效地址，放弃还原
        return None
    return "https://" + ORIGIN_NETLOC + "/plus/api/image.php?imgurl=" + quote(real, safe="")


_ABS_URL_RE = re.compile(r"^https?://", re.I)


def _normalize_img_url(u: str) -> str:
    """把「站内相对的图片代理占位符」规范化为绝对 URL；已是绝对 URL 则原样返回。

    背景（后期维护中的真实缺陷）：源站图片走 IntersectionObserver 懒加载，静态 HTML 里
    `<img src="/plus/api/image.php?imgurl=<真实CDN>">` 只是**相对**占位符；镜像站并不存在
    image.php 这个 PHP 代理，直接请求必然 404，表现为「裂图」。而原先的图片本地化只处理
    `http(s)` 绝对 URL，这类相对占位符被整体跳过，导致存量文章图片始终未被本地化
    （实测仅 zuankeba 一个分类就有 6766 篇仍为占位符）。

    规范化后，`_proxy_pair` 即可解析出真实 CDN 并下载到本地，
    存量文章会在后续轮次中被自动修复，无需单独跑回填脚本。
    """
    if not u:
        return u
    if _ABS_URL_RE.match(u):
        return u
    return _proxy_abs_url(u) or u


# 路径中的非法字符（Windows 文件名不允许）以及需要丢弃的路径段
_ILLEGAL_PATH_RE = re.compile(r'[\\:*?"<>|]')
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0"}


def img_rel_path(url: str):
    """外站图片 URL -> 站内保存相对路径（无前缀）。非 http(s) 或本机地址返回 None。

    提取为模块级，供 `localize_images` 与批量修复工具 `fix_images_batch.py` 共用，
    确保两处的**路径 / 命名规则完全一致** —— 若两处规则漂移，同一张图会被存到
    两个不同位置，表现为「明明下载过却依然裂图」，且难以排查。
    """
    p = urlparse((url or "").strip())
    if not p.scheme or not p.netloc:
        return None
    if p.netloc.lower() in _LOCAL_HOSTS:
        return None
    raw_segs = (unquote(p.path or "") or "index").split("/")
    segs = []
    for s in raw_segs:
        s = _ILLEGAL_PATH_RE.sub("_", s)
        # 丢弃空段与 . / ..：既去掉前导斜杠产生的空串，也防止目录穿越与脏名
        if s in ("", ".", ".."):
            continue
        segs.append(s)
    rel = "zb_users/remote/" + p.netloc + "/" + "/".join(segs)
    if rel.endswith("/"):
        rel += "index"
    return rel


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


def _ensure_cursor_pointer(el) -> None:
    """幂等地给元素加上手型指针，避免重复追加导致 style 里出现多个 cursor:pointer。"""
    style = el.get("style", "") or ""
    style = re.sub(r"\s*;?\s*cursor\s*:\s*pointer\s*;?", "", style, flags=re.I).strip(" ;")
    el["style"] = (style + ";cursor:pointer;").lstrip(";") if style else "cursor:pointer;"


def _ensure_display_block(el) -> None:
    """幂等地强制元素可见（去掉 display:none 与重复的 display:block）。"""
    style = el.get("style", "") or ""
    style = re.sub(r"\s*;?\s*display\s*:\s*none\s*;?", "", style, flags=re.I)
    style = re.sub(r"\s*;?\s*display\s*:\s*block\s*;?", "", style, flags=re.I).strip(" ;")
    el["style"] = (style + ";display:block;").lstrip(";") if style else "display:block;"


def _build_article_nav(active_cat: str):
    """构造源站风格的文章页顶部导航（分类标签 + 搜索 + 浅色模式），让文章页
    无需「返回列表」即可在分类间跳转，与首页/分类页一致。

    暗色切换复用 inject_dark_mode_sync 注入的 switchNightMode()；搜索按钮内联
    onclick 展开 search-area（源站 JS 已被剥离，这里自包含实现）；图标字体走
    CDN，离线时不显示，故加「浅色 / 搜索」文字兜底保证可用。
    """
    frag = (
        '<header class="header sb xianbao-article-nav">'
        '<div class="h-wrap container clearfix">'
        '<div class="logo-area fl"><a href="/" title="线报酷">'
        '<img alt="线报酷" class="img" src="/zb_users/theme/xianbao_theme/image/newlogo.png" title="线报酷"/>'
        '</a></div>'
        '<div class="m-nav-btn"><i class="iconfont icon-category"></i></div>'
        '<nav class="responsive-nav">'
        '<div class="pc-nav m-nav fl" data-cateid="16" data-catename="' + active_cat + '" data-type="category">'
        '<ul class="nav-ul">'
        '<li id="nvabar-item-index"><a href="/">首页</a></li>'
    )
    for c in ALLOWED_CATEGORIES:
        cls = "active" if c == active_cat else ""
        frag += ('<li class="' + cls + '" id="navbar-category-' + c + '">'
                 '<a href="/category-' + c + '/">' + CAT_LABELS[c] + '</a></li>')
    frag += (
        '</ul></div></nav>'
        '<a class="dark-mode fr" href="javascript:switchNightMode()" target="_self" title="浅色/暗色模式">'
        '<i class="iconfont icon-moon"></i></a>'
        '<span class="search-button fr" id="search-button" title="搜索">'
        '<i class="iconfont icon-search"></i></span>'
        '<div class="container br sb animated-fast fadeInUpMenu hidden" id="search-area" style="display:none;">'
        '<form action="/search.html" class="searchform clearfix" method="get" name="search">'
        '<input autofocus="autofocus" class="s-input br fl" name="q" placeholder="请输入关键词..." type="text"/>'
        '<button class="s-button fr br transition brightness" id="searchsubmit" type="submit">搜 索</button>'
        '</form></div>'
        '</div></header>'
    )
    return BeautifulSoup(frag, "html.parser").find("header")


# 图片点击放大（fancybox）初始化脚本。源站用 common.js 给裸 <img data-fancybox>
# 绑定点击放大（Fancybox v5 原生支持裸 <img data-fancybox>，会从 src 取图并按下
# data-fancybox 值自动分组），我们剥离 common.js 后该行为失效。此脚本复用页面已
# 加载的 Fancybox v5 库（/zb_users/theme/xianbao_theme/script/fancybox.js），调用
# 官方 Fancybox.bind('[data-fancybox]') 恢复点击放大；轻量重试应对脚本加载顺序边缘。
FANCYBOX_INIT_JS = (
    "(function(){"
    "function xbInitFb(){"
    "if(typeof window.Fancybox==='undefined')return false;"
    "if(window.__xbFbBound)return true;"
    "window.__xbFbBound=true;"
    "document.addEventListener('click',function(e){"
    "var el=e.target.closest?e.target.closest('img[data-fancybox]'):null;"
    "if(!el)return;"
    "e.preventDefault();"
    "var g=el.getAttribute('data-fancybox');"
    "var nodes=Array.prototype.slice.call(document.querySelectorAll(\"img[data-fancybox='\"+g+\"']\"));"
    "var items=nodes.map(function(im){"
    "var s=im.getAttribute('src')||im.getAttribute('data-src')||'';"
    "if(s.charAt(0)==='/')s=location.origin+s;"
    "return {src:s,type:'image'};"
    "});"
    "var idx=nodes.indexOf(el);"
    "if(idx>0){items=items.slice(idx).concat(items.slice(0,idx));}"
    "Fancybox.show(items,{hideScrollbar:false});"
    "});"
    "return true;"
    "}"
    "if(!xbInitFb()){"
    "var n=0,iv=setInterval(function(){if(xbInitFb()||++n>50){clearInterval(iv);}},100);"
    "}"
    "})();"
)

# 内联防晃动样式：随 HTML 一起被缓存破坏，不依赖外部覆盖 CSS 是否新鲜。
# 根因：Fancybox v5 在打开/关闭时会切换 <html> 的 overflow 并给 <body> 加 margin-right
# 补偿，导致文档宽度变化、评论/正文左右晃动。这里全局强制：滚动条永远常驻、
# body 永远无 margin-right 补偿，且不改变 body 的 overflow（避免 BFC 切换带来的重排）。
FANCYBOX_NOSHIFT_CSS = (
    "html{overflow-y:scroll !important;overflow-x:hidden !important;}"
    "body{margin-right:0 !important;}"
)


# 图片加载失败降级脚本：远程图片失效 / 源站删图时替换为内联 SVG 占位图，
# 避免浏览器默认裂图图标撑破排版。占位图用 data URI 内联，不产生额外请求，
# 与镜像「自包含、不依赖外部资源」的目标一致。
# 采用捕获阶段监听，可覆盖懒加载后动态插入的图片；data-img-fallback 保证幂等。
IMG_FALLBACK_JS = (
    "(function(){\n"
    "var PH='data:image/svg+xml;charset=utf-8,'+encodeURIComponent("
    "\"<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80'>"
    "<rect width='120' height='80' fill='#eceef3'/>"
    "<g fill='#b6bcc9'><rect x='52' y='24' width='46' height='30' rx='3'/>"
    "<circle cx='42' cy='36' r='5'/>"
    "<path d='M52 54l12-12 10 10 8-8 16 16z'/></g>"
    "<text x='60' y='70' font-size='9' fill='#8a90a0' text-anchor='middle' "
    "font-family='sans-serif'>图片不可用</text></svg>\");\n"
    "document.addEventListener('error',function(e){\n"
    "var t=e.target;if(!t||t.tagName!=='IMG')return;\n"
    "if(t.getAttribute('data-img-fallback'))return;\n"
    "t.setAttribute('data-img-fallback','1');\n"
    "t.style.maxWidth='100%';t.style.height='auto';t.src=PH;},true);})();"
)


def strip_chrome(html: str, cat_slug: str = None) -> str:
    """剥离文章页的站外模板（侧边热门榜 / 页脚外链 / 悬浮搜索 / 二维码工具条等），
    仅保留正文 + 评论，并在顶部注入源站风格导航（分类标签 + 搜索 + 浅色模式），
    使镜像页自包含、点击内部链接不再跳转到原站。

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
    # 文章页底部「猜你还会喜欢」推荐流（依赖源站算法、非镜像内容），整块删除
    for el in soup.select(".xiangguan"):
        el.decompose()
    # 2) 残留的二维码 / 本页二维码工具条（指向原站）
    for el in soup.select(".qr, #qr, #toolbar"):
        el.decompose()
    # 2b) 历史上的悬浮搜索按钮样式块（已无对应 <a>，属死代码）
    for st in soup.find_all("style"):
        if st.string and "xianbao-search-fab" in st.string:
            st.decompose()
    # 2c) 删除源站主题 common.js：它在运行时会把文本中的 URL 自动链接化，
    # 错误地破坏 .author 链接结构；还会在移动端评论列表里重复注入「顺序」控件。
    for _s in soup.find_all("script", src=re.compile(r"common\.js", re.I)):
        _s.decompose()
    # 2c-2) 删除源站实时推送脚本（meta.php）：initGM 未定义 + Worker 推送 +
    # 源站侧栏注入在静态镜像上全部失效（c_html_js_add.php 必须保留，见函数注释）。
    for _s in list(soup.find_all("script", src=re.compile(r"meta\.php", re.I))):
        _s.decompose()
    # 4) 文章页操作按钮：收藏、复制文案、重新抓取、举报
    for _cls in ("mochu_us_shoucang", "mochu-us-coll", "mochu-us-zhua",
                 "mochu-us-copy", "report"):
        for el in soup.find_all(class_=re.compile(r"(^|\b)" + re.escape(_cls)
                                                   + r"($|\b)", re.I)):
            el.decompose()
    # 5) 移除“本文由系统自动重新抓取...”提示行
    for el in soup.select("#art-fujia > .mianbaoxie"):
        el.decompose()
    # 6) 移除评论表单区（#postcmt / .compost）和版块标题（.mianbaoxie），保留真实评论列表
    for box in soup.select("#commentbox"):
        for el in box.select("#postcmt, .compost"):
            el.decompose()
        for el in box.select(".mianbaoxie"):
            el.decompose()
        # #commentbox 里的 .comment-list 是 AJAX 空占位（无 .li），直接删除
        for cl in box.select(".comment-list"):
            if not cl.find_all(class_="li"):
                cl.decompose()
        # 清理后若 commentbox 没有保留真实评论列表（只剩空壳或表单残骸），整体移除，
        # 避免文章底部出现白色空白块
        if not box.find(class_="comment-list"):
            box.decompose()
    # 7) 评论控件（顺序/只看楼主）：仅作用于「主评论列表」（#comment 内），
    #    改写 onclick 指向镜像自包含函数；非主列表（如“交流列表”版块）原本就
    #    没有控件，移除上一版误加的重复控件，避免页面出现两组“顺序”。
    primary = soup.select_one("#comment .comment-list")
    if primary is None:
        primary = soup.find(class_="comment-list")
    if primary is not None:
        title = primary.find(class_="title")
        if title is not None:
            has_pinglun = bool(title.find(class_="pinglunshunxu"))
            has_show = bool(title.find(class_="showlouzhu"))
            if not has_pinglun:
                span = soup.new_tag("span", **{"class": "fr pinglunshunxu noselect"})
                span["onclick"] = "xianbaoPinglunshunxu();"
                span.string = "↹ 顺序"
                title.append(span)
            if not has_show:
                span = soup.new_tag("span", **{"class": "fr showlouzhu noselect"})
                span["onclick"] = "xianbaoShowlouzhu();"
                span.string = "只看楼主"
                title.append(span)
            for ctl in title.find_all(class_=["pinglunshunxu", "showlouzhu"]):
                if "pinglunshunxu" in ctl.get("class", []):
                    ctl["onclick"] = "xianbaoPinglunshunxu();"
                if "showlouzhu" in ctl.get("class", []):
                    ctl["onclick"] = "xianbaoShowlouzhu();"
                _ensure_cursor_pointer(ctl)
        _ensure_display_block(primary)
    # 非主评论列表：清理误加的控件，确保评论可见
    for cl in soup.find_all(class_="comment-list"):
        if cl is primary:
            continue
        for ctl in cl.find_all(class_=["pinglunshunxu", "showlouzhu"]):
            ctl.decompose()
        _ensure_display_block(cl)
    # 3) 注入源站风格顶部导航（分类标签 + 搜索 + 浅色模式）+ 评论控件脚本，
    #    替代「返回列表」链接（仅当能确定分类时）。
    if cat_slug:
        body = soup.body
        if body is not None:
            # 幂等清理：移除旧导航 / 返回列表 / 控件脚本 / 标记，避免重复运行后多出
            for _h in body.find_all("header", class_="xianbao-article-nav"):
                _h.decompose()
            for _a in body.find_all("a", class_="back-to-list"):
                _a.decompose()
            for _c in body.find_all(string=lambda s: isinstance(s, Comment)
                                    and "xianbao-chrome-stripped" in s):
                _c.extract()
            for _s in body.find_all("script", id="xianbao-comment-tools"):
                _s.decompose()
            # 注入导航（与首页/分类页一致）
            nav = _build_article_nav(cat_slug)
            body.insert(0, nav)
            body.insert(0, Comment("xianbao-chrome-stripped"))
            # 注入自包含的评论控件脚本（顺序/只看楼主）
            script = soup.new_tag("script", id="xianbao-comment-tools")
            script.string = (
                "(function(){"
                "var xianbaoLouzhuState={};"
                "window.xianbaoPinglunshunxu=function(){"
                "document.querySelectorAll('.comment-list').forEach(function(cl){"
                "var uls=Array.from(cl.children).filter(function(c){"
                "return c.classList&&c.classList.contains('ul');});"
                "if(uls.length>1){uls.reverse().forEach(function(ul){cl.appendChild(ul);});}"
                "});};"
                "window.xianbaoShowlouzhu=function(){"
                "var author='',els=document.querySelectorAll('.head-info .author a,.art-head .author a');"
                "for(var i=0;i<els.length;i++){var t=els[i].textContent.trim();if(t){author=t;break;}}"
                "if(!author){return;}"
                "var showOnly=!xianbaoLouzhuState[author];"
                "xianbaoLouzhuState[author]=showOnly;"
                "document.querySelectorAll('.comment-list').forEach(function(cl){"
                "cl.querySelectorAll('.ul').forEach(function(ul){"
                "var aEl=ul.querySelector('.author'),aText=aEl?aEl.textContent.trim():'';"
                "if(showOnly){"
                "ul.style.display=(aText===author||aText===author+'楼主')?'':'none';"
                "}else{ul.style.display='';}"
                "});});"
                "document.querySelectorAll('.showlouzhu').forEach(function(el){"
                "el.textContent=showOnly?'查看全部':'只看楼主';});"
                "};"
                "})();"
            )
            body.append(script)
            # 注入图片点击放大（fancybox）初始化：源站 common.js 被剥离后，
            # 裸 <img data-fancybox> 的点击放大失效，这里用已加载的 fancybox 库自包含恢复。
            if body.find("script", id="xianbao-fancybox-init") is None:
                fb_style = soup.new_tag("style", id="xianbao-fancybox-noshift")
                fb_style.string = FANCYBOX_NOSHIFT_CSS
                body.append(fb_style)
                fb = soup.new_tag("script", id="xianbao-fancybox-init")
                fb.string = FANCYBOX_INIT_JS
                body.append(fb)
            # 注入图片加载失败降级：远程图失效/源站删图时显示内联占位图，
            # 避免裂图图标撑破排版（配合 override.css 的 img 占位底色）。
            if body.find("script", id="xianbao-img-fallback") is None:
                img_fb = soup.new_tag("script", id="xianbao-img-fallback")
                img_fb.string = IMG_FALLBACK_JS
                body.append(img_fb)
            _inject_nav_tools(soup)
    # iconfont 外链本地化：at.alicdn.com 偶发超时导致全站图标缺字（方框/空白）。
    # 在最终序列化字符串上做字节级替换，避免再次 soup 往返。
    return localize_iconfont(str(soup))


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


def inject_dark_mode_sync(soup: BeautifulSoup) -> None:
    """在 <head> 顶部同步写入 night 主题类，避免 DOMContentLoaded 后再切换造成整页白闪；
    在 <body> 末尾覆盖 switchNightMode，使其同步切换 document.documentElement
    与 document.body 的 night 类，与初始注入保持一致。
    """
    head = soup.find("head")
    if head is None:
        return
    # 幂等：已注入则跳过
    if any(
        isinstance(c, Comment) and "xianbao-darkmode-sync" in c
        for c in head.contents
    ):
        return
    head.insert(0, Comment("xianbao-darkmode-sync"))
    sync = BeautifulSoup(
        '<script>(function(){try{var m=document.cookie.match(/(?:^|; )night=([^;]*)/);'
        'if(m&&decodeURIComponent(m[1])==="1"){document.documentElement.classList.add("night");'
        'if(document.body)document.body.classList.add("night");}'
        '}catch(e){}})();</script>',
        "html.parser",
    )
    head.insert(1, sync)
    body = soup.find("body")
    if body is not None:
        if not any(
            isinstance(c, Comment) and "xianbao-darkmode-override" in c
            for c in body.contents
        ):
            body.append(Comment("xianbao-darkmode-override"))
            override = BeautifulSoup(
                '<script>(function(){try{var m=document.cookie.match(/(?:^|; )night=([^;]*)/);'
                'if(m&&decodeURIComponent(m[1])==="1"&&document.body)document.body.classList.add("night");'
                '}catch(e){}})();'
                'function switchNightMode(){'
                'var m=document.cookie.match(/(?:^|; )night=([^;]*)/),'
                'night=(m&&decodeURIComponent(m[1])==="1")?"1":"0",'
                'next=night==="1"?"0":"1",d=new Date();'
                'd.setTime(d.getTime()+6048e5);'
                'document.cookie="night="+next+";expires="+d.toUTCString()+";path=/";'
                'document.documentElement.classList.toggle("night",next==="1");'
                'if(document.body)document.body.classList.toggle("night",next==="1");'
                '}</script>',
                "html.parser",
            )
            body.append(override)


def rewrite_html(html: str, cat_slug: str = None) -> str:
    soup = BeautifulSoup(html, "html.parser")
    inject_dark_mode_sync(soup)
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
                    _v = val.strip()
                    # 源站图片懒加载代理：规范化为绝对代理 URL 并绕过 fix_url
                    # （否则 fix_url 会把源站域名链接改写成本地路径导致 404）。
                    # 留下绝对代理 URL 由 localize_images 通过代理下载并本地化存储。
                    if a in ("src", "data-src", "poster", "data-original"):
                        _pa = _proxy_abs_url(_v)
                        if _pa is not None:
                            tag[a] = _pa
                            continue
                    tag[a] = fix_url(_v, cat_slug)
        style = tag.get("style")
        if style and "url(" in style:
            tag["style"] = re.sub(
                r"url\(\s*['\"]?(.*?)['\"]?\s*\)",
                lambda m: "url(" + fix_url(m.group(1), cat_slug) + ")",
                style,
            )
    # 中和指向源站后端的跳转链接，分三层（互不冲突）：
    # 1) 无歧义“源站家族”域名（xianbao.*/ixbk.*/xdglt.*/xiaodigu.cn/zuanke8.com/www.x6d.com 等）
    #    任何位置的 <a href> 都中和。www.x6d.com 已纳入（用户要求 xiaodao 完全不跳源站，
    #    连正文优惠链接也一并中和），详见上方 SOURCE_HOST_RE 注释。
    # 2) “原文地址 / 阅读原文 / 来源”等标记块内的 <a>（精准，保留同域名的优惠链接）。
    # 3) 文章标题块 d-biaoti 内的外链（标题本就不该外跳，保留本地相对链接）。
    # 中和方式：保留可见文字，href 置 “#”，点击不再离开镜像站。
    for _a in soup.find_all("a"):
        _href = _a.get("href")
        if not isinstance(_href, str) or not _href.strip():
            continue
        _h = _href.strip()
        _net = urlparse(_h).netloc.lower() if _h.startswith("http") else ""
        if _net and SOURCE_HOST_RE.match(_net):
            # 源站「文章页」链接改写为本地相对路径，保留帖间互链结构；
            # 非文章链接（首页/用户中心等）中和置 #，避免点击跳回源站。
            _p = urlparse(_h).path
            if ART_RE.match(_p):
                _a["href"] = _p
            else:
                _a["href"] = "#"
            continue
        if _h.startswith("http"):
            _parent_txt = _a.parent.get_text(" ", strip=True) if _a.parent else ""
            if any(_m in _parent_txt for _m in
                   ("原文地址", "阅读原文", "查看原文", "来源：", "来源:")):
                _a["href"] = "#"
    for _block in soup.find_all(class_=re.compile(r"art-copyright")):
        for _a in _block.find_all("a"):
            if isinstance(_a.get("href"), str) and _a.get("href").strip().startswith("http"):
                _a["href"] = "#"
    for _title in soup.find_all("div", class_=re.compile(r"d-biaoti")):
        for _a in _title.find_all("a"):
            _href = _a.get("href")
            if isinstance(_href, str) and _href.strip().startswith("http"):
                _a["href"] = "#"
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
    # 剥离源站「域名锁定 / 防盗链」内联脚本（hex 混淆的 window.location 重定向），
    # 否则镜像站加载文章页会把访客甩回源站。该脚本对镜像无意义，直接删除。
    for _s in soup.find_all("script"):
        if _s.get("src"):
            continue
        if _looks_like_domain_lock(_s.get_text() or ""):
            _s.decompose()
    # 删除帖子正文里的「原文地址：」行（源站原文链接，镜像无意义且暴露源站，用户要求
    # 删除）。定位含「原文地址/阅读原文/查看原文」的 <strong>，删除其块级父容器（整行）。
    _addr_blks = []
    for _strong in soup.find_all("strong"):
        _st = _strong.get_text(strip=True)
        if any(_m in _st for _m in ("原文地址", "阅读原文", "查看原文")):
            _blk = _strong
            while _blk is not None and _blk.name not in ("div", "p", "li", "tr", "section", "article"):
                _blk = _blk.parent
            if _blk is not None:
                _addr_blks.append(_blk)
    for _blk in _addr_blks:
        _blk.decompose()
    # 面包屑分隔符：源站用 iconfont 图标（依赖外部 CDN at.alicdn.com），本地/部分环境
    # 不显示，导致「首页赚客吧文章正文」挤在一起。替换为文本分隔符，不再依赖外部字体。
    for _i in soup.select("i.iconfont.icon-right"):
        _i.replace_with(NavigableString(" › "))
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
    """记录一次永久失效，并在首次标记时把最后好快照归档为 tombstone。"""
    d = state.setdefault("dead", {})
    rec = d.get(path) or {"reason": reason, "fails": 0, "ts": 0, "permanent": True}
    first = rec.get("fails", 0) == 0
    rec["fails"] = rec.get("fails", 0) + 1
    rec["reason"] = reason
    rec["ts"] = _now_ts()
    rec["permanent"] = permanent
    d[path] = rec
    if first:
        _tombstone(state, path)


def _tombstone(state, path):
    """源站删帖时，把本地最后好快照复制到 archive/<cat>/<id>/dead.html，写 dead.meta.json。
    源站关闭 / 删帖后，归档内容仍可访问（结构保留目标）。"""
    local = path.lstrip("/")
    src = OUT_DIR / local
    if not src.exists():
        return
    m = re.search(r"/([^/]+)/(\d+)\.html$", "/" + local)
    if not m:
        return
    arch = OUT_DIR / "archive" / m.group(1) / m.group(2)
    arch.mkdir(parents=True, exist_ok=True)
    try:
        shutil.copy2(src, arch / "dead.html")
        (arch / "dead.meta.json").write_text(
            json.dumps({"original": "/" + local, "reason": "source_deleted",
                        "ts": _now()}, ensure_ascii=False),
            encoding="utf-8")
        state.setdefault("tombstones", {})["/" + local] = str(arch / "dead.html")
    except Exception as e:
        print(f"::warning:: 墓碑保留失败 {path}: {e}", file=sys.stderr)


def _archive_version(state, path, local):
    """源站正文被编辑更新时，把旧快照归档为 archive/<cat>/<id>/v<ts>.html（保留最近 3 版）。"""
    src = OUT_DIR / local.lstrip("/")
    if not src.exists():
        return
    m = re.search(r"/([^/]+)/(\d+)\.html$", "/" + local)
    if not m:
        return
    arch = OUT_DIR / "archive" / m.group(1) / m.group(2)
    arch.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%dT%H%M%S")
    try:
        shutil.copy2(src, arch / f"v{ts}.html")
        vers = state.setdefault("versions", {}).setdefault(path, [])
        vers.append(ts)
        while len(vers) > 3:
            old_ts = vers.pop(0)
            old = arch / f"v{old_ts}.html"
            if old.exists():
                old.unlink()
    except Exception as e:
        print(f"::warning:: 版本快照失败 {path}: {e}", file=sys.stderr)


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
        "pending_fails": {},    # path -> 连续抓取失败次数；达 DEAD_FAIL_LIMIT 后转 dead，避免无限回填
        "crawled": {},          # path -> {hash, local, last_check}
        "dead": {},             # path -> {reason, fails, ts, permanent} 永久失效页（不再爬）
        "dead_assets": {},      # 绝对URL -> {reason, ts} 永久失效资源（不再补）
        "recheck_idx": 0,
        "completed_at": None,
        # 回填完成标记（一次性）：列表已翻完且待处理队列曾清空。
        # ★ 与「源站持续更新」解耦 —— 置位后永不回退，使 maintenance 抽样复查
        #   能被真正启动；源站后续新帖照常增量抓取，与复查并行互不阻塞。
        #   旧状态文件缺此字段时经 load_state 补默认 False，不丢进度。
        "backfill_complete": False,
        "backfill_completed_at": None,
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
            # stats 采用「合并」而非整体覆盖：以**默认字段集**为基底，再用状态文件
            # 中的值覆盖。注意必须以 default_state() 取基底 —— 此时 base["stats"]
            # 已被上面的 base.update() 整体替换成 data 的值，不能再以它为基底。
            # 旧状态文件可能不含后续新增的计数字段（如 updated），若被整体替换，
            # save_page 中的 state["stats"]["updated"] += 1 会触发 KeyError 使整轮中断。
            _stats = dict(default_state()["stats"])
            _stats.update(data.get("stats") or {})
            base["stats"] = _stats
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


def mark_backfill_if_complete(state):
    """回填完成判定（**一次性**标记，与「源站持续更新」解耦）。

    ★ 修复说明（后期维护关键缺陷）：
      原判定写在主循环 `drain_frontier` **之前**，形如
      `all(category_exhausted) and not pending`；但每轮开头的「各分类第 1 页探新帖」
      步骤都会把源站新帖补进 pending，使 `not pending` 恒成立为假 →
      mode 永远停在 crawl、maintenance 抽样复查从未启动（实测 recheck_idx 恒为 0，
      28632 篇存量文章的新评论 / 内容更新从未同步）。

      本函数须在 `drain_frontier` **之后**调用（此时本轮新帖已抓完，pending 才可能
      真正为空），并采用一次性标记 `backfill_complete`：一旦置位即不回退，
      后续源站新帖照常增量抓取，复查与增量并行、互不阻塞。

    Returns:
        bool: 本次调用是否**刚刚**把 backfill_complete 置为 True。
    """
    if state.get("backfill_complete"):
        return False  # 已置位，幂等且不回退
    if not all(state["category_exhausted"].get(s, False)
               for s in ALLOWED_CATEGORIES):
        return False
    if state.get("pending"):
        return False

    state["backfill_complete"] = True
    state["backfill_completed_at"] = _now()
    state["mode"] = "maintenance"
    state["completed_at"] = _now()
    return True


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
            # H1 修复：原逻辑在此直接 continue —— 而此时 path 已从 pending 移除、
            # 又未写入 crawled、也未记入 dead（只有 404/410 才会记 dead），
            # 该文章就此永久丢失且无任何日志。
            # 现改为「有限重试」：先回填 pending 供下轮再试；累计失败达
            # DEAD_FAIL_LIMIT 后标记失效（permanent=False，DEAD_TTL_DAYS 到期后可
            # 重试），避免个别长期不可达的页面无限占用 pending，导致依赖
            # 「pending 为空」的回填完成判定永远无法置位。
            fails = state.setdefault("pending_fails", {})
            n = fails.get(path, 0) + 1
            if n >= DEAD_FAIL_LIMIT:
                record_dead(state, path, f"fetch_failed x{n}", permanent=False)
                fails.pop(path, None)
            else:
                fails[path] = n
                state["pending"].add(path)
            continue
        save_page(path, rendered, "article")
        # 抓取成功，清除该 path 的历史失败计数
        state.get("pending_fails", {}).pop(path, None)
        if CRAWL_DELAY_MS > 0:
            _crawl_delay()
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
    """把已爬进度（状态文件 + 新页面）提交到本地 git，但不推送。

    作用：即便本次运行被手动取消或崩溃，已提交的进度会保留在本地 git 中；
    workflow 结束时会统一 push 到 GitHub，次日从断点继续、不重复爬取。
    不直接 push 是为了避免每个 checkpoint 都触发一次 Vercel 部署。
    非 git 工作区（如本地无仓库）时仅落地状态文件、跳过提交。
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


# ---------------------------------------------------------------------------
# 搜索索引 + 落地页
# ---------------------------------------------------------------------------
SEARCH_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>线报酷镜像 · 站内搜索</title>
<link rel="stylesheet" href="/lib/xianbao-override.css?v=6">
<script src="/lib/minisearch.umd.min.js"></script>
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
var _q=document.getElementById('q'),_r=document.getElementById('r'),_ms=null,_timer=null;
var LITE_URL='__LITE_URL__';  // 带版本号：配合 immutable 缓存，版本不变则浏览器零请求
// 健壮加载：检查 HTTP 状态 + 120s 超时（19MB 大索引）+ 最多 3 次重试，
// 让边缘偶发 5xx / 传输截断能自愈，而不是一次性「加载失败」。
function _loadIndex(){
  return new Promise(function(resolve,reject){
    var tries=0, max=3;
    (function attempt(){
      tries++;
      var ctrl=new AbortController();
      var to=setTimeout(function(){ctrl.abort();},120000);
      fetch(LITE_URL,{signal:ctrl.signal}).then(function(r){
        clearTimeout(to);
        if(!r.ok) throw new Error('HTTP '+r.status);
        return r.json();
      }).then(resolve).catch(function(err){
        if(tries<max){ setTimeout(attempt,700*tries); } else { reject(err); }
      });
    })();
  });
}
// 分批建索引：addAll 一次性分词 2.8 万条会阻塞主线程约 7 秒（页面假死），
// 改为每批 1500 条、批间 setTimeout(0) 让路事件循环，总耗时不变但页面可交互。
function buildIndex(docs){
  return new Promise(function(resolve){
    _ms=new MiniSearch({fields:['title','fulltext'],storeFields:['title','url','fulltext','cat_label','comments','time']});
    var i=0,STEP=800;
    (function chunk(){
      var end=Math.min(i+STEP,docs.length);
      for(;i<end;i++) _ms.add(docs[i]);
      if(i<docs.length){ setTimeout(chunk,0); } else { resolve(); }
    })();
  });
}
_loadIndex().then(function(docs){
  if(!window.MiniSearch){_r.innerHTML='<p>搜索组件加载失败（本地 MiniSearch 库缺失）。</p>';return;}
  return buildIndex(docs).then(function(){
    var params=new URLSearchParams(window.location.search);
    var initial=params.get('q');
    if(initial){ _q.value=initial; run(); }
  });
}).catch(function(e){
  _r.innerHTML='<p>搜索索引加载失败：'+(e&&e.message?e.message:e)+'</p>';
});
// 按发布时间排序（新→旧），同日内按相关度兜底：
// 线报/优惠强时效，用户明确要求结果以发布时间为准（2026-09-05 反馈）。
function postTime(tstr){
  var m=/(\\d{4})年(\\d{2})月(\\d{2})日(?:\\s*(\\d{2}):(\\d{2}))?/.exec(String(tstr||''));
  if(!m) return 0;
  return new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)).getTime();
}
function ranked(list){
  list.forEach(function(x){ x._t=postTime(x.time); });
  list.sort(function(a,b){ return (b._t-a._t)||(b.score-a.score); });
  return list;
}
function run(){
  if(!_ms) return;
  var t=_q.value.trim();
  if(!t){_r.innerHTML='';return;}
  var res=ranked(_ms.search(t,{prefix:true,fuzzy:0.2,boost:{title:2}}));
  if(!res.length){_r.innerHTML='<p>没有找到相关结果。</p>';return;}
  _r.innerHTML=res.slice(0,100).map(function(x){
    return '<div class="it"><a href="'+x.url+'">'+x.title+'</a>'
      +'<p>'+((x.fulltext||'').slice(0,140))+'</p></div>';
  }).join('');
}
// 输入防抖：合并连续输入触发的检索，避免每个按键都全量搜索
_q.addEventListener('input',function(){
  if(_timer) clearTimeout(_timer);
  _timer=setTimeout(run,180);
});
</script>
</body>
</html>
"""


def _clean_text(text: str) -> str:
    """去掉正文噪声（面包屑 / 版权声明 / 评论区 / 操作按钮），得到干净归档正文。"""
    if "文章正文" in text:
        text = text.split("文章正文", 1)[1]
    if "版权声明" in text:
        text = text.split("版权声明", 1)[0]
    for m in ("举报", "收藏文章", "复制文案", "重新抓取",
              "本文由系统自动重新抓取", "评论列表"):
        text = text.replace(m, " ")
    return re.sub(r"\s+", " ", text).strip()


def _to_rfc3339(time_str: str) -> str:
    """'2026年06月17日 01:02' -> RFC3339（Atom 需要）。失败返回空串。"""
    iso = _parse_time_to_iso(time_str)
    if not iso:
        return ""
    try:
        from datetime import datetime, timezone, timedelta
        dt = datetime.strptime(iso, "%Y-%m-%d %H:%M:%S")
        dt = dt.replace(tzinfo=timezone(timedelta(hours=8)))
        return dt.isoformat()
    except Exception:
        return ""


def _extract_comment_text(soup) -> str:
    """提取评论正文文本，供全文检索使用。

    只取评论内容本身，剔除评论区的排序/操作控件文本，避免这些噪声词
    （如"顺序""只看楼主"）被误索引、干扰检索结果相关性。
    """
    box = soup.select_one("#comment .comment-list, .comment-list")
    if not box:
        return ""
    for el in box.select(
        "button, .comment-toolbar, .comment-order, .showlouzhu, script, style"
    ):
        el.decompose()
    return box.get_text(" ", strip=True)


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
        cat = rel.split("/")[0]
        cat_label = CAT_LABELS.get(cat, cat)
        for t in soup(["script", "style"]):
            t.decompose()
        main = (soup.select_one("#post-content, .post-content, article .content, "
                                ".article-content, #article_content, .content")
                or soup.body)
        text = main.get_text(" ", strip=True) if main else ""
        # 复用上方已解析的 soup，避免对同一文件重复读盘 + 重复解析
        meta = _extract_article_meta(p, soup)
        content_clean = _clean_text(text)
        # 全文检索文本 = 正文全文 + 评论文本。
        # 评论截断 400 字：实测评论平均 306 字，该长度可覆盖绝大多数回帖，
        # 同时避免个别"高楼帖"把索引体积撑大。
        comment_text = _clean_text(_extract_comment_text(soup))[:400]
        fulltext = (content_clean + " " + comment_text).strip()
        items.append({
            "id": str(idx + 1),
            "title": title,
            "url": "/" + rel,
            "body": text[:300],                  # 短摘要（兼容旧检索）
            "content_clean": content_clean[:2000],  # 干净正文（提升检索质量/归档）
            "fulltext": fulltext,                # 正文全文 + 评论（前端检索用）
            "cat": cat,
            "cat_label": cat_label,
            "comments": meta["comments"],
            "author": meta["author"],
            "tags": meta["tags"],
            "time": meta["time"],
        })
    items.sort(key=lambda x: x["title"])
    # 完整版不落盘 fulltext：该字段仅前端检索需要，写入会让归档体积无谓膨胀
    (out_dir / "search.json").write_text(
        json.dumps([{k: v for k, v in it.items() if k != "fulltext"} for it in items],
                   ensure_ascii=False), encoding="utf-8")
    # 轻量索引：仅供前端搜索页下载。
    # 检索范围 = 标题 + 正文全文 + 评论（fulltext）；展示只需标题/链接/分类/评论数/时间。
    # 不再单独存 body —— fulltext 开头即为正文，可省约三成体积。
    # ⚠️ id 必须保留：MiniSearch 默认 idField='id'，漏掉该字段会让前端
    # addAll() 整体抛「document does not have ID field "id"」→ 搜索全挂
    # （2026-09-05 线上事故根因，勿再省略）。
    lite = [{
        "id": it["id"],
        "title": it["title"],
        "url": it["url"],
        "fulltext": it.get("fulltext", ""),
        "cat_label": it["cat_label"],
        "comments": it["comments"],
        "time": it.get("time", ""),
    } for it in items]
    (out_dir / "search-lite.json").write_text(
        json.dumps(lite, ensure_ascii=False), encoding="utf-8")
    build_sitemap(out_dir, items)
    build_atom(out_dir, items)
    build_search_page(out_dir, items)
    return len(items)


def _mirror_base() -> str:
    """站点绝对基址（sitemap/atom 需要）。由 env MIRROR_BASE_URL 指定，
    缺省为正式自定义域名（2026-09-05 体检发现旧默认域名会写进 sitemap/atom）。"""
    return os.environ.get("MIRROR_BASE_URL", "https://xianbao.1314151.xyz").rstrip("/")


def build_sitemap(out_dir: Path, items: list) -> None:
    """生成 sitemap.xml（全站文章 URL），供搜索引擎抓取，提升原站关闭后可发现性。"""
    base = _mirror_base()
    urls = [f"  <url><loc>{base}{it['url']}</loc></url>" for it in items]
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(urls) + "\n</urlset>\n")
    (out_dir / "sitemap.xml").write_text(xml, encoding="utf-8")


def build_atom(out_dir: Path, items: list) -> None:
    """生成 atom.xml（最近 50 篇，按发布时间倒序），作为新抓取内容的订阅源。"""
    base = _mirror_base()
    from xml.sax.saxutils import escape
    recent = sorted(
        (it for it in items if it.get("time")),
        key=lambda x: x["time"], reverse=True)[:50]
    entries = []
    for it in recent:
        updated = _to_rfc3339(it["time"]) or time.strftime("%Y-%m-%dT%H:%M:%S+08:00")
        title = escape(it["title"])
        entries.append(
            f'  <entry>\n'
            f'    <title>{title}</title>\n'
            f'    <link href="{base}{it["url"]}"/>\n'
            f'    <id>{base}{it["url"]}</id>\n'
            f'    <updated>{updated}</updated>\n'
            f'  </entry>')
    feed = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<feed xmlns="http://www.w3.org/2005/Atom">\n'
            f'  <title>线报酷镜像</title>\n'
            f'  <id>{base}/</id>\n'
            f'  <updated>{time.strftime("%Y-%m-%dT%H:%M:%S+08:00")}</updated>\n'
            + "\n".join(entries) + "\n</feed>\n")
    (out_dir / "atom.xml").write_text(feed, encoding="utf-8")


def _parse_time_to_iso(time_str: str) -> str:
    """把 '2026年06月22日 14:47' 转成 ISO 日期字符串（用于排名筛选）。"""
    m = re.search(r"(\d{4})年(\d{2})月(\d{2})日\s*(\d{2}):(\d{2})", time_str or "")
    if not m:
        return ""
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)} {m.group(4)}:{m.group(5)}:00"

def ensure_minisearch(out_dir: Path) -> bool:
    """把内置的 MiniSearch UMD 库复制到 out_dir/lib/，使搜索页不依赖外部 CDN
    （jsdelivr 失效或源站删除都不影响站内搜索）。幂等：已存在且大小一致则跳过。"""
    src = Path(__file__).resolve().parent / "vendor" / "minisearch.umd.min.js"
    if not src.exists():
        print("::warning:: vendor/minisearch.umd.min.js 缺失，搜索页将无 MiniSearch 库",
              file=sys.stderr)
        return False
    dst = out_dir / "lib" / "minisearch.umd.min.js"
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists() or dst.stat().st_size != src.stat().st_size:
        dst.write_bytes(src.read_bytes())
    return dst.exists()


def _lite_url() -> str:
    """search-lite.json 的带版本 URL。版本随每次渲染变化（CI 可注入 RENDER_VERSION）。
    配合 CDN/浏览器对该路径的 immutable 长缓存（见 vercel.json headers）：
    版本不变 → 浏览器零请求秒加载；新部署 → URL 变化 → 自动拉取新索引。"""
    version = os.environ.get("RENDER_VERSION") or str(int(time.time()))
    return f"/search-lite.json?v={version}"


def build_search_page(out_dir: Path, items: list) -> None:
    """生成源站风格的搜索页：复用 category-zuankeba 模板，替换主列表为 MiniSearch 搜索，
    并在右侧生成 12/24/48 小时榜。"""
    template = out_dir / "category-zuankeba" / "index.html"
    if not template.exists():
        # fallback 到旧版极简搜索页。
        # 该页已改用本地 vendored 库（不再依赖外部 CDN），故需先确保库文件就位，
        # 否则 /lib/minisearch.umd.min.js 404 会导致搜索完全不可用。
        ensure_minisearch(out_dir)
        (out_dir / "search.html").write_text(
            SEARCH_HTML.replace("__LITE_URL__", _lite_url()), encoding="utf-8")
        return
    html = template.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")
    if soup.title:
        soup.title.string = "搜索-线报酷镜像"
    # 注入 MiniSearch 库（内置 vendored 副本，不依赖外部 CDN，防 CDN 失效/源站删除）
    ensure_minisearch(out_dir)
    ms = soup.new_tag("script", src="/lib/minisearch.umd.min.js")
    if soup.head:
        soup.head.append(ms)
    # 面包屑：首页 > 搜索
    mbx = soup.find(class_="mianbaoxie")
    if mbx:
        mbx.clear()
        home_a = soup.new_tag("a", href="/", title="首页")
        home_a.string = "首页"
        mbx.append(home_a)
        mbx.append(NavigableString(" › "))
        mbx.append(NavigableString("搜索"))
    # 搜索框：在 listbox 顶部加一个输入框
    listbox = soup.find(class_="listbox")
    search_top = None
    if listbox:
        search_top = soup.new_tag("div", **{"class": "search-top"})
        inp = soup.new_tag("input", id="q", type="text", placeholder="输入关键词，如 红包 / 活动 / 教程…")
        inp["autofocus"] = "autofocus"
        search_top.append(inp)
        # 插入到列表前面
        ul = listbox.find("ul", class_="new-post")
        if ul:
            ul.insert_before(search_top)
        else:
            listbox.insert(0, search_top)
    # 清空/保留列表容器，供前端填充
    ul = soup.find("ul", class_="new-post")
    if ul:
        ul.clear()
    # 移除源站分页
    _strip_pagination(soup)
    # 移除 meta.php 动态脚本
    for s in soup.find_all("script", src=re.compile(r"meta\.php")):
        s.decompose()
    # 移除右侧热榜侧栏（不再生成 12/24/48 小时榜），使搜索结果列表居中
    aside = soup.find("aside", id="sidebar")
    if aside:
        aside.decompose()
    _ensure_body_class(soup, "xianbao-list")
    # 注入 MiniSearch 脚本
    script = soup.new_tag("script")
    script.string = """
(function(){
  var q = document.getElementById('q');
  var ul = document.querySelector('ul.new-post');
  if (!q || !ul) return;
  var LITE_URL = '__LITE_URL__';  // 带版本号：配合 immutable 缓存，版本不变则浏览器零请求
  function escapeHtml(s){
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function render(res){
    ul.innerHTML = '';
    if (!res.length){
      ul.innerHTML = '<li class="article-list"><p class="title" style="padding:20px 0">没有找到相关结果。</p></li>';
      return;
    }
    res.slice(0,100).forEach(function(x){
      var li = document.createElement('li');
      li.className = 'article-list';
      // 展示发布时间（源站格式为「2026年06月22日 14:47」，原样呈现）
      var tstr = x.time ? String(x.time) : '';
      var tspan = tstr
        ? '<span style="margin-left:8px;color:#9aa0ad;font-size:12px;font-weight:400">' + escapeHtml(tstr) + '</span>'
        : '';
      li.innerHTML = '<span class="figure cg16"></span>'
        + '<p class="title">'
        + '<span class="badge com"><i class="iconfont icon-comment"></i>' + (x.comments||0) + '</span>'
        + '<a href="' + x.url + '" title="' + escapeHtml(x.title) + '" target="_blank" data-comments="' + (x.comments||0) + '" data-catename="' + escapeHtml(x.cat_label||'') + '">' + escapeHtml(x.title) + '</a>'
        + tspan
        + '</p>';
      ul.appendChild(li);
    });
  }
  // 索引与 MiniSearch 实例**只构建一次**并缓存复用。
  // 修复说明：原先每次 input 都重新 fetch 近 29MB 的 search.json，并对 2.8 万条
  // 重建一次 MiniSearch 索引，导致每敲一个字符都要重新下载 + 重建，搜索几乎不可用。
  // 现改为「懒加载一次 + 复用实例 + 输入防抖」，检索参数保持不变，
  // 因此结果集与排序逻辑与原先完全一致。
  var msPromise = null;
  // 健壮加载：检查 HTTP 状态 + 120s 超时（19MB 大索引）+ 最多 3 次重试，
  // 让 Vercel 边缘偶发 502 / 传输截断能自愈，而不是一次性「加载失败」。
  function _fetchWithRetry(url){
    return new Promise(function(resolve,reject){
      var tries=0, max=3;
      (function attempt(){
        tries++;
        var ctrl=new AbortController();
        var to=setTimeout(function(){ctrl.abort();},120000);
        fetch(url,{signal:ctrl.signal}).then(function(r){
          clearTimeout(to);
          if(!r.ok) throw new Error('HTTP '+r.status);
          return r.json();
        }).then(resolve).catch(function(err){
          if(tries<max){ setTimeout(attempt,700*tries); } else { reject(err); }
        });
      })();
    });
  }
  function getIndex(){
    if (msPromise) return msPromise;
    // 使用轻量索引 search-lite.json：只含检索与展示必需字段，体积约为完整版
    // search.json 的四成，可显著降低首次加载耗时；检索字段为 title + fulltext
    //（fulltext = 正文全文 + 评论），与完整版索引的检索语义一致。
    // LITE_URL 带渲染版本号：新部署 URL 变化自动拉新；版本不变走 immutable 长缓存。
    msPromise = _fetchWithRetry(LITE_URL).then(function(docs){
      if (!window.MiniSearch) return null;
      // 检索范围：标题 + 正文全文 + 评论（fulltext 已包含二者）
      // 分批建索引：addAll 一次性分词 2.8 万条会阻塞主线程约 7 秒（页面假死），
      // 改为每批 1500 条、批间 setTimeout(0) 让路事件循环，总耗时不变但页面可交互。
      return new Promise(function(resolve){
        var ms = new MiniSearch({fields:['title','fulltext'], storeFields:['title','url','cat_label','comments','time']});
        var i = 0, STEP = 800;
        (function chunk(){
          var end = Math.min(i + STEP, docs.length);
          for (; i < end; i++) ms.add(docs[i]);
          if (i < docs.length) { setTimeout(chunk, 0); } else { resolve(ms); }
        })();
      });
    });
    msPromise.then(function(){ window.__msReady = true; });
    return msPromise;
  }
  // 按发布时间排序（新→旧），同日内按相关度兜底：
  // 线报/优惠强时效，用户明确要求结果以发布时间为准（2026-09-05 反馈），
  // 相关度混排会让老帖插队。无时间的文档沉底，同批次内按相关度排。
  function postTime(tstr){
    var m=/(\\d{4})年(\\d{2})月(\\d{2})日(?:\\s*(\\d{2}):(\\d{2}))?/.exec(String(tstr||''));
    if(!m) return 0;
    return new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)).getTime();
  }
  function search(){
    var t = q.value.trim();
    if (!t){ ul.innerHTML=''; return; }
    // 首次检索需要下载索引并构建，给出明确提示，避免看起来像"卡住没反应"
    if (!window.__msReady){
      ul.innerHTML = '<li class="article-list"><p class="title" style="padding:20px 0">正在准备搜索（首次约几秒）…</p></li>';
    }
    getIndex().then(function(ms){
      if (!ms){ render([]); return; }
      // 检索参数保持不变（prefix/fuzzy/boost），仅把结果集按发布时间重排
      var res = ms.search(t, {prefix:true, fuzzy:0.2, boost:{title:2}});
      res.forEach(function(x){ x._t = postTime(x.time); });
      res.sort(function(a,b){ return (b._t - a._t) || (b.score - a.score); });
      render(res);
    }).catch(function(e){
      ul.innerHTML = '<li class="article-list"><p class="title" style="padding:20px 0">搜索索引加载失败：'+(e&&e.message?e.message:e)+'</p></li>';
    });
  }
  // 输入防抖：连续输入时合并检索，避免每个按键都触发一次全量检索
  var timer = null;
  function schedule(){
    if (timer) clearTimeout(timer);
    timer = setTimeout(search, 180);
  }
  q.addEventListener('input', schedule);
  // 页面加载即后台预热索引：下载 + 分批建索引都不阻塞交互，用户开始输入时
  // 索引大概率已就绪，感知等待趋近于 0。预热失败静默处理（不打扰浏览），
  // 仅重置缓存的 Promise，让真正检索时重新走一遍下载/建索引（含重试）。
  getIndex().catch(function(){ msPromise = null; });
  var params = new URLSearchParams(window.location.search);
  var initial = params.get('q');
  if (initial){ q.value = initial; search(); }
})();
"""
    script.string = script.string.replace("__LITE_URL__", _lite_url())
    if soup.body:
        soup.body.append(script)
    # 样式补丁（含暗黑模式适配，避免移动端搜索框在夜间模式下仍为白色）
    style = soup.new_tag("style")
    style.string = """
.search-top{padding:12px 16px;background:#fff;border-bottom:1px solid #eceef3}
.search-top input{width:100%;box-sizing:border-box;padding:12px 16px;font-size:15px;border:1px solid #d7dbe5;border-radius:12px;outline:none;background:#fff;color:#333}
.search-top input:focus{border-color:#1f4fd6}
html.night .search-top{background:#2a2f38;border-color:#3a414d}
html.night .search-top input{background:#1e2329;border-color:#3a414d;color:#e8eaed}
html.night .search-top input::placeholder{color:#8b949e}
html.night .search-top input:focus{border-color:#5c7cfa}
"""
    if soup.head:
        soup.head.append(style)
    _fix_search_form(soup)
    _sanitize_local_links(soup, out_dir)
    _prune_nav(soup, is_home=False)
    _remove_footer(soup)
    _inject_nav_tools(soup)
    (out_dir / "search.html").write_text(str(soup), encoding="utf-8")


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


def _build_legacy_hub(out_dir: Path):
    """旧版自定义简约首页（fallback，当源站 category-zuankeba 模板不存在时）。"""
    cat_names = {
        "zuankeba": "赚客吧",
        "xinzuanba": "新赚客吧",
        "xiaodigu": "小嘀咕",
        "huluxia": "葫芦侠三楼",
        "xiaodao": "小刀娱乐网",
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
<link rel="stylesheet" href="/lib/xianbao-override.css?v=6">
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


def _extract_article_meta(path: Path, soup=None) -> dict:
    """从本地文章 HTML 提取标题、发布时间、评论数等元数据。

    Args:
        path: 文章 HTML 路径（用于推导站内相对路径与文章 ID）。
        soup: 可选。调用方已解析好的 BeautifulSoup 对象。
              传入时直接复用，避免对同一文件重复 read_text + BeautifulSoup：
              构建搜索索引时每篇文章可省掉一次磁盘读与一次 HTML 解析，
              存量约 2.8 万篇的规模下，索引构建耗时接近减半。
              不传时行为与原先完全一致（保持向后兼容）。
    """
    if soup is None:
        try:
            html = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            return {}
        soup = BeautifulSoup(html, "html.parser")
    title = ""
    if soup.title:
        title = soup.title.get_text(strip=True)
        title = title.replace("线报酷镜像", "").replace("线报酷", "").strip().strip("-").strip()
    pub_time = ""
    time_tag = soup.find("time")
    if time_tag:
        pub_time = time_tag.get_text(" ", strip=True)
        pub_time = re.sub(r'\s+', ' ', pub_time).strip()
    # 作者（源站正文含 class="author"，此前未被结构化提取）
    author = ""
    au = soup.find(class_="author")
    if au:
        author = re.sub(r'\s+', ' ', au.get_text(" ", strip=True)).strip()
    # 标签（源站若有标签块则提取；无则空列表，不影响归档）
    tags = []
    tg = soup.find(class_=re.compile(r"tags", re.I))
    if tg:
        tags = [a.get_text(strip=True) for a in tg.find_all("a") if a.get_text(strip=True)]
    rel = "/" + path.relative_to(path.parent.parent).as_posix()
    m = re.search(r"/([^/]+)/(\d+)\.html$", rel)
    art_id = int(m.group(2)) if m else 0
    # 评论数：优先取 .head-info .comment 中的数字
    comments = 0
    head_info = soup.find(class_="head-info")
    if head_info:
        comment_span = head_info.find("span", class_="comment")
        if comment_span:
            cmt_text = comment_span.get_text(" ", strip=True)
            cmt_m = re.search(r"(\d+)", cmt_text)
            if cmt_m:
                comments = int(cmt_m.group(1))
    return {
        "id": art_id,
        "url": rel,
        "title": title or path.name,
        "time": pub_time,
        "author": author,
        "tags": tags,
        "comments": comments,
    }


def _local_articles_by_cat(out_dir: Path) -> dict:
    """扫描本地文章，按分类返回元数据列表（按 ID 降序）。"""
    by_cat = {s: [] for s in ALLOWED_CATEGORIES}
    for p in out_dir.rglob("*.html"):
        rel = p.relative_to(out_dir).as_posix()
        if not ART_RE.match("/" + rel):
            continue
        cat = rel.split("/")[0]
        if cat not in by_cat:
            continue
        meta = _extract_article_meta(p)
        if meta:
            meta["cat"] = cat
            meta["cat_label"] = CAT_LABELS.get(cat, cat)
            by_cat[cat].append(meta)
    for cat in by_cat:
        by_cat[cat].sort(key=lambda x: x["id"], reverse=True)
    return by_cat


def _format_list_time(time_str: str) -> tuple:
    """从 '2026年06月22日 06:35' 提取列表展示时间（今天 HH:MM，否则 MM-DD）。
    返回 (display_time, is_today)。"""
    m = re.search(r"(\d{4})年(\d{2})月(\d{2})日\s*(\d{2}):(\d{2})", time_str or "")
    if not m:
        return ("", False)
    year, mon, day, hour, minute = m.groups()
    try:
        from datetime import datetime
        now = datetime.now()
        if now.year == int(year) and now.month == int(mon) and now.day == int(day):
            return (f"{hour}:{minute}", True)
        return (f"{mon}-{day}", False)
    except Exception:
        return (f"{mon}-{day}", False)


def _build_source_list_item(soup, item: dict):
    """构造源站风格文章列表项 <li class='article-list'>..."""
    li = soup.new_tag("li", **{"class": "article-list"})
    figure = soup.new_tag("span", **{"class": "figure cg16"})
    li.append(figure)
    p = soup.new_tag("p", **{"class": "title"})
    t, is_today = _format_list_time(item.get("time", ""))
    if t:
        time_classes = ["badge"]
        if is_today:
            time_classes.append("red")
        time_badge = soup.new_tag("time", **{"class": " ".join(time_classes), "datetime": item["time"], "title": item["time"]})
        time_badge.string = t
        p.append(time_badge)
    comments = int(item.get("comments", 0) or 0)
    comment_badge = soup.new_tag("span", **{"class": "badge com"})
    comment_badge.append(soup.new_tag("i", **{"class": "iconfont icon-comment"}))
    comment_badge.append(str(comments))
    p.append(comment_badge)
    a = soup.new_tag("a", href=item["url"], title=item["title"], target="_blank")
    a["data-comments"] = str(comments)
    a["data-catename"] = item.get("cat_label", "")
    a.string = item["title"]
    p.append(a)
    li.append(p)
    return li


def _replace_new_post_list(html: str, items: list) -> str:
    """替换源站分类页 <ul class='new-post'> 内容为本站文章。"""
    soup = BeautifulSoup(html, "html.parser")
    ul = soup.find("ul", class_="new-post")
    if not ul:
        return html
    ul.clear()
    for item in items:
        ul.append(_build_source_list_item(soup, item))
    return str(soup)


def _build_pagination(soup, cat: str, page: int, total_pages: int, is_home: bool = False):
    """构造分页条 <div class='pagebar'> 替换原 pagebar。page 从 1 开始。
    is_home=True 时生成首页分页（/ /2/ /3/...），否则按分类分页。"""
    def _page_href(p: int) -> str:
        if is_home:
            return "/" if p == 1 else f"/{p}/"
        return f"/category-{cat}/" if p == 1 else f"/category-{cat}/{p}/"

    container = soup.new_tag("div", **{"class": "pagebar"})
    nav = soup.new_tag("div", **{"class": "nav-links"})

    if page > 1:
        a = soup.new_tag("a", href=_page_href(1), **{"class": "br page-numbers", "title": "首页"})
        a.string = "首页"
        nav.append(a)
        a = soup.new_tag("a", href=_page_href(page - 1), **{"class": "br page-numbers", "title": "上一页"})
        a.string = "上一页"
        nav.append(a)

    # 页码：最多显示 5 个，与源站风格一致
    if total_pages <= 5:
        page_range = list(range(1, total_pages + 1))
    else:
        start = max(1, page - 2)
        end = min(total_pages, start + 4)
        if end - start < 4:
            start = max(1, end - 4)
        page_range = list(range(start, end + 1))

    for p in page_range:
        if p == page:
            span = soup.new_tag("span", **{"class": "br page-numbers current"})
            span.string = str(p)
            nav.append(span)
        else:
            a = soup.new_tag("a", href=_page_href(p), **{"class": "br page-numbers", "title": f"第{p}页"})
            a.string = str(p)
            nav.append(a)

    if page < total_pages:
        a = soup.new_tag("a", href=_page_href(page + 1), **{"class": "br page-numbers", "title": "下一页"})
        a.string = "下一页"
        nav.append(a)
        a = soup.new_tag("a", href=_page_href(total_pages), **{"class": "br page-numbers", "title": "最后一页"})
        a.string = "尾页"
        nav.append(a)

    # 页码信息：与源站一致显示 "当前页 / 总页数 页"
    total_span = soup.new_tag("span", **{"class": "br page-numbers page-total"})
    total_span.string = f"{page} / {total_pages} 页"
    nav.append(total_span)

    container.append(nav)
    old = soup.find(class_="pagebar")
    if old:
        old.replace_with(container)
    else:
        ul = soup.find("ul", class_="new-post")
        if ul:
            ul.insert_after(container)


def _strip_pagination(soup) -> None:
    """移除分页区，避免指向源站页码的坏链。"""
    for cls in ("pagebar", "pagination", "pages", "f_pag", "pagenavi"):
        for el in soup.find_all(class_=cls):
            el.decompose()


def _fix_search_form(soup) -> None:
    """将源站搜索表单 action 改为本地 search.html，method 改为 GET。"""
    for form in soup.find_all("form"):
        action = (form.get("action") or "").lower()
        if "search" in action or "cmd.php" in action:
            form["action"] = "/search.html"
            form["method"] = "get"
            for inp in list(form.find_all("input", type="hidden")):
                if inp.get("name") == "cate":
                    inp.decompose()
            q_inp = form.find("input", attrs={"name": "q"})
            if q_inp and not q_inp.get("name"):
                q_inp["name"] = "q"


def _sanitize_local_links(soup, out_dir: Path) -> None:
    """若分类页/首页出现指向不存在的本地页面链接，则中和为 #，避免 404。
    但保留本站生成的分类分页链接（如 /category-zuankeba/2/）和首页分页（/2/），
    避免自误伤。"""
    cat_page_re = re.compile(r"^/category-(?:" + "|".join(ALLOWED_CATEGORIES) + r")/\d+/?$")
    home_page_re = re.compile(r"^/\d+/?$")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("/") or href.startswith("#"):
            continue
        if cat_page_re.match(href) or home_page_re.match(href):
            continue
        ext = os.path.splitext(href.split("?")[0])[1].lower()
        if ext in ASSET_EXT:
            continue
        local_path = out_dir / href.lstrip("/")
        if local_path.is_dir():
            local_path = local_path / "index.html"
        if not local_path.exists():
            a["href"] = "#"
            if a.get("target"):
                del a["target"]


def _prune_nav(soup, active_cat: str = None, is_home: bool = False) -> None:
    """清理导航：只保留「首页」和已镜像的 5 个分类，其余（线报酷/我的关注/豆瓣线报/微博线报/好单线报/值得买/其他区等）全部删除。
    同时补充葫芦侠、小刀两个没有独立 top-level 导航的分类。"""
    nav = soup.find("ul", class_="nav-ul")
    if not nav:
        return
    allowed_ids = {"nvabar-item-index"} | {f"navbar-category-{c}" for c in ALLOWED_CATEGORIES}
    for li in list(nav.find_all("li", recursive=False)):
        lid = li.get("id", "")
        if lid not in allowed_ids:
            li.decompose()
    # 同步已镜像分类的显示名（标签可能因需求变更而改名，如葫芦侠→葫芦侠三楼）
    for cat in ALLOWED_CATEGORIES:
        li = nav.find("li", id=f"navbar-category-{cat}")
        if li:
            a = li.find("a")
            if a is not None:
                a.string = CAT_LABELS[cat]
                a["title"] = CAT_LABELS[cat]
    # 确保每个已镜像分类都有导航项
    for cat in ALLOWED_CATEGORIES:
        lid = f"navbar-category-{cat}"
        if nav.find("li", id=lid):
            continue
        li = soup.new_tag("li", id=lid)
        a = soup.new_tag("a", href=f"/category-{cat}/", title=CAT_LABELS[cat])
        a.string = CAT_LABELS[cat]
        nav.append(li)
        li.append(a)
    # 高亮当前分类/首页
    for li in nav.find_all("li"):
        cls = list(li.get("class", []) or [])
        if "active" in cls:
            cls.remove("active")
        li["class"] = cls
    if is_home:
        home_li = nav.find("li", id="nvabar-item-index")
        if home_li:
            cls = list(home_li.get("class", []) or [])
            if "active" not in cls:
                cls.append("active")
            home_li["class"] = cls
    elif active_cat:
        cat_li = nav.find("li", id=f"navbar-category-{active_cat}")
        if cat_li:
            cls = list(cat_li.get("class", []) or [])
            if "active" not in cls:
                cls.append("active")
            cat_li["class"] = cls
    # 删除次级快捷导航条（源站含大量未镜像分类）
    for nav2 in soup.find_all("ul", class_="nav2-ul"):
        nav2.decompose()
    # 移除导航项内的「热帖」下拉子菜单（赚客吧/新赚吧等），用户要求只保留平铺分类
    for sub in soup.select(".nav-ul .dropdown-nav, .nav-ul .sub-nav, .nav-ul .toggle-btn"):
        sub.decompose()
    # 移除头部登录 / 用户中心图标（无后台、点击无效、暴露源站）
    for el in soup.select(".login.fr, .login"):
        el.decompose()
    # 给首页/分类/搜索页头部按钮补 title 提示，与文章页保持一致
    for el in soup.select(".header .dark-mode"):
        if not el.get("title"):
            el["title"] = "浅色/暗色模式"
    for el in soup.select(".header .search-button, .header #search-button"):
        if not el.get("title"):
            el["title"] = "搜索"
    # 移除页脚「关于本站」块（保留「联系我们 / 关注我们」）
    for el in soup.select(".f-about"):
        el.decompose()


def _remove_footer(soup) -> None:
    """移除页脚（联系我们/关注我们/QQ/微信/微博/二维码），这些属于源站联系方式，
    与镜像内容无关且用户要求首页不显示。"""
    for tag in ("footer", "div"):
        for el in soup.find_all(tag, class_=lambda c: isinstance(c, (str, list)) and "footer" in (c if isinstance(c, str) else " ".join(c))):
            el.decompose()
    for el in soup.find_all("footer"):
        el.decompose()


def _home_breadcrumb(soup) -> None:
    """首页面包屑仅保留「首页」。就地修改 soup。"""
    mbx = soup.find(class_="mianbaoxie")
    if mbx:
        # 保留第一个首页链接，其余清空
        first_a = mbx.find("a")
        mbx.clear()
        if first_a:
            mbx.append(first_a)


def _inject_nav_tools(soup: BeautifulSoup) -> None:
    """注入移动端菜单与搜索按钮的自包含交互脚本。源站 common.js 被剥离后，
    .m-nav-btn 与 #search-button 需要额外事件才能工作。幂等。"""
    body = soup.body
    if body is None:
        return
    if body.find("script", id="xianbao-nav-tools"):
        return
    script = soup.new_tag("script", id="xianbao-nav-tools")
    script.string = (
        "(function(){"
        "function t(){var a=document.getElementById('search-area');"
        "if(!a)return;var h=a.classList.contains('hidden');"
        "var d=a.style.display==='none'||window.getComputedStyle(a).display==='none';"
        "if(h||d){a.classList.remove('hidden');a.style.display='block';}"
        "else{a.classList.add('hidden');a.style.display='none';}}"
        "function m(){var n=document.querySelector('.responsive-nav');"
        "var i=document.querySelector('.m-nav-btn i.iconfont');if(!n)return;"
        "var o=n.style.display==='block';n.style.display=o?'none':'block';"
        "if(i)i.classList.toggle('active',!o);}"
        "var b=document.querySelector('.m-nav-btn');"
        "if(b)b.addEventListener('click',m);"
        "var s=document.getElementById('search-button');"
        "if(s)s.addEventListener('click',t);"
        "})();"
    )
    body.append(script)


def _ensure_body_class(soup, cls: str) -> None:
    """给 <body> 追加一个类（幂等），用于作用域化覆盖 CSS（如列表页居中）。"""
    body = soup.body
    if body is None:
        return
    cur = list(body.get("class", []) or [])
    if cls not in cur:
        cur.append(cls)
        body["class"] = cur


def rebuild_category_page(
    template_path: Path,
    out_path: Path,
    out_dir: Path,
    items: list,
    *,
    cat: str = None,
    page: int = 1,
    total_pages: int = 1,
    title: str = None,
    is_home: bool = False,
) -> None:
    """用源站分类页模板生成本地分类页（或首页），只保留存在的文章链接。"""
    html = template_path.read_text(encoding="utf-8", errors="replace")
    # 列表页同样必须剥离源站 common.js：它会自绑定 #search-button / .m-nav-btn，
    # 与下方 _inject_nav_tools 注入的自包含交互脚本冲突（双重 toggle），导致分类页
    # 点击搜索框反而隐藏、移动端汉堡菜单错乱。文章页由 strip_chrome 处理，列表页
    # 此前漏掉（首页因复用已剥离的 zuankeba 模板而侥幸正常）。
    html = strip_common_js(html)
    # 源站实时推送脚本（meta.php）删除；iconfont 外链（at.alicdn.com）本地化，
    # 避免 CDN 偶发超时导致图标缺字。c_html_js_add.php 保留（zbp 定义所在）。
    html = strip_push_scripts(html)
    html = localize_iconfont(html)
    html = _replace_new_post_list(html, items)
    soup = BeautifulSoup(html, "html.parser")
    if title and soup.title:
        soup.title.string = f"{title}-线报酷镜像"
    # 移除源站动态脚本（会往列表prepend置顶公告 / 实时推送），避免静态镜像出现源站链接
    for s in soup.find_all("script", src=re.compile(r"meta\.php")):
        s.decompose()
    if total_pages > 1:
        _build_pagination(soup, cat or "", page, total_pages, is_home=is_home)
    else:
        _strip_pagination(soup)
    _fix_search_form(soup)
    _sanitize_local_links(soup, out_dir)
    _prune_nav(soup, active_cat=cat if not is_home else None, is_home=is_home)
    _remove_footer(soup)
    if is_home:
        _home_breadcrumb(soup)
    # 移除右侧热榜侧栏（十二/二十四/四十八小时榜），使帖子列表居中自适应
    _aside = soup.find("aside", id="sidebar")
    if _aside:
        _aside.decompose()
    _ensure_body_class(soup, "xianbao-list")
    _inject_nav_tools(soup)
    out_path.write_text(str(soup), encoding="utf-8")


def rebuild_category_pages(out_dir: Path) -> None:
    """重新生成分类页：使用源站模板，但只列出本地实际存在的文章。"""
    cat_names = {
        "zuankeba": "赚客吧",
        "xinzuanba": "新赚客吧",
        "xiaodigu": "小嘀咕",
        "huluxia": "葫芦侠三楼",
        "xiaodao": "小刀娱乐网",
    }
    by_cat = _local_articles_by_cat(out_dir)
    PAGESIZE = INDEX_PAGE_SIZE
    for cat in ALLOWED_CATEGORIES:
        template = out_dir / f"category-{cat}" / "index.html"
        if not template.exists():
            continue
        items = by_cat.get(cat, [])
        total_pages = max(1, (len(items) + PAGESIZE - 1) // PAGESIZE)
        for page in range(1, total_pages + 1):
            start = (page - 1) * PAGESIZE
            page_items = items[start:start + PAGESIZE]
            if page == 1:
                out_path = out_dir / f"category-{cat}" / "index.html"
                page_title = cat_names[cat]
            else:
                out_path = out_dir / f"category-{cat}" / str(page) / "index.html"
                out_path.parent.mkdir(parents=True, exist_ok=True)
                page_title = f"{cat_names[cat]} - 第{page}页"
            rebuild_category_page(
                template, out_path, out_dir, page_items,
                cat=cat, page=page, total_pages=total_pages, title=page_title
            )
        # 清理不再需要的旧分页目录
        cat_dir = out_dir / f"category-{cat}"
        if cat_dir.exists():
            for sub in cat_dir.iterdir():
                if sub.is_dir() and sub.name.isdigit():
                    page_num = int(sub.name)
                    if page_num > total_pages:
                        shutil.rmtree(sub)


def build_hub(out_dir: Path):
    """生成首页：使用源站 category-zuankeba 模板，聚合所有分类文章并支持分页。"""
    cat = "zuankeba"
    template = out_dir / f"category-{cat}" / "index.html"
    if not template.exists():
        return _build_legacy_hub(out_dir)
    by_cat = _local_articles_by_cat(out_dir)
    # 首页聚合全部 5 个分类的最新文章，按文章 ID 降序
    all_items = []
    for c in ALLOWED_CATEGORIES:
        all_items.extend(by_cat.get(c, []))
    all_items.sort(key=lambda x: x["id"], reverse=True)
    PAGESIZE = INDEX_PAGE_SIZE
    total_pages = max(1, (len(all_items) + PAGESIZE - 1) // PAGESIZE)
    for page in range(1, total_pages + 1):
        start = (page - 1) * PAGESIZE
        page_items = all_items[start:start + PAGESIZE]
        if page == 1:
            out_path = out_dir / "index.html"
            page_title = "首页"
        else:
            out_path = out_dir / str(page) / "index.html"
            out_path.parent.mkdir(parents=True, exist_ok=True)
            page_title = f"首页 - 第{page}页"
        rebuild_category_page(
            template, out_path, out_dir, page_items,
            cat="", page=page, total_pages=total_pages, title=page_title, is_home=True
        )
    # 清理不再需要的旧首页分页目录
    for sub in out_dir.iterdir():
        if sub.is_dir() and sub.name.isdigit():
            page_num = int(sub.name)
            if page_num > total_pages:
                shutil.rmtree(sub)


# ---------------------------------------------------------------------------
# 渲染页面（单页）
# ---------------------------------------------------------------------------
def render_page_ex(page, url: str, path: str, raw_docs: dict, state=None):
    """导航并渲染单页，返回 (ok, rendered_html, raw_html, reason)。

    reason 取值：
      - "ok"           渲染成功
      - "dead"         404/410，已记入 state.dead（下次不再爬取）
      - "server_error" 5xx：重试耗尽后仍失败
      - "network"      导航超时/异常（网络抖动）

    返回 reason 是为了让调用方能区分「页面真的到底了」与「网络临时故障」，
    避免把源站抖动误判成「该分类已抓完」（H4）。
    """
    _status = None
    _nav_ok = False
    for _attempt in range(3):
        try:
            _resp = page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
            _nav_ok = True
            _status = _resp.status if _resp is not None else None
            # H3 修复：源站 5xx（临时故障/限流）不应被当作正常页面渲染入库，
            # 否则错误页会被写进镜像并计入 crawled，污染内容。
            # 现将 5xx 视同一次失败并重试；重试耗尽后返回 server_error 由调用方跳过。
            if _status is not None and _status >= 500:
                print(f"::warning:: 源站 {_status}（第 {_attempt+1}/3 次）{url}",
                      file=sys.stderr)
                if _attempt < 2:
                    time.sleep(2 ** _attempt)
                    continue
                return (False, None, None, "server_error")
            break
        except PWTimeout:
            print(f"::warning:: 导航超时（第 {_attempt+1}/3 次）{url}", file=sys.stderr)
        except Exception as e:
            print(f"::warning:: 导航失败（第 {_attempt+1}/3 次）{url}: {e}", file=sys.stderr)
        if _attempt < 2:
            time.sleep(2 ** _attempt)
    if not _nav_ok:
        return (False, None, None, "network")
    if _status in (404, 410) and state is not None:
        record_dead(state, path, f"HTTP {_status}", permanent=True)
        print(f"==> 永久失效（{_status}），已记录跳过：{url}")
        return (False, None, None, "dead")

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
            # 触发懒加载：源站图片用 IntersectionObserver + 滚动懒加载，占位符
            # <img src="/plus/api/image.php"> 需滚动进入视口后才被 JS 替换为
            # image.php?imgurl=<真实CDN>。不滚动则永远停在占位符，镜像后图片 404。
            # 逐段滚到页面底部再滚回顶部，等待所有占位符被替换，再读 DOM。
            #
            # 注：9/5 全站扫描在**已滚动过**的页面上仍发现 10810 个残留占位符，
            # 说明滚动并未可靠触发替换；图片实际由 localize_images 解析 imgurl 参数后
            # 经源站 image.php 代理取回（修复率 99%）。据此判断滚动很可能是冗余的。
            # 置 SKIP_LAZY_SCROLL=1 可跳过「滚动 + 其后 1.5s 等待」，约省 2.3s/页
            # （600 页/轮 ≈ 20 分钟）；默认 0 保持滚动，待 CI 灰度验证图片无损后再
            # 改默认值。
            if not SKIP_LAZY_SCROLL:
                try:
                    page.evaluate(
                        "() => new Promise(res => {"
                        "  let y = 0; const step = 800;"
                        "  const max = document.body.scrollHeight || 0;"
                        "  const tick = () => {"
                        "    window.scrollTo(0, Math.min(y, max)); y += step;"
                        "    if (y <= max + step) { setTimeout(tick, 120); }"
                        "    else { window.scrollTo(0, 0); res(); }"
                        "  };"
                        "  tick();"
                        "})"
                    )
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
    return (True, rendered, raw, "ok")


def render_page(page, url: str, path: str, raw_docs: dict, state=None):
    """render_page_ex 的 3 元组兼容封装，保持既有调用点与测试签名不变。

    需要区分失败原因（例如判断某分类是否真的「已抓完」）时应改用 render_page_ex。
    """
    ok, rendered, raw, _reason = render_page_ex(page, url, path, raw_docs, state)
    return (ok, rendered, raw)


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
                sig = content_signature(rendered)
                now = _now()
                # 变更感知：recheck 且正文哈希变化 → 先归档旧快照，再覆盖写盘
                if kind == "recheck":
                    prev = state["crawled"].get(path, {})
                    if prev.get("hash") != sig:
                        _archive_version(state, path, local)
                        state["stats"]["updated"] += 1
                else:
                    is_new = path not in state["crawled"]
                    if is_new and ART_RE.match(path):
                        state["stats"]["articles"] += 1
                    elif is_new:
                        state["stats"]["pages"] += 1
                outp.write_text(rendered, encoding="utf-8")
                rec = state["crawled"].setdefault(
                    path, {"hash": sig, "local": local, "last_check": now})
                rec["hash"] = sig
                rec["local"] = local
                rec["last_check"] = now
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
                    _crawl_delay()
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
                        # H4 修复：改用 render_page_ex 以区分失败原因。
                        # 原逻辑把「网络抖动 / 源站 5xx」与「翻到不存在的页」混为一谈，
                        # 只要 ok=False 就累加 category_miss，连续 CONSEC_MISS_LIMIT
                        # 次便把该分类永久标记为 exhausted —— 源站一次临时故障就能让
                        # 整个分类再也不翻页，并进而使依赖 all(category_exhausted) 的
                        # 回填完成判定永不成立。现仅对「确实到底」（404/410）计数；
                        # 网络类与 5xx 只跳过本页，不计数、不判定抓完。
                        ok, rendered, raw, reason = render_page_ex(
                            page, url, path, raw_docs, state)
                        if not ok:
                            if reason in ("network", "server_error"):
                                print(f"==> 分类 {slug} 第 {n} 页抓取失败"
                                      f"（{reason}），跳过本页且不判定为已抓完")
                                continue
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
                            _crawl_delay()
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
                # 注：回填完成判定已移至下方 drain_frontier 之后 —— 此处 pending 刚被
                # 上方「各分类第 1 页探新帖」步骤补充，必然非空，故原判定永不成立。

            # ---- 排空待处理队列（跨运行续爬，保证全量备份不丢页）----
            drain_frontier(page, raw_docs, save_page, state, counter)

            # ---- 回填完成判定（一次性标记，与「源站持续更新」解耦）----
            # 修复要点：原判定置于 drain 之前，pending 恒被第 1 页新帖补充而永不为空，
            # 导致 maintenance 复查从未启动（实测 recheck_idx 恒为 0，28632 篇存量
            # 文章的新评论 / 内容更新从未同步）。现移到 drain 之后判定，并改用一次性
            # 标记 backfill_complete：一旦置位即不回退，后续新帖增量与复查并行。
            if mark_backfill_if_complete(state):
                print("==> 全部分类抓取完成（回填完成），"
                      "进入 maintenance（维护/增量更新）模式")

            # ---- maintenance：抽样复查已抓文章（检测新评论/内容更新）----
            if state["mode"] == "maintenance" or state.get("backfill_complete"):
                # 仅复查文章页：列表页（/category-xxx/、/category-xxx/N/ 等）每轮都会
                # 重新生成，复查没有增量价值，只会挤占单轮配额。
                paths = [p for p in state["crawled"].keys() if ART_RE.match(p)]
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
                            _crawl_delay()
        finally:
            browser.close()

    # 落地索引与首页 hub
    # H2 修复：后处理是全轮最易超时/崩溃的阶段（localize_images 每轮全量扫描数万
    # 个 HTML，随镜像增长而变慢）。原逻辑把 save_state 放在函数末尾、且不在 finally
    # 中，一旦此处抛出，本轮全部 crawled 记录都会丢失（只剩 checkpoint 的进度）。
    # 现用 try/finally 保证无论成败都先落盘一次；末尾仍会再写一次（覆盖写，幂等）。
    try:
        n_idx = build_search_index(OUT_DIR)
        build_hub(OUT_DIR)
        rebuild_category_pages(OUT_DIR)

        # 后处理：补全缺失资源 + 剥离注入/分析脚本
        # （仅扫描本轮新产生的文件，避免随镜像增长而每轮全量重扫导致超时）
        fill_missing(state, since=run_start_ts)
        stripped = strip_injection_scripts(set(), since=run_start_ts)
        stripped_analytics = strip_analytics_scripts(since=run_start_ts)
        # 图片本地化：外站图下载到本地，防源站删帖/删图后无法查看
        img_stats = localize_images(OUT_DIR)
    finally:
        try:
            save_state(OUT_DIR / ".crawl-state.json", state)
        except Exception as _e:
            print(f"::warning:: 后处理阶段状态落盘失败: {_e}", file=sys.stderr)

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
        "images_localized": img_stats,
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
            # 必须用 with 保证句柄释放：本函数会遍历数千个产物文件，
            # 裸 open().read() 会累积未关闭句柄，Windows 下还会锁定文件
            # 使其无法被后续写盘覆盖（表现为"文件被占用"的偶发失败）。
            with open(fp, encoding="utf-8", errors="replace") as fh:
                text = fh.read()
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
            # 同上：with 确保句柄释放，避免遍历大量 JS 文件时泄漏。
            with open(jf, encoding="utf-8", errors="replace") as fh:
                src = fh.read()
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


# 二维码服务：这些外站图片本质是「扫码跳活动」，其内容（编码串）就藏在 URL 参数里，
# 完全可在本地用 qrcode 库重生，从而彻底去掉对 qrickit.com 等第三方服务的依赖。
# 注意：必须用「精确 host 后缀匹配（含边界点）」，不能用子串包含判断，
# 否则 qr.alipay.com.evil.com 这类伪装域名会被误判为可信支付宝域名
# （CodeQL py/incomplete-url-substring-sanitization，High）。
_QR_HOST_SUFFIXES = (".qrickit.com", ".qrserver.com", ".qr.alipay.com")


def _is_qr_host(netloc: str) -> bool:
    """判断 host 是否属于已知二维码服务（精确后缀匹配，防子串伪装）。"""
    host = netloc.lower().split(":")[0]  # 去端口
    for suf in _QR_HOST_SUFFIXES:
        if host == suf[1:] or host.endswith(suf):
            return True
    # 保留原 qrcode.* 的宽泛意图，但按 label 边界精确匹配（evilqrcode.com 不算）
    if "qrcode" in host.split("."):
        return True
    return False


def _qr_payload(url: str):
    """从二维码服务图片 URL 中提取应编码的内容；无法提取返回 None。"""
    p = urlparse(url)
    q = parse_qs(p.query)
    if "d" in q:                      # qrickit.com?d=<data>
        return q["d"][0]
    if "data" in q:                   # api.qrserver.com?data=<data>
        return q["data"][0]
    if _is_qr_host(p.netloc):
        return url                    # 支付宝短码：内容即该 URL 本身
    return None


def _regen_qr(url: str, dst: Path) -> bool:
    """用 qrcode 库把二维码内容重生为本地 PNG。成功返回 True。"""
    try:
        import io
        import qrcode
    except ImportError:
        return False
    payload = _qr_payload(url)
    if not payload:
        return False
    try:
        img = qrcode.make(payload)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
        if not data:
            return False
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(data)
        return True
    except Exception as e:
        print(f"::warning:: 二维码本地重生失败 {url}: {e}", file=sys.stderr)
        return False


def _proxy_pair(url: str):
    """源站图片代理 URL -> (真实CDN地址, 实际下载地址)。

    真实CDN地址用于本地保存路径（每图独立，避免碰撞到同一文件）；
    实际下载地址走源站代理（真实 CDN 有 Referer 防盗链，直连会 403）。
    非代理 URL 返回 (url, url)。"""
    m = re.search(r"/plus/api/image\.php\?(.*)$", url, re.I | re.S)
    if not m:
        return (url, url)
    qs = parse_qs(m.group(1))
    real = qs.get("imgurl") or qs.get("url")
    if not real:
        return (url, url)
    real = real[0]
    if not real.startswith(("http://", "https://")):
        return (url, url)
    fetch = "https://" + ORIGIN_NETLOC + "/plus/api/image.php?imgurl=" + quote(real, safe="")
    return (real, fetch)


def _resolve_dir_file_conflict(parent: Path):
    """parent 的某级祖先已是一个【文件】，与待创建的目录同名冲突（源站常同时
    存在 `/forum` 文件与 `/forum/202605/...` 目录，二者映射到站内同一路径）。
    自浅到深定位第一个这样的文件，改名(.conflict-<hash>)避让，保留原文件不
    丢失，随后即可正常建目录。"""
    for i in range(1, len(parent.parts) + 1):
        p = Path(*parent.parts[:i])
        if p.is_file():
            moved = p.with_name(p.name + ".conflict-" + hashlib.md5(str(p).encode()).hexdigest()[:8])
            try:
                p.rename(moved)
            except OSError:
                pass
            break


def localize_images(out_dir: Path, *, force: bool = False) -> dict:
    """下载文章页中的外站 <img>（src / data-src / data-original / srcset）到本地
    ``out_dir/zb_users/remote/<host>/<path>``，并把链接改写成站内相对路径。
    目的：源站删帖 / 删图后，镜像站仍可正常查看（防删帖）。

    特性：
      - 幂等：本地已存在且非空则跳过下载；URL 按 host+path 去重，单图只下一遍。
      - 多 Referer 重试：部分 CDN（如 at.alicdn.com）会按 Referer 防盗链，依次尝试
        多个候选 Referer，显著提升商品图抓取成功率。
      - 二维码本地重生：qrickit.com 等二维码图片不再外链，改用 qrcode 本地生成 PNG。
      - 下载失败的外站图保留原链接（不比原来更差），并记录到 ``.dead_remote_imgs.json``。
      - 每次全量扫描已镜像的 5 个文章目录；即便后续 render 把本地化后的 HTML 重新
        覆盖回外站链接，下一轮 localize 也会再次修正，保证持久可查。
    """
    out_dir = Path(out_dir)
    remote_re = re.compile(r"^https?://", re.I)
    illegal = re.compile(r'[\\:*?"<>|]')

    # 注：图片 URL 的规范化由模块级 `_normalize_img_url` 负责（见 _proxy_abs_url 之后），
    # 它会把站内相对懒加载占位符（/plus/api/image.php?imgurl=<真实CDN>）转成绝对 URL，
    # 使存量文章的图片也能被本函数本地化。

    # 读取历史死链清单：已确认下载失败的外站图，本轮直接跳过（保留原链接），
    # 不再每 run 重下 + 8×30s 重试，避免逼近单 job 6h 超时。
    dead_path = out_dir / ".dead_remote_imgs.json"
    dead_set = set()
    if dead_path.is_file():
        try:
            dead_set = set(json.loads(dead_path.read_text(encoding="utf-8")))
        except Exception:
            dead_set = set()

    def rel_path(url: str):
        """外站图片 URL -> 站内相对路径（无前缀）。非 http(s) 或本机返回 None。

        实现下沉到模块级 `img_rel_path`：与批量修复工具共用同一套路径/命名规则，
        避免两处规则漂移导致「同一张图落到两个不同位置」这类隐蔽裂图。
        """
        return img_rel_path(url)

    def qr_local_rel(url: str):
        payload = _qr_payload(url)
        if not payload:
            return None
        h = hashlib.md5(payload.encode("utf-8")).hexdigest()[:12]
        return f"zb_users/remote/qr/{h}.png"

    # 论坛「查看页」式 URL（.../xxx.jpg/image.html）落盘后扩展名与真实内容不符，
    # 浏览器按 .html 请求会 404 或被当成文档解析 → 裂图。命中这些扩展名且响应
    # Content-Type 确为图片时，按真实类型改名，并把改名后的路径回传给调用方。
    NON_IMAGE_EXTS = {".html", ".htm", ".php", ".asp", ".aspx", ".jsp", ".do", ""}

    # 论坛 URL 常带「查看页」末段（/image、/image.html、/thumb…）。这些末段有时
    # 会被 CDN 拒（实测 s4.cdn.xianbao.net/.../packet.png/image 恒 403，去掉
    # /image 后 200）。作为**下载兜底**再试一次去尾版本；落盘路径 rel 不变，
    # 以免与存量 400+ 张 `.../xxx.jpg/image.webp` 的目录结构冲突。
    VIEW_SUFFIX_SEGS = {"image", "image.html", "thumb", "thumbnail"}
    IMG_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif")

    def _url_variants(u: str):
        yield u
        p = urlparse(u)
        segs = (p.path or "").split("/")
        if len(segs) >= 2 and segs[-1].lower() in VIEW_SUFFIX_SEGS:
            trimmed = "/".join(segs[:-1])
            if trimmed.lower().endswith(IMG_EXTS):
                yield urlunparse(p._replace(path=trimmed))

    def ensure_download(url: str, rel: str, referer_hint: str = None):
        """下载远程图片。成功返回**实际落盘的站内相对路径**（可能因扩展名纠正
        而与入参 rel 不同），失败返回 None。返回值可直接当布尔用。"""
        dst = out_dir / rel
        if dst.exists() and dst.is_file() and dst.stat().st_size > 0 and not force:
            return rel
        # 防御：源站同时存在 `/forum`(文件) 与 `/forum/202605/...`(目录) 且映射到
        # 同一站内路径时，若先落的是文件，后续建子目录的 mkdir 会抛 FileExistsError
        # 使整轮渲染崩溃（非确定性：取决于图片处理顺序，故时好时坏）。遇冲突把挡路
        # 的【文件】改名避让（保留、不删），再建目录，确保不崩、不丢数据。
        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
        except FileExistsError:
            _resolve_dir_file_conflict(dst.parent)
            dst.parent.mkdir(parents=True, exist_ok=True)
        # 候选 Referer：先试当前文章页（最贴近源站上下文），再试图片自身源站
        # （许多 CDN 仅接受本站 Referer 或无 Referer，错 Referer 会回 403），
        # 最后用各镜像域名兜底。实测 pic.xiaodigu.cn 等无 Referer 即 200。
        img_host = urlparse(url).netloc.lower()
        candidates = []
        if referer_hint:
            candidates.append(referer_hint)
        if img_host:
            candidates.append(f"https://{img_host}/")
            if not img_host.startswith("www."):
                candidates.append(f"https://www.{img_host}/")
        candidates.append("")  # 无 Referer 兜底
        candidates += ["https://new.xianbao.fun/", "https://new.ixbk.net/",
                       "https://new.xianbao.net/"]
        # 去重且保序
        _seen, _ordered = set(), []
        for _c in candidates:
            if _c not in _seen:
                _seen.add(_c)
                _ordered.append(_c)
        candidates = _ordered
        last_err = None
        downloaded = False
        for try_url in _url_variants(url):
            # 单图**全局**请求预算：MAX_ATTEMPTS=8 次 urlopen，每次 timeout=30s，
            # 最坏 8×30s≈240s（仅当服务端挂起时才触顶；绝大多数失败是 DNS/连接
            # 拒绝，瞬时返回）。已知死图由 dead_set 跳过、不进入此处，故该最坏耗时
            # 只作用于当轮「新」死图，不会逐轮累积逼近 6h 超时。
            attempts, MAX_ATTEMPTS = 0, 8
            for ref in candidates:
                _retry = 0
                while attempts < MAX_ATTEMPTS:
                    attempts += 1
                    hdr = {
                        "User-Agent": USER_AGENT,
                        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
                    }
                    if ref:
                        hdr["Referer"] = ref
                    try:
                        req = urllib.request.Request(try_url, headers=hdr)
                        with urllib.request.urlopen(req, timeout=30) as r:
                            data = r.read()
                        if not data:
                            last_err = RuntimeError("空响应体")
                            break
                        ctype = (r.headers.get("Content-Type") or
                                 "").split(";")[0].strip()
                        cur_ext = os.path.splitext(dst.name)[1].lower()
                        if cur_ext in NON_IMAGE_EXTS and ctype.startswith("image/"):
                            ext = mimetypes.guess_extension(ctype) or ".bin"
                            dst = dst.with_name(
                                os.path.splitext(dst.name)[0] + ext)
                        dst.write_bytes(data)
                        downloaded = True
                        break
                    except Exception as e:
                        last_err = e
                        code = getattr(e, "code", None)
                        # 403 一并退避重试：实测 pic.xiaodigu.cn 的 403 是**并发
                        # 限流**而非 Referer 策略（8 并发抽样 40 张有 12 张 403，
                        # 串行间隔 1s 重试 12/12 全部 200）。历史 400+ 张外链图
                        # 没本地化成、被记进 .dead_remote_imgs.json，根因就是
                        # 这个 403 当时不重试。429/503 同理；无状态码则是瞬时
                        # 网络错误（SSL EOF / 连接重置）。
                        if _retry < 2 and (code in (403, 429, 503) or code is None):
                            _retry += 1
                            time.sleep(2 * _retry)
                            continue
                        break
                if downloaded:
                    break
            if downloaded:
                break
        if downloaded:
            # dst 可能已被扩展名纠正，回传真实落盘路径（POSIX 风格站内相对路径）
            return dst.relative_to(out_dir).as_posix()
        if last_err:
            print(f"::warning:: 远程图片下载失败 {url}: {last_err}", file=sys.stderr)
        return None

    def handle_img_attr(img, attr, url, referer_hint, stats, failed_urls):
        """处理单个 <img> 属性里的外站 URL。返回是否改写了该属性。"""
        nonlocal changed_flag
        # 二维码服务：本地重生
        if _is_qr_host(urlparse(url).netloc):
            rel = qr_local_rel(url)
            if rel and (out_dir / rel).is_file() and not force:
                img[attr] = "/" + rel
                changed_flag = True
                stats["rewritten"] += 1
                stats["reused"] += 1
                ok_urls.add(url)
                return True
            if rel and _regen_qr(url, out_dir / rel):
                img[attr] = "/" + rel
                changed_flag = True
                stats["rewritten"] += 1
                stats["qr_regen"] = stats.get("qr_regen", 0) + 1
                ok_urls.add(url)
                return True
            # 重生失败：保留外链（不比原来更差）
            failed_urls.append(url)
            return False
        # 死链跳过：历史已确认失败的外站图直接保留原链接、不再重试下载。
        # force 模式（手动 localize --force）下仍重试，便于源站恢复后复活。
        if not force and url in dead_set:
            failed_urls.append(url)
            return False
        real_url, fetch_url = _proxy_pair(url)
        rel = rel_path(real_url)
        if rel is None:
            return False
        if (out_dir / rel).is_file() and (out_dir / rel).stat().st_size > 0 and not force:
            img[attr] = "/" + rel
            changed_flag = True
            stats["rewritten"] += 1
            stats["reused"] += 1
            ok_urls.add(url)
            return True
        eff_rel = ensure_download(fetch_url, rel, referer_hint)
        if eff_rel:
            # 用实际落盘路径改写（扩展名可能已被 Content-Type 纠正）
            img[attr] = "/" + eff_rel
            changed_flag = True
            stats["rewritten"] += 1
            stats["downloaded"] += 1
            ok_urls.add(url)
            return True
        failed_urls.append(url)
        return False

    stats = {"scanned": 0, "images_total": 0, "downloaded": 0,
             "reused": 0, "rewritten": 0, "failed": 0, "qr_regen": 0}
    failed_urls = []
    # 本轮成功本地化的 URL：写死链清单时用来剔除「曾经失败、现已复活」的条目，
    # 否则清单只增不减，很快就全是过期噪声（实测一次修复后 401 条里 400 条已失效）。
    ok_urls = set()

    for cat in ALLOWED_CATEGORIES:
        for sub in (cat, f"category-{cat}"):
            cat_dir = out_dir / sub
            if not cat_dir.is_dir():
                continue
            for hf in cat_dir.rglob("*.html"):
                # 跳过归档快照（archive/<cat>/<id>/...），其图片已随原帖本地化
                if "/archive/" in hf.as_posix().replace("\\", "/"):
                    continue
                stats["scanned"] += 1
                try:
                    soup = BeautifulSoup(
                        hf.read_text(encoding="utf-8", errors="replace"), "html.parser")
                except Exception:
                    continue
                changed_flag = False
                referer_hint = "https://" + DOMAIN_POOL[0] + "/" + \
                    hf.relative_to(out_dir).as_posix()
                for img in soup.find_all("img"):
                    for attr in ("src", "data-src", "data-original"):
                        val = img.get(attr)
                        if not isinstance(val, str) or not val.strip():
                            continue
                        # 站内相对占位符（/plus/api/image.php?imgurl=...）先规范化成绝对 URL，
                        # 否则会被 remote_re 过滤掉，导致懒加载占位图永远无法本地化。
                        url = _normalize_img_url(val.strip())
                        if not remote_re.match(url):
                            continue
                        stats["images_total"] += 1
                        handle_img_attr(img, attr, url, referer_hint, stats, failed_urls)
                    # srcset（逗号分隔的 url [描述符] 列表，跳过二维码）
                    ss = img.get("srcset")
                    if isinstance(ss, str) and ss.strip():
                        new_parts = []
                        modified = False
                        for part in (s.strip() for s in ss.split(",")):
                            toks = part.split()
                            if not toks:
                                new_parts.append(part)
                                continue
                            u = _normalize_img_url(toks[0])
                            if not remote_re.match(u):
                                new_parts.append(part)
                                continue
                            if _is_qr_host(urlparse(u).netloc):
                                new_parts.append(part)
                                continue
                            # 死链跳过：历史已确认失败的外站图直接保留原链接、不再重试下载
                            if not force and u in dead_set:
                                new_parts.append(part)
                                failed_urls.append(u)
                                continue
                            real_url, fetch_url = _proxy_pair(u)
                            rel = rel_path(real_url)
                            if rel is None:
                                new_parts.append(part)
                                continue
                            stats["images_total"] += 1
                            _eff = None
                            if (out_dir / rel).is_file() and \
                                    (out_dir / rel).stat().st_size > 0 and not force:
                                toks[0] = "/" + rel
                                new_parts.append(" ".join(toks))
                                modified = True
                                changed_flag = True
                                stats["rewritten"] += 1
                                stats["reused"] += 1
                                ok_urls.add(u)
                            elif (_eff := ensure_download(fetch_url, rel,
                                                          referer_hint)):
                                toks[0] = "/" + _eff
                                new_parts.append(" ".join(toks))
                                modified = True
                                changed_flag = True
                                stats["rewritten"] += 1
                                stats["downloaded"] += 1
                                ok_urls.add(u)
                            else:
                                new_parts.append(part)
                                failed_urls.append(u)
                        if modified:
                            img["srcset"] = ", ".join(new_parts)
                if changed_flag:
                    try:
                        hf.write_text(str(soup), encoding="utf-8")
                    except Exception as e:
                        print(f"::warning:: 重写 {hf} 失败: {e}", file=sys.stderr)

    # 顶层页面（站点首页/搜索页）同样可能有外站图或二维码，纳入本地化保证持久可查
    for top in ("index.html", "search.html"):
        hf = out_dir / top
        if not hf.is_file():
            continue
        stats["scanned"] += 1
        try:
            soup = BeautifulSoup(
                hf.read_text(encoding="utf-8", errors="replace"), "html.parser")
        except Exception:
            continue
        changed_flag = False
        referer_hint = "https://" + DOMAIN_POOL[0] + "/" + top
        for img in soup.find_all("img"):
            for attr in ("src", "data-src", "data-original"):
                val = img.get(attr)
                if not isinstance(val, str) or not val.strip():
                    continue
                if not remote_re.match(val.strip()):
                    continue
                url = val.strip()
                stats["images_total"] += 1
                handle_img_attr(img, attr, url, referer_hint, stats, failed_urls)
        if changed_flag:
            try:
                hf.write_text(str(soup), encoding="utf-8")
            except Exception as e:
                print(f"::warning:: 重写 {hf} 失败: {e}", file=sys.stderr)

    # 死链清单：累积历史失败（dead_set 已在函数入口读取），但要剔除本轮已成功
    # 本地化的 URL，否则清单只增不减、很快沦为全是过期条目的噪声。
    if failed_urls or ok_urls:
        merged = (dead_set | set(failed_urls)) - ok_urls
        if merged:
            dead_path.write_text(
                json.dumps(sorted(merged), ensure_ascii=False, indent=2),
                encoding="utf-8")
        elif dead_path.is_file():
            dead_path.unlink()  # 全部复活，清单清空即删除
    print(f"==> 图片本地化：扫描 {stats['scanned']} 篇文章，"
          f"外站图 {stats['images_total']} 处，下载 {stats['downloaded']}，"
          f"二维码重生 {stats.get('qr_regen', 0)}，复用 {stats['reused']}，"
          f"改写 {stats['rewritten']}，失败 {len(failed_urls)}")
    return stats


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="线报酷镜像渲染/本地化脚本")
    parser.add_argument(
        "command", nargs="?", default="crawl",
        choices=["crawl", "localize"],
        help="crawl=完整抓取渲染（默认）；localize=仅把已缓存帖子中的外站图片"
             "下载到本地并改写链接（防删帖），不重新抓取")
    parser.add_argument("--force", action="store_true",
                        help="localize 模式：强制重新下载已存在的图片")
    args = parser.parse_args()
    if args.command == "localize":
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        localize_images(OUT_DIR, force=args.force)
    else:
        main()
