# -*- coding: utf-8 -*-
"""恢复被误删的 c_html_js_add.php 脚本标签（zbpConfig/zbp 定义，dark-mode.js 等依赖）。
规则：在 dark-mode.js 标签之后插回（与源站原始顺序一致）；无 dark-mode 标签的页面
插到 zblogphp.js 之后；都没有则跳过并计数。幂等：已存在则跳过。字节级操作。
"""
import re, sys, time
from pathlib import Path

ROOT = Path(r"D:\Github\1255104520xfxx2022\xianbao-mirror\xianbao")
TAG = b'<script src="/zb_system/script/c_html_js_add.php"></script>'
DM_RE = re.compile(rb'(<script src="/zb_users/theme/xianbao_theme/script/dark-mode\.js[^"]*"></script>)')
ZB_RE = re.compile(rb'(<script src="/zb_system/script/zblogphp\.js[^"]*"></script>)')

t0 = time.time()
n_restored = n_skip = n_nobase = n_files = 0
for f in ROOT.rglob("*.html"):
    n_files += 1
    if n_files % 2000 == 0:
        print(f"  进度 {n_files} / 已恢复 {n_restored} / 耗时 {time.time()-t0:.0f}s", flush=True)
    b = f.read_bytes()
    if TAG in b:
        n_skip += 1
        continue
    # 仅恢复原本含该脚本的页面：通过 dark-mode.js 或 zblogphp.js 存在性判断
    b2, k = DM_RE.subn(rb"\1" + TAG, b, count=1)
    if k == 0:
        b2, k = ZB_RE.subn(rb"\1" + TAG, b, count=1)
    if k:
        f.write_bytes(b2)
        n_restored += 1
    else:
        n_nobase += 1

print(f"\n扫描 {n_files} 个 HTML：恢复 {n_restored}，本就有 {n_skip}，无挂载点 {n_nobase}")
print(f"耗时 {time.time()-t0:.1f}s")
