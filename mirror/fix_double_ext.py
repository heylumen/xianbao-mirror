#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_double_ext.py — 一次性清理脚本(修正版)
修复双扩展名图片文件(如 xxx.jpeg.jpg / xxx.png.jpg / xxx.jpg.png)。
真实类型是最外(最后)一个扩展名。修正为单扩展名, 并同步改写 HTML 引用。

规则:
  p = dir/xxx.<inner>.<outer>   (outer = 真实类型)
  target = dir/xxx.<outer>         (剥掉两层后缀取基名 xxx, 再套 outer)
  HTML 引用 dir/xxx.<inner>   ->   dir/xxx.<outer>
"""
import re
from pathlib import Path

ROOT = Path("xianbao")
IMG_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif")
MAGIC = {b"\xff\xd8\xff": 1, b"\x89PNG": 1, b"GIF8": 1, b"RIFF": 1, b"BM": 1}

IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.I)
ATTR_RE = re.compile(r'(src|data-src|data-original)\s*=\s*"([^"]*)"', re.I)


def is_img(p):
    try:
        with p.open("rb") as f:
            h = f.read(8)
    except Exception:
        return False
    return any(h.startswith(m) for m in MAGIC)


def main():
    dbl = []
    for p in ROOT.rglob("*"):
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            stem1 = p.with_suffix("")          # 去最后后缀 -> xxx.<inner>
            if stem1.suffix.lower() in IMG_EXTS:
                inner = stem1.suffix.lower()
                outer = p.suffix.lower()
                base = stem1.with_suffix("")   # 再去一层 -> xxx
                dbl.append((p, base, inner, outer))
    print(f"[scan] 双扩展名图片文件: {len(dbl)}")

    mapping = {}
    renamed = 0
    for p, base, inner, outer in dbl:
        target = base.with_suffix(outer)       # dir/xxx.<outer>
        old_rel = "/" + str((p.parent / (base.name + inner)).relative_to(ROOT)).replace("\\", "/")
        new_rel = "/" + str(target.relative_to(ROOT)).replace("\\", "/")
        if target.exists():
            if is_img(target) and target != p:
                p.unlink(missing_ok=True)
            mapping[old_rel] = new_rel
            renamed += 1
            continue
        p.rename(target)
        mapping[old_rel] = new_rel
        renamed += 1
    print(f"[rename] 处理: {renamed}")

    changed_files = 0
    changed_refs = 0
    for html in ROOT.rglob("*.html"):
        try:
            txt = html.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        new_txt = txt
        for tag in IMG_TAG_RE.findall(txt):
            new_tag = tag
            for attr, val in ATTR_RE.findall(tag):
                if val in mapping:
                    new_tag = re.sub(
                        r'(%s\s*=\s*")([^"]*)(")' % re.escape(attr),
                        lambda m, L=mapping[val]: m.group(1) + L + m.group(3),
                        new_tag, count=1)
            if new_tag != tag:
                new_txt = new_txt.replace(tag, new_tag, 1)
                changed_refs += 1
        if new_txt != txt:
            html.write_text(new_txt, encoding="utf-8")
            changed_files += 1
    print(f"[rewrite] 改写 HTML 文件: {changed_files}, 引用: {changed_refs}")
    print("[done]")


if __name__ == "__main__":
    main()
