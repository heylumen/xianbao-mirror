#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""存量文章页回注「图片加载失败降级」脚本（幂等、外科手术式）。

背景
----
远程图片失效 / 源站删图时，浏览器默认的裂图图标会撑破排版，影响阅读。
新渲染的文章页已由 `render.strip_chrome` 注入降级脚本；
**历史产物**需要本脚本回注。

实现要点（务必遵守）
--------------------
1. **外科手术式插入**：只用字符串在 `</body>` 前插入片段，
   **绝不用 `str(soup)` 全文档重序列化** —— 那会触发 favicon /
   分析脚本注入标记漂移（项目踩坑记录 traps #2）。
2. **幂等**：页面已含 `id="xianbao-img-fallback"` 则跳过；重复执行结果一致。

用法
----
    python mirror/fix_existing_img_fallback.py              # 处理全部 5 个分类
    python mirror/fix_existing_img_fallback.py zuankeba     # 仅处理指定分类
    python mirror/fix_existing_img_fallback.py --dry-run    # 只统计，不写盘
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent.parent / "xianbao"
CATEGORIES = list(render.ALLOWED_CATEGORIES)

MARKER = 'id="xianbao-img-fallback"'
SNIPPET = '<script id="xianbao-img-fallback">' + render.IMG_FALLBACK_JS + "</script>\n"
BODY_END_RE = re.compile(r"</body>", re.I)


def fix_file(path: Path, dry_run: bool = False) -> bool:
    """回注单个页面。返回是否发生了修改（dry_run 下表示「需要修改」）。"""
    try:
        html = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return False
    if MARKER in html:
        return False
    m = BODY_END_RE.search(html)
    if m:
        new_html = html[: m.start()] + SNIPPET + html[m.start():]
    else:
        new_html = html + "\n" + SNIPPET
    if not dry_run:
        path.write_text(new_html, encoding="utf-8")
    return True


def main(argv: list[str]) -> int:
    dry_run = "--dry-run" in argv
    cats = [a for a in argv if not a.startswith("-")] or CATEGORIES

    changed = scanned = 0
    for cat in cats:
        cat_dir = OUT_DIR / cat
        if not cat_dir.is_dir():
            print(f"跳过（目录不存在）：{cat_dir}")
            continue
        for html_file in sorted(cat_dir.rglob("*.html")):
            rel = html_file.relative_to(OUT_DIR).as_posix()
            if not render.ART_RE.match("/" + rel):
                continue  # 仅处理文章页
            if "/archive/" in rel:
                continue  # 归档快照随原帖处理
            scanned += 1
            if fix_file(html_file, dry_run=dry_run):
                changed += 1

    mode = "（dry-run，未写盘）" if dry_run else ""
    print(f"扫描文章页 {scanned} 个，回注降级脚本 {changed} 个{mode}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
