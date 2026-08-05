#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
recover_part.py — 一次性清理脚本
把 localize_proxy.py 因 rename bug 遗留的 *.part 文件, 按真实图片魔数重命名为
正确扩展名的正式图片文件(复用已下载字节, 不重新下载)。
"""
import os
from pathlib import Path

ROOT = Path("xianbao")
MAGIC = {
    b"\xff\xd8\xff": ".jpg",
    b"\x89PNG": ".png",
    b"GIF8": ".gif",
    b"RIFF": ".webp",
    b"BM": ".bmp",
}
IMG_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif")


def detect(p: Path):
    try:
        with p.open("rb") as f:
            h = f.read(8)
    except Exception:
        return None
    for m, e in MAGIC.items():
        if h.startswith(m):
            return e
    return None


def main():
    parts = list(ROOT.rglob("*.part"))
    n = 0
    skip = 0
    bad = 0
    for part in parts:
        if part.stat().st_size == 0:
            part.unlink(missing_ok=True)
            bad += 1
            continue
        e = detect(part)
        if not e:
            part.unlink(missing_ok=True)
            bad += 1
            continue
        # 去掉 .part 后缀, 再套正确扩展名: image.jpg.part -> image.<e>
        base = part.with_name(part.name[:-5])  # 去 .part
        final = base.with_suffix(e)
        if final.exists():
            part.unlink(missing_ok=True)
            skip += 1
            continue
        final.parent.mkdir(parents=True, exist_ok=True)
        part.rename(final)
        n += 1
    print(f"[recover] 重命名恢复: {n}, 已存在跳过: {skip}, 删除无效(空/非图): {bad}")
    print(f"[recover] 残留 .part: {len(list(ROOT.rglob('*.part')))}")


if __name__ == "__main__":
    main()
