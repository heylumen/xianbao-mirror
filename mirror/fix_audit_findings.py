# -*- coding: utf-8 -*-
"""全站产物外科手术式批量修复（字节级，不重序列化，保留行尾）：
  1. 删除源站动态端点脚本（*.php）→ 消除 initGM ReferenceError
  2. iconfont 外链本地化 → /lib/iconfont.css?v=1（字体已下载到 lib/fonts/）
  3. 删除 alicdn dns-prefetch
  4. 404.html 移除不存在的 favicon.png 引用
  5. sitemap.xml / atom.xml 旧域名 → 正式域名
幂等：重复运行无二次改动。
"""
import re, sys, time
from pathlib import Path

ROOT = Path(r"D:\Github\1255104520xfxx2022\xianbao-mirror\xianbao")

PHP_RE = re.compile(rb'<script[^>]*src="[^"]*\.php[^"]*"[^>]*>\s*</script>', re.I)
ICON_OLD = b'<link href="https://at.alicdn.com/t/c/font_1640420_ez6c8oh0s95.css" rel="stylesheet"/>'
ICON_NEW = b'<link href="/lib/iconfont.css?v=1" rel="stylesheet"/>'
DNS_OLD = b'<link href="https://at.alicdn.com/" rel="dns-prefetch"/>'
FAV_OLD = b'<link href="/favicon.png" rel="icon" type="image/png"/>'
OLD_DOMAIN = b"https://xianbao-mirror.vercel.app"
NEW_DOMAIN = b"https://xianbao.1314151.xyz"

t0 = time.time()
n_php = n_icon = n_dns = n_fav = 0
n_files_changed = 0
n_files = 0

for f in ROOT.rglob("*.html"):
    n_files += 1
    if n_files % 2000 == 0:
        print(f"  进度 {n_files} 文件 / 已改 {n_files_changed} / 耗时 {time.time()-t0:.0f}s", flush=True)
    b = f.read_bytes()
    orig = b
    b, k1 = PHP_RE.subn(b"", b)
    n_php += k1
    if ICON_OLD in b:
        k2 = b.count(ICON_OLD)
        b = b.replace(ICON_OLD, ICON_NEW)
        n_icon += k2
    if DNS_OLD in b:
        k3 = b.count(DNS_OLD)
        b = b.replace(DNS_OLD, b"")
        n_dns += k3
    if FAV_OLD in b:
        b = b.replace(FAV_OLD, b"")
        n_fav += 1
    if b != orig:
        # 字节级写回：不做任何换行/编码转换（traps.md #4）
        f.write_bytes(b)
        n_files_changed += 1

# XML 域名替换
n_xml = 0
for name in ("sitemap.xml", "atom.xml"):
    f = ROOT / name
    if f.exists():
        b = f.read_bytes()
        if OLD_DOMAIN in b:
            k = b.count(OLD_DOMAIN)
            f.write_bytes(b.replace(OLD_DOMAIN, NEW_DOMAIN))
            n_xml += k
            print(f"{name}: 替换旧域名 {k} 处")

print(f"\n扫描 {n_files} 个 HTML，改动 {n_files_changed} 个：")
print(f"  删除 .php 脚本标签: {n_php}")
print(f"  iconfont CSS 本地化: {n_icon}")
print(f"  删除 dns-prefetch: {n_dns}")
print(f"  404 favicon.png 移除: {n_fav}")
print(f"  XML 旧域名替换: {n_xml}")
print(f"耗时 {time.time()-t0:.1f}s")

# 幂等自检：再跑一遍应为 0 改动
n2 = 0
for f in ROOT.rglob("*.html"):
    b = f.read_bytes()
    if PHP_RE.search(b) or ICON_OLD in b or DNS_OLD in b or FAV_OLD in b:
        n2 += 1
print(f"幂等自检：残留问题文件 {n2} 个（应为 0）")
sys.exit(0 if n2 == 0 else 1)
