#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
localize_proxy.py — 一次性修复脚本
将文章里通过死掉的 PHP 代理 /plus/api/image.php?imgurl=<外部URL> 引用的图片,
下载到本地 zb_users/remote/<host>/<path> 并改写 <img src/data-src/data-original>。

背景: 站点部署在 Vercel/Netlify 纯静态托管, 不跑 PHP, 该代理端点返回
application/x-httpd-php 而非图片 -> 所有走代理的图片全裂。本地化是唯一根治法。

特性:
- 仅下载「本地不存在」的唯一 URL(去重), 多篇文章复用同一张只下一次。
- 并发受限(默认3) + 403/429/503 退避重试(实测并发会触发限流)。
- 跟随重定向(-L), 校验图片魔数, 扩展名按真实类型纠正(修正此前 rename bug)。
- 原子写(.part -> rename 到正确扩展名目标), 失败 .part 必清理。
- 改写阶段按「磁盘真实文件」反查本地路径(兼容扩展名纠正), 保证指向存在文件。
- 失败 URL 记入 .dead_remote_imgs.json(合并去重)。
"""
import re
import os
import sys
import time
import json
import subprocess
import urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path("xianbao")
REMOTE = ROOT / "zb_users" / "remote"
DEAD = ROOT / ".dead_remote_imgs.json"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

IMG_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif")
MAGIC = {
    b"\xff\xd8\xff": ".jpg",
    b"\x89PNG": ".png",
    b"GIF8": ".gif",
    b"RIFF": ".webp",
    b"BM": ".bmp",
}

PROXY_RE = re.compile(r"/plus/api/image\.php", re.I)
IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.I)
ATTR_RE = re.compile(r'(src|data-src|data-original)\s*=\s*"([^"]*)"', re.I)


def is_image_file(p: Path) -> bool:
    try:
        with p.open("rb") as f:
            head = f.read(8)
    except Exception:
        return False
    return any(head.startswith(m) for m in MAGIC)


def detect_ext(p: Path):
    """返回图片真实扩展名(.jpg/.png/...)或 None(非图片)。"""
    try:
        with p.open("rb") as f:
            head = f.read(8)
    except Exception:
        return None
    for m, e in MAGIC.items():
        if head.startswith(m):
            return e
    return None


def decode_imgurl(attr_value: str):
    m = re.search(r"imgurl=([^ \"&]+)", attr_value)
    if not m:
        return None
    return urllib.parse.unquote(m.group(1))


def local_rel_for(url: str) -> str:
    """http(s)://host/path -> zb_users/remote/host/path"""
    rel = re.sub(r"^https?://", "", url, flags=re.I)
    return "zb_users/remote/" + rel


def already_local(rel: str) -> bool:
    """rel 对应文件(或其任一扩展名变体)是否为有效图片。"""
    base = ROOT / rel
    if base.is_file() and base.stat().st_size > 0 and is_image_file(base):
        return True
    for ext in IMG_EXTS:
        c = base.with_suffix(ext)
        if c.is_file() and c.stat().st_size > 0 and is_image_file(c):
            return True
    return False


def resolve_local(url: str):
    """反查 url 对应的本地绝对 web 路径(含扩展名纠正); 不存在返回 None。"""
    base = ROOT / local_rel_for(url)
    if base.is_file() and base.stat().st_size > 0 and is_image_file(base):
        return "/" + str(base.relative_to(ROOT)).replace("\\", "/")
    for ext in IMG_EXTS:
        c = base.with_suffix(ext)
        if c.is_file() and c.stat().st_size > 0 and is_image_file(c):
            return "/" + str(c.relative_to(ROOT)).replace("\\", "/")
    return None


def download(url: str, rel: str):
    """确保 rel 对应文件是有效图片(含扩展名纠正); 返回最终 rel 路径或 None。"""
    if already_local(rel):
        return rel
    base = ROOT / rel
    base.parent.mkdir(parents=True, exist_ok=True)
    netloc = urllib.parse.urlparse(url).netloc
    referrers = [None,
                 "https://" + netloc + "/",
                 "https://xianbao.1314151.xyz/"]
    candidates = [url]
    trimmed = re.sub(r"/(image|image\.html|thumb|thumbnail)$", "", url, flags=re.I)
    if trimmed != url:
        candidates.append(trimmed)
    for cand in candidates:
        for ref in referrers:
            for attempt in range(6):
                part = base.with_name(base.name + ".part")
                cmd = ["curl", "-sS", "--max-time", "45", "-L", "-A", UA]
                if ref:
                    cmd += ["-e", ref]
                cmd += ["-o", str(part), cand]
                try:
                    r = subprocess.run(cmd, capture_output=True, timeout=60)
                except Exception:
                    r = None
                ok = (r is not None and r.returncode == 0
                      and part.is_file() and part.stat().st_size > 0)
                if ok:
                    e = detect_ext(part)
                    if e is None:
                        part.unlink(missing_ok=True)
                        break  # 非图片, 放弃此 URL
                    target = base.with_suffix(e)
                    if target.exists():
                        target.unlink(missing_ok=True)
                    part.rename(target)
                    return str(target.relative_to(ROOT)).replace("\\", "/")
                if part.is_file():
                    part.unlink(missing_ok=True)
                time.sleep(1.5 + attempt * 1.5)
    return None


def collect():
    todo_files = set()
    proxy_to_url = {}
    for html in ROOT.rglob("*.html"):
        try:
            txt = html.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        hit = False
        for tag in IMG_TAG_RE.findall(txt):
            for attr, val in ATTR_RE.findall(tag):
                if PROXY_RE.search(val):
                    u = decode_imgurl(val)
                    if u:
                        proxy_to_url[val] = u
                        hit = True
        if hit:
            todo_files.add(html)
    return todo_files, proxy_to_url


def main():
    dry = "--dry" in sys.argv
    workers = 3
    m = re.search(r"--workers=(\d+)", " ".join(sys.argv))
    if m:
        workers = int(m.group(1))

    todo_files, proxy_to_url = collect()
    url_to_rel = {}
    for u in set(proxy_to_url.values()):
        url_to_rel[u] = local_rel_for(u)

    print(f"[scan] 需改写的 HTML 文件: {len(todo_files)}")
    print(f"[scan] 代理属性引用(含重复): {len(proxy_to_url)}")
    print(f"[scan] 去重外部 URL: {len(url_to_rel)}")
    missing = [u for u, r in url_to_rel.items() if not already_local(r)]
    print(f"[scan] 本地缺失需下载: {len(missing)}")

    if dry:
        from collections import Counter
        c = Counter(re.sub(r"^https?://", "", u, flags=re.I).split("/")[0]
                    for u in missing)
        for h, n in c.most_common():
            print(f"    {h:24s} {n}")
        return

    ok_urls = set()
    failed_urls = set()
    print(f"[download] 并发={workers}, 开始下载 {len(missing)} 张...")
    with ThreadPoolExecutor(max_workers=workers) as ex:
        fut = {ex.submit(download, u, url_to_rel[u]): u for u in missing}
        done = 0
        for f in as_completed(fut):
            u = fut[f]
            done += 1
            if f.result():
                ok_urls.add(u)
            else:
                failed_urls.add(u)
            if done % 50 == 0:
                print(f"  ... {done}/{len(missing)} (ok={len(ok_urls)} fail={len(failed_urls)})")
    print(f"[download] 完成: ok={len(ok_urls)} fail={len(failed_urls)}")

    changed_files = 0
    rewritten = 0
    for html in todo_files:
        try:
            txt = html.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        new_txt = txt
        for tag in IMG_TAG_RE.findall(txt):
            new_tag = tag
            for attr, val in ATTR_RE.findall(tag):
                if PROXY_RE.search(val):
                    u = decode_imgurl(val)
                    if u:
                        local = resolve_local(u)
                        if local:
                            new_tag = re.sub(
                                r'(%s\s*=\s*")([^"]*)(")' % re.escape(attr),
                                lambda mm, L=local: mm.group(1) + L + mm.group(3),
                                new_tag, count=1)
            if new_tag != tag:
                new_txt = new_txt.replace(tag, new_tag, 1)
                rewritten += 1
        if new_txt != txt:
            html.write_text(new_txt, encoding="utf-8")
            changed_files += 1
    print(f"[rewrite] 改写 HTML 文件: {changed_files}, 改写 img 属性: {rewritten}")

    # 死链 = 磁盘确实没有对应本地文件的 URL
    truly_dead = {u for u in url_to_rel if resolve_local(u) is None}
    existing = set()
    if DEAD.is_file():
        try:
            d = json.loads(DEAD.read_text(encoding="utf-8") or "[]")
            existing = set(d) if isinstance(d, list) else set(d.get("urls", []))
        except Exception:
            existing = set()
    merged = (existing | truly_dead) - ok_urls
    DEAD.write_text(json.dumps(sorted(merged), ensure_ascii=False, indent=2),
                    encoding="utf-8")
    print(f"[dead] 死链清单: {len(merged)} 条 (本轮失败 {len(failed_urls)}, 真正缺失 {len(truly_dead)})")
    print("[done]")


if __name__ == "__main__":
    main()
