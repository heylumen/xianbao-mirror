#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性后处理：把已提交的产物应用本轮 UI 清理 + 图片本地化（不重新抓取）。"""
import sys
from pathlib import Path
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render

OUT = Path("xianbao")

# 1) 文章页移除「猜你还会喜欢」（strip_chrome 在抓取时处理；此处补已提交文章）
n = 0
for cat in render.ALLOWED_CATEGORIES:
    d = OUT / cat
    if not d.is_dir():
        continue
    for hf in d.glob("*.html"):
        html = hf.read_text(encoding="utf-8", errors="replace")
        if "xiangguan" not in html:
            continue
        soup = BeautifulSoup(html, "html.parser")
        for el in soup.select(".xiangguan"):
            el.decompose()
        hf.write_text(str(soup), encoding="utf-8")
        n += 1
print(f"==> 已移除「猜你还会喜欢」的文章：{n} 篇")

# 2) 重建搜索索引 + 首页/分类页（应用导航/登录/关于本站清理 + MiniSearch 注入）
render.build_search_index(OUT)
render.build_hub(OUT)
render.rebuild_category_pages(OUT)

# 3) 图片本地化：外站图下载到本地，防源站删帖/删图后无法查看
render.localize_images(OUT)
print("==> 全部后处理完成")
