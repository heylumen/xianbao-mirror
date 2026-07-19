"""一次性脚本：给已提交 HTML 中覆盖 CSS 的 link 加版本号，强制浏览器/CDN 拉取新文件。

只改写 href 里的路径字符串 `/lib/xianbao-override.css` -> `/lib/xianbao-override.css?v=2`，
不影响其它内容；已是 ?v= 的形式不会重复加（正则要求路径后紧跟引号）。
"""
import re, pathlib, sys

ROOT = pathlib.Path("xianbao")
VERSION = "?v=2"
pat = re.compile(r'(["\'])/lib/xianbao-override\.css\1')

def bump(text):
    return pat.sub(lambda m: m.group(1) + "/lib/xianbao-override.css" + VERSION + m.group(1), text)

count = 0
for f in ROOT.rglob("*.html"):
    try:
        text = f.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        continue
    new = bump(text)
    if new != text:
        f.write_text(new, encoding="utf-8")
        count += 1

print(f"updated {count} html files")
