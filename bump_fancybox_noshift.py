#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""存量文章页补丁：彻底消除 Fancybox 灯箱开合时评论区左右晃动。

三处外科手术式修改（均幂等，可重复运行）：
1. 覆盖 CSS 链接 /lib/xianbao-override.css 升级到 ?v=4，强制 CDN/浏览器重新拉取。
2. 内联初始化 JS 中 Fancybox.show(items,{}) -> Fancybox.show(items,{hideScrollbar:false})，
   从源头让 Fancybox 不再给 <body> 加 hide-scrollbar / margin-right 补偿。
3. 替换 <style id="xianbao-fancybox-noshift">...</style> 为全局强制版：
   html{overflow-y:scroll !important;overflow-x:hidden !important;}body{margin-right:0 !important;}
   不绑定 .with-fancybox 类，因为关闭动画中类会被 Fancybox 短暂移除/切换，导致绑定类
   的规则失效一瞬间，滚动条恢复、宽度变化，评论区左晃。

只做字符串替换，绝不 str(soup) 重序列化整篇，避免 favicon/Vercel 注入标记漂移。
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "xianbao")

NOSHIFT_CSS = (
    "html{overflow-y:scroll !important;overflow-x:hidden !important;}"
    "body{margin-right:0 !important;}"
)
STYLE_BLOCK = f'<style id="xianbao-fancybox-noshift">{NOSHIFT_CSS}</style>'
# 匹配任何已注入的同名 style 块，无论内容新旧
STYLE_ANY_RE = re.compile(r'<style id="xianbao-fancybox-noshift">.*?</style>')

LINK_RE = re.compile(r'(/lib/xianbao-override\.css)(?:\?v=\d+)?')
LINK_SUB = r'\1?v=4'
# 旧内联调用（无 hideScrollbar 选项）-> 新调用
SHOW_RE = re.compile(r'Fancybox\.show\(items,\{\}\)')
SHOW_SUB = 'Fancybox.show(items,{hideScrollbar:false})'


def patch_file(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()
    if "xianbao-fancybox-init" not in html:
        return False  # 非文章页或无灯箱，跳过
    orig = html
    # 1) CSS 链接版本
    html = LINK_RE.sub(LINK_SUB, html)
    # 2) 内联 JS 加 hideScrollbar:false（幂等：已含则不动）
    if "hideScrollbar:false" not in html:
        html = SHOW_RE.sub(SHOW_SUB, html)
    # 3) 替换内联防晃动 style（幂等：无论旧内容都统一为新内容）
    if 'id="xianbao-fancybox-noshift"' in html:
        html = STYLE_ANY_RE.sub(STYLE_BLOCK, html)
    else:
        marker = '<script id="xianbao-fancybox-init">'
        html = html.replace(marker, STYLE_BLOCK + marker, 1)
    if html != orig:
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        return True
    return False


def main():
    changed = 0
    checked = 0
    for dirpath, _, filenames in os.walk(ROOT):
        for fn in filenames:
            if not fn.endswith(".html"):
                continue
            checked += 1
            try:
                if patch_file(os.path.join(dirpath, fn)):
                    changed += 1
            except Exception as e:
                print(f"ERR {os.path.join(dirpath, fn)}: {e}", file=sys.stderr)
    print(f"checked={checked} changed={changed}")


if __name__ == "__main__":
    main()
