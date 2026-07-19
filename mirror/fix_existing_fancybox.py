#!/usr/bin/env python3
"""存量文章 HTML 注入图片点击放大（fancybox）初始化脚本。

源站用 common.js 给裸 <img data-fancybox> 绑定点击放大；我们剥离 common.js 后
该行为失效，导致评论/正文图片点了没反应。本脚本把 render.FANCYBOX_INIT_JS
（复用页面已加载的 fancybox 库）以「外科手术式」插入到 </body> 前，幂等（已有
xianbao-fancybox-init 则跳过），不重序列化整篇文档，避免 favicon / Vercel
Analytics 注入标记漂移。

用法：
  python mirror/fix_existing_fancybox.py            # 实际注入全部含图文章
  python mirror/fix_existing_fancybox.py --dry-run  # 仅统计待处理数量
  python mirror/fix_existing_fancybox.py --limit 50 # 只处理前 50 篇（调试）
"""
import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render import FANCYBOX_INIT_JS  # noqa: E402

MARKER = '<script id="xianbao-fancybox-init">'
OUT_DIR = Path("xianbao")
# 已存在的旧块（无论内容是否变化）都先移除，再插入最新版，保证升级可传播
OLD_BLOCK = re.compile(r'<script id="xianbao-fancybox-init">.*?</script>\s*', re.S)


def iter_article_html():
    for f in sorted(OUT_DIR.rglob("*.html")):
        if "zb_users" in f.parts:
            continue
        yield f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="只统计不写入")
    ap.add_argument("--limit", type=int, default=0, help="最多处理 N 篇（0=全部）")
    args = ap.parse_args()

    injected = replaced = skipped = no_img = 0
    limit = args.limit
    for f in iter_article_html():
        try:
            t = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        if 'data-fancybox' not in t:
            no_img += 1
            continue
        if "</body>" not in t:
            skipped += 1
            continue
        if args.dry_run:
            injected += 1
            continue
        had = bool(re.search(r'<script id="xianbao-fancybox-init">', t))
        # 移除旧块（幂等替换），再插入最新版
        new = OLD_BLOCK.sub("", t)
        new = new.replace("</body>", MARKER + FANCYBOX_INIT_JS + "</script>\n</body>", 1)
        f.write_text(new, encoding="utf-8")
        if had:
            replaced += 1
        else:
            injected += 1
        if limit and (injected + replaced) >= limit:
            break

    print(f"=== fix_existing_fancybox ===")
    print(f"新注入: {injected}")
    print(f"已升级替换(旧块): {replaced}")
    print(f"已跳过(无 </body>): {skipped}")
    print(f"无 data-fancybox: {no_img}")


if __name__ == "__main__":
    main()
