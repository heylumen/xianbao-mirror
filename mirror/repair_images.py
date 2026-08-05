#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性修复脚本：修复 xianbao 镜像站两类裂图问题。

缺陷 A —— 104 处 img.xianbao.net 论坛附件引用扩展名错位
  源站 URL 形如 `.../xxx.jpg/image.html`（Discuz「查看原图」页路径）。
  localize 按 URL 落盘时目录建成了 `.../xxx.jpg/`，但真图按 Content-Type
  存成了 `image.jpg` / `image.png`，HTML 却仍写 `image.html` → 404 裂图。
  已核验：104 个引用 → 104 个目录，每个目录内**恰好 1 个**图片文件，
  1:1 映射无歧义。故本脚本**只改 HTML 引用**（不挪动任何文件），风险最低。
  同目录布局的另外 426 处 `image.webp` 引用磁盘齐全、工作正常，不动。

缺陷 B —— 405 处外链图（400 pic.xiaodigu.cn + 5 s4.cdn.xianbao.net）未本地化
  历史 CI 下载失败（限流/瞬时错误）后 HTML 保留了外链，镜像站上被防盗链或
  源站失效挡掉。实测这些主机无 Referer 即 200，本脚本重新下载到
  `xianbao/zb_users/remote/<host>/<path>` 并改写引用。

安全约束：
  * 只在 `<img>` 标签内改写，绝不碰 `<script src>` / `<iframe src>`。
  * 缺陷 A 全程只读磁盘、只写 HTML，不 rename / 不 rmdir。
  * 下载先落临时文件再原子替换，中断不会留下半截图。

用法：
  python mirror/repair_images.py --dry   # 只统计，不改动
  python mirror/repair_images.py         # 实际修复
"""
import argparse
import mimetypes
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import unquote, urlparse, urlunparse

ROOT = Path("xianbao")
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
ALLOWED_CATEGORIES = ["zuankeba", "xinzuanba", "xiaodigu", "huluxia", "xiaodao"]
ILLEGAL = re.compile(r'[\\:*?"<>|]')
NON_IMAGE_EXTS = {".html", ".htm", ".php", ".asp", ".aspx", ".jsp", ".do", ""}
VIEW_SUFFIX_SEGS = {"image", "image.html", "thumb", "thumbnail"}
IMG_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif")

IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.I)
SRC_ATTR_RE = re.compile(r'\b(src|data-src|data-original)="([^"]+)"', re.I)
SRCSET_RE = re.compile(r'\bsrcset="([^"]*)"', re.I)
LOCAL_REMOTE_RE = re.compile(r"^/zb_users/remote/", re.I)
EXTERNAL_RE = re.compile(r"^https?://", re.I)


# ---------------------------------------------------------------------------
# 与 render.py rel_path 保持一致：外链 URL -> 站内相对路径
# ---------------------------------------------------------------------------
def rel_path(url: str):
    p = urlparse(url.strip())
    if not p.scheme or not p.netloc:
        return None
    if p.netloc.lower() in ("localhost", "127.0.0.1", "0.0.0.0"):
        return None
    segs = []
    for s in (unquote(p.path or "") or "index").split("/"):
        s = ILLEGAL.sub("_", s)
        if s in ("", ".", ".."):
            continue
        segs.append(s)
    if not segs:
        segs = ["index"]
    rel = "zb_users/remote/" + p.netloc + "/" + "/".join(segs)
    return rel + "index" if rel.endswith("/") else rel


def download(url: str, rel: str):
    """下载 url 到 ROOT/rel。返回实际落盘的站内相对路径，失败返回 None。

    多 Referer 兜底（自身源站 -> www -> 无 Referer）。403/429/503/瞬时错误均
    退避重试 —— 实测 pic.xiaodigu.cn 的 403 是并发限流而非防盗链（8 并发抽样
    40 张挂 12 张，串行间隔 1s 重试 12/12 全部 200）。
    """
    dst = ROOT / rel
    if dst.is_file() and dst.stat().st_size > 0:
        return rel
    # 「查看页」末段（/image、/thumb…）有时被 CDN 拒（s4.cdn.xianbao.net 的
    # `.../packet.png/image` 恒 403，去掉 /image 后 200）。作为下载兜底再试一次；
    # 落盘路径 rel 保持不变，避免与存量目录结构冲突。
    variants = [url]
    _p = urlparse(url)
    _segs = (_p.path or "").split("/")
    if len(_segs) >= 2 and _segs[-1].lower() in VIEW_SUFFIX_SEGS:
        _trim = "/".join(_segs[:-1])
        if _trim.lower().endswith(IMG_EXTS):
            variants.append(urlunparse(_p._replace(path=_trim)))
    host = urlparse(url).netloc.lower()
    candidates = [f"https://{host}/"]
    if not host.startswith("www."):
        candidates.append(f"https://www.{host}/")
    candidates.append("")  # 无 Referer 兜底
    last_err = None
    for try_url, ref in ((v, r) for v in variants for r in candidates):
        for attempt in range(3):
            hdr = {"User-Agent": USER_AGENT,
                   "Accept": "image/avif,image/webp,image/*,*/*;q=0.8"}
            if ref:
                hdr["Referer"] = ref
            try:
                req = urllib.request.Request(try_url, headers=hdr)
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = r.read()
                    ctype = (r.headers.get("Content-Type") or
                             "").split(";")[0].strip().lower()
                if not data:
                    last_err = RuntimeError("空响应体")
                    break
                if not ctype.startswith("image/"):
                    last_err = RuntimeError(f"非图片响应 Content-Type={ctype}")
                    break
                out = dst
                if os.path.splitext(out.name)[1].lower() in NON_IMAGE_EXTS:
                    ext = mimetypes.guess_extension(ctype) or ".bin"
                    out = out.with_name(os.path.splitext(out.name)[0] + ext)
                out.parent.mkdir(parents=True, exist_ok=True)
                tmp = out.with_name(out.name + ".part")
                tmp.write_bytes(data)
                os.replace(tmp, out)  # 原子替换，避免半截文件
                return out.relative_to(ROOT).as_posix()
            except Exception as e:
                last_err = e
                code = getattr(e, "code", None)
                if attempt < 2 and (code in (403, 429, 503) or code is None):
                    time.sleep(2 * (attempt + 1))
                    continue
                break
    print(f"  下载失败 {url}: {last_err}", file=sys.stderr)
    return None


# ---------------------------------------------------------------------------
# 扫描
# ---------------------------------------------------------------------------
def iter_html():
    for cat in ALLOWED_CATEGORIES:
        d = ROOT / cat
        if d.is_dir():
            yield from sorted(d.rglob("*.html"))


def _sole_file(d: Path):
    """目录内恰好 1 个非空文件时返回它，否则 None（有歧义就不猜）。"""
    if not d.is_dir():
        return None
    files = [f for f in d.iterdir() if f.is_file() and f.stat().st_size > 0]
    return files[0] if len(files) == 1 else None


def resolve_local_ref(ref: str):
    """站内 remote 引用落空时，尝试解析到磁盘上的真实文件。

    两条规则（都只在「目录内恰好 1 个文件」时才生效，避免猜错）：
      1. 引用路径本身是个**目录**（如 `.../packet.png` 实为目录，内含 image.png）
      2. 引用路径不存在，但其**父目录**只有 1 个文件
         （如 `.../xxx.jpg/image.html` 缺失，同目录只有 image.jpg）
    命中返回站内绝对路径；引用本就有效或无法确定则返回 None。
    """
    p = ROOT / ref.lstrip("/")
    if p.is_file() and p.stat().st_size > 0:
        return None  # 本来就好的，不动
    hit = _sole_file(p) or _sole_file(p.parent)
    return "/" + hit.relative_to(ROOT).as_posix() if hit else None


def collect():
    """一次遍历，收集缺陷 A 的引用映射 + 缺陷 B 的待下载 URL 集合。"""
    a_map, b_urls, a_hits, b_hits = {}, set(), 0, 0
    seen_local = {}
    files = list(iter_html())
    for hf in files:
        txt = hf.read_text(encoding="utf-8", errors="ignore")
        for tag in IMG_TAG_RE.findall(txt):
            urls = [v for _, v in SRC_ATTR_RE.findall(tag)]
            for ss in SRCSET_RE.findall(tag):
                urls += [p.split()[0] for p in ss.split(",") if p.split()]
            for u in urls:
                u = u.strip()
                if EXTERNAL_RE.match(u):
                    b_hits += 1
                    b_urls.add(u)
                elif LOCAL_REMOTE_RE.match(u):
                    if u not in seen_local:
                        seen_local[u] = resolve_local_ref(u)
                    if seen_local[u]:
                        a_hits += 1
                        a_map[u] = seen_local[u]
    return files, a_map, a_hits, b_urls, b_hits


# ---------------------------------------------------------------------------
# 改写
# ---------------------------------------------------------------------------
def rewrite(files, a_map, b_map, dry):
    a_done = b_done = touched = 0
    for hf in files:
        txt = hf.read_text(encoding="utf-8", errors="ignore")
        local_a = local_b = 0

        def sub_url(u):
            """返回替换后的 URL（无可替换则原样返回）。"""
            nonlocal local_a, local_b
            u = u.strip()
            if u in a_map and a_map[u]:
                local_a += 1
                return a_map[u]
            if u in b_map and b_map[u]:
                local_b += 1
                return "/" + b_map[u]
            return u

        def fix_tag(m):
            tag = m.group(0)
            tag = SRC_ATTR_RE.sub(
                lambda mm: f'{mm.group(1)}="{sub_url(mm.group(2))}"', tag)

            def fix_ss(mm):
                parts = []
                for part in (p.strip() for p in mm.group(1).split(",")):
                    toks = part.split()
                    if toks:
                        toks[0] = sub_url(toks[0])
                        part = " ".join(toks)
                    parts.append(part)
                return 'srcset="' + ", ".join(parts) + '"'

            return SRCSET_RE.sub(fix_ss, tag)

        new = IMG_TAG_RE.sub(fix_tag, txt)
        if local_a or local_b:
            touched += 1
            a_done += local_a
            b_done += local_b
            if not dry and new != txt:
                hf.write_text(new, encoding="utf-8")
    return a_done, b_done, touched


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="只统计不改动")
    # 并发 8 会触发 pic.xiaodigu.cn 限流（30% 返 403），3 并发实测稳定
    ap.add_argument("-j", "--jobs", type=int, default=3, help="下载并发数")
    args = ap.parse_args()
    dry = args.dry

    if not ROOT.is_dir():
        sys.exit(f"找不到 {ROOT.resolve()}，请在仓库根目录运行")

    print(f"==> 扫描{'（DRY-RUN）' if dry else ''}")
    files, a_map, a_hits, b_urls, b_hits = collect()
    print(f"  HTML 文件                 : {len(files)}")
    print(f"  缺陷 A 失效站内引用 / 唯一路径: {a_hits} / {len(a_map)}")
    print(f"  缺陷 B 外链引用 / 唯一 URL   : {b_hits} / {len(b_urls)}")

    # --- 缺陷 B：并发下载 ---
    b_map = {}
    if b_urls:
        todo = [(u, rel_path(u)) for u in sorted(b_urls)]
        todo = [(u, r) for u, r in todo if r]
        if dry:
            print(f"\n==> 缺陷 B：DRY-RUN 跳过下载（待下载 {len(todo)} 个 URL）")
            b_map = {u: r for u, r in todo}
        else:
            print(f"\n==> 缺陷 B：下载 {len(todo)} 张外链图（并发 {args.jobs}）")
            with ThreadPoolExecutor(max_workers=args.jobs) as ex:
                results = list(ex.map(lambda t: download(*t), todo))
            b_map = {u: res for (u, _), res in zip(todo, results) if res}
            print(f"  下载成功 {len(b_map)} / {len(todo)}")

    # --- 改写 HTML ---
    print(f"\n==> 改写 HTML{'（DRY-RUN）' if dry else ''}")
    a_done, b_done, touched = rewrite(files, a_map, b_map, dry)
    print(f"  缺陷 A 改写: {a_done} 处")
    print(f"  缺陷 B 改写: {b_done} 处")
    print(f"  涉及文件   : {touched}")


if __name__ == "__main__":
    main()
