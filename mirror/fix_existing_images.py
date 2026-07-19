#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""存量文章图片回源修复脚本（一次性）。

问题背景
--------
源站图片用 JS 懒加载：静态 HTML 里 <img src="/plus/api/image.php"> 只是占位符，
图片滚动进入视口后才被替换为 image.php?imgurl=<真实CDN>。
旧版 render_page 抓取文章页时未滚动，导致抓到的图片停在占位符；镜像后
本地 HTML 的 src 指向 /plus/api/image.php（镜像站 404），图片全挂。

本脚本用于修复**已发布**的存量文章（render.py 已修复根因，新爬的文章会自动有图）：
1. 扫描本地 <out_dir>/<cat>/<id>.html 中含占位符 src=/plus/api/image.php 的文章；
2. 用 Playwright 回源访问对应源站页面，滚动触发懒加载，在「正文容器」内抽取图片真实 CDN 地址；
3. 按出现顺序回填本地 HTML 的占位符 <img>（数量不一致则跳过该篇，避免错位破坏）；
4. 调用 localize_images 把真实图片下载到本地 zb_users/remote/ 并改写 src 为站内路径。

用法
----
    python fix_existing_images.py [--out-dir xianbao] [--cat huluxia]
                                  [--limit 50] [--dry-run] [--no-localize]

说明
----
- --dry-run：只统计含占位符的文章数量，不回源、不改动文件。
- --limit N：本次最多处理 N 篇（分批跑，避免长任务被中断）。
- 依赖环境变量 HTTPS_PROXY/HTTP_PROXY 访问源站（默认 127.0.0.1:7890）。
- 正文容器优先匹配 div.content / div.article-content 等，避免把页眉页脚的外站图算进来。
"""
import argparse
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup

# 复用 render.py 的解析与本地化逻辑，保证与抓取流程完全一致
sys.path.insert(0, str(Path(__file__).resolve().parent))
from render import (  # noqa: E402
    _proxy_abs_url,
    localize_images,
    ALLOWED_CATEGORIES,
    ALL_NETLOCS,
)

PLACEHOLDER_RE = re.compile(r"^/plus/api/image\.php(\?|$)", re.I)
# 正文容器候选选择器（按优先级）；用于把抽取范围限定在文章正文，排除页眉/页脚/广告外站图
CONTENT_SELECTORS = [
    "div.article-content", "div.post-body", "div.article-body",
    "div.content", "#article_content",
    "div[class*='article']", "div[class*='content']",
]


def _pick_selector(soup: BeautifulSoup):
    """选出文章正文容器选择器：优先覆盖最多占位符，其次覆盖最多图片代理。"""
    best, best_n = None, -1
    for sel in CONTENT_SELECTORS:
        el = soup.select_one(sel)
        if not el:
            continue
        imgs = el.find_all("img")
        n = sum(1 for i in imgs if PLACEHOLDER_RE.match((i.get("src") or "").strip()))
        if n == 0:
            n = sum(1 for i in imgs if _proxy_abs_url(i.get("src") or ""))
        if n > best_n:
            best_n, best = n, sel
    return best


def find_placeholder_imgs(soup: BeautifulSoup):
    """返回本地 HTML 中仍为占位符（未含 imgurl 参数）的内容 <img> 列表（文档序）。"""
    return [img for img in soup.find_all("img")
            if PLACEHOLDER_RE.match((img.get("src") or "").strip())]


def extract_real_imgs(page, selector):
    """从已滚动触发的源站页面中，在正文容器内抽取图片代理绝对地址（文档序）。"""
    html = page.evaluate("document.documentElement.outerHTML")
    s = BeautifulSoup(html, "html.parser")
    if selector:
        el = s.select_one(selector)
        if el:
            s = el
    out = []
    for img in s.find_all("img"):
        pa = _proxy_abs_url(img.get("src") or "")
        if pa:
            out.append(pa)
    return out


def _proxy_arg():
    p = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
    return {"server": p} if p else {"server": "http://127.0.0.1:7890"}


def main():
    ap = argparse.ArgumentParser(description="存量文章图片回源修复")
    ap.add_argument("--out-dir", default="xianbao", help="镜像输出目录（默认 xianbao）")
    ap.add_argument("--cat", default=None, help="只处理指定分类（如 huluxia）")
    ap.add_argument("--limit", type=int, default=0, help="最多处理 N 篇（0=不限）")
    ap.add_argument("--dry-run", action="store_true", help="只统计占位符文章数量")
    ap.add_argument("--no-localize", action="store_true", help="回填后不调用 localize_images")
    ap.add_argument("--delay", type=float, default=1.0,
                    help="每篇之间的间隔秒数（默认 1.0，降低源站限流概率）")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    cats = [args.cat] if args.cat else ALLOWED_CATEGORIES

    # 收集含占位符的文章文件
    targets = []
    for cat in cats:
        cat_dir = out_dir / cat
        if not cat_dir.is_dir():
            continue
        for hf in sorted(cat_dir.rglob("*.html")):
            rel = hf.relative_to(out_dir).as_posix()
            if "/archive/" in rel or "category-" in rel:
                continue
            try:
                soup = BeautifulSoup(hf.read_text(encoding="utf-8", errors="replace"),
                                     "html.parser")
            except Exception:
                continue
            if find_placeholder_imgs(soup):
                targets.append(hf)

    print(f"==> 含占位符图片的文章：{len(targets)} 篇")
    if args.dry_run:
        return
    if args.limit:
        targets = targets[:args.limit]
        print(f"==> 本次处理（--limit {args.limit}）：{len(targets)} 篇")

    from playwright.sync_api import sync_playwright
    exe = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None
    total_fixed, skipped = 0, 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(proxy=_proxy_arg(), executable_path=exe)
        ctx = browser.new_context(
            user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"))
        for hf in targets:
            rel = hf.relative_to(out_dir).as_posix()  # e.g. huluxia/6617524.html
            src_url = "https://new.xianbao.fun/" + rel
            try:
                soup = BeautifulSoup(hf.read_text(encoding="utf-8", errors="replace"),
                                     "html.parser")
                placeholders = find_placeholder_imgs(soup)
                sel = _pick_selector(soup)
                page = ctx.new_page()
                try:
                    page.goto(src_url, wait_until="domcontentloaded", timeout=30000)
                    page.evaluate(
                        "() => new Promise(res => {"
                        "  let y = 0; const step = 800;"
                        "  const max = document.body.scrollHeight || 0;"
                        "  const tick = () => {"
                        "    window.scrollTo(0, Math.min(y, max)); y += step;"
                        "    if (y <= max + step) { setTimeout(tick, 120); }"
                        "    else { window.scrollTo(0, 0); res(); }"
                        "  }; tick();"
                        "})"
                    )
                    page.wait_for_timeout(1500)
                    reals = extract_real_imgs(page, sel)
                finally:
                    page.close()
            except Exception as e:
                print(f"::warning:: 回源失败 {rel}: {e}", file=sys.stderr)
                skipped += 1
                continue

            if len(reals) != len(placeholders):
                print(f"::warning:: 数量不一致跳过 {rel}："
                      f"本地占位符 {len(placeholders)} / 源站图片 {len(reals)}",
                      file=sys.stderr)
                skipped += 1
                continue

            for ph, real in zip(placeholders, reals):
                ph["src"] = real
            try:
                hf.write_text(str(soup), encoding="utf-8")
                total_fixed += 1
                print(f"==> 已回填 {rel}（{len(reals)} 张图）")
            except Exception as e:
                print(f"::warning:: 写回失败 {rel}: {e}", file=sys.stderr)
                skipped += 1
            if args.delay > 0:
                time.sleep(args.delay)
        browser.close()

    print(f"==> 回填完成：成功 {total_fixed} 篇，跳过 {skipped} 篇")

    if not args.no_localize:
        print("==> 调用 localize_images 下载真实图片到本地…")
        stats = localize_images(out_dir)
        print(f"==> 本地化：下载 {stats.get('downloaded', 0)}，"
              f"失败 {stats.get('failed', 0)}")


if __name__ == "__main__":
    main()
