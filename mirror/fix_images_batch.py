#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""存量帖子图片「一次性修复 + 批量校验」工具。

背景
----
源站图片走 IntersectionObserver 懒加载，静态 HTML 里的
`<img src="/plus/api/image.php?imgurl=<真实CDN>">` 只是**相对**占位符。
镜像站并不存在 image.php 这个 PHP 代理，直接请求必然 404（裂图）。

而 `localize_images` 原先只用 `^https?://` 过滤图片 URL，这类**相对占位符被整体跳过**，
导致相关图片从未进入下载流程。实测全站：懒加载占位符 10810 个，
涉及 zuankeba 6766 篇 / huluxia 208 篇 / xiaodao 32 篇。

本工具用途
----------
1. `--scan`   ：扫描全站，统计图片引用状态（占位符 / 外链 / 已本地 / 本地缺失）
2. 默认模式   ：**一次性修复存量**——把占位符图片经源站代理下载到本地并改写 HTML
3. `--verify` ：批量校验已落盘图片的可用性（大小 + 文件头魔数），列出损坏文件

设计要点
--------
- **两阶段执行**：下载受网络 I/O 限制，用线程池并发（默认 6）；
  改写 HTML 必须串行（同一文件不能并发写），放在下载之后。
- **幂等**：已本地化的直接复用，重复执行不重复下载、不产生重复文件。
- **可分批续跑**：`--limit` / `--offset` 控制本批处理量，便于放进 CI 分轮执行。
- **外科手术式改写**：只用精确字符串替换 src/data-src，**绝不用 `str(soup)`
  全文档重序列化**（会触发 favicon / 分析脚本注入标记漂移，见 traps #2）。
- **路径规则共用**：调用 `render.img_rel_path`，与渲染流程完全一致，
  避免「下载到 A 位置、页面引用 B 位置」这类隐蔽裂图。
- **内容校验**：下载后校验文件头魔数，防止把错误页/占位响应存成图片。

用法示例
--------
    python mirror/fix_images_batch.py --scan                     # 只体检，不改动
    python mirror/fix_images_batch.py --limit 30                 # 试修 30 篇
    python mirror/fix_images_batch.py --limit 3000 --offset 0     # 分批：前 3000 篇
    python mirror/fix_images_batch.py --cat zuankeba --workers 8
    python mirror/fix_images_batch.py --verify                   # 校验已存图片是否损坏
"""

from __future__ import annotations

import argparse
import re
import ssl
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent.parent / "xianbao"
CATEGORIES = list(render.ALLOWED_CATEGORIES)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
# 候选 Referer：先试源站文章页上下文，再试源站根域，最后不带 Referer。
# 许多 CDN 仅接受本站 Referer 或无 Referer，错误的 Referer 会被直接 403。
REFERER_CANDIDATES = ["https://new.ixbk.fun/", "https://new.xianbao.fun/", None]
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

IMG_ATTRS = ("src", "data-src", "data-original")
# 占位符特征（相对或绝对形式）
PLACEHOLDER_HINT = "/plus/api/image.php?"


def is_image_bytes(data: bytes) -> bool:
    """按文件头魔数判断是否为真实图片，防止把 HTML 错误页/占位响应存成图片。"""
    if len(data) < 12:
        return False
    if data[:3] == b"\xff\xd8\xff":
        return True                                  # JPEG
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return True                                  # PNG
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return True                                  # GIF
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return True                                  # WEBP
    if data[:2] == b"BM":
        return True                                  # BMP
    return False


def download_image(url: str, dst: Path, referer_hint: str = None) -> bool:
    """下载图片到 dst。多 Referer 重试；成功后校验魔数，避免存下错误页。"""
    candidates = []
    if referer_hint:
        candidates.append(referer_hint)
    candidates.extend(REFERER_CANDIDATES)

    for ref in candidates:
        try:
            headers = {"User-Agent": UA}
            if ref:
                headers["Referer"] = ref
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
                data = r.read()
            if not is_image_bytes(data):
                continue                             # 非图片内容，换 Referer 再试
            try:
                dst.parent.mkdir(parents=True, exist_ok=True)
            except FileExistsError:
                # 祖先被同名文件占据：改名避让后重建目录（见 traps #17）
                render._resolve_dir_file_conflict(dst.parent)
                dst.parent.mkdir(parents=True, exist_ok=True)
            tmp = dst.with_name(dst.name + ".tmp")
            tmp.write_bytes(data)
            tmp.replace(dst)
            return True
        except Exception:
            continue
    return False


def iter_article_files(cats):
    """遍历指定分类下的文章页 HTML。"""
    for cat in cats:
        cat_dir = OUT_DIR / cat
        if not cat_dir.is_dir():
            continue
        for f in sorted(cat_dir.rglob("*.html")):
            rel = f.relative_to(OUT_DIR).as_posix()
            if not render.ART_RE.match("/" + rel):
                continue
            if "/archive/" in rel:
                continue
            yield f, rel


def scan(stats, cats, limit=None, offset=0) -> None:
    """统计图片引用状态（只读，不改动任何文件）。"""
    n = 0
    for f, rel in iter_article_files(cats):
        n += 1
        if n <= offset:
            continue
        if limit and n > offset + limit:
            break
        try:
            html = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        for m in re.finditer(r'<(?:img|source)\b[^>]*>', html, re.I):
            tag = m.group(0)
            for attr in IMG_ATTRS:
                am = re.search(rf'{attr}\s*=\s*["\']([^"\']+)["\']', tag, re.I)
                if not am:
                    continue
                val = am.group(1).strip()
                stats["total"] += 1
                if PLACEHOLDER_HINT in val:
                    stats["placeholder"] += 1
                elif val.startswith("/zb_users/remote/"):
                    stats["local"] += 1
                    if not (OUT_DIR / val.lstrip("/")).is_file():
                        stats["local_missing"] += 1   # 引用了本地路径但文件不存在
                elif val.startswith(("http://", "https://")):
                    stats["external"] += 1
                else:
                    stats["other"] += 1
                break
    stats["files_scanned"] = min(n - offset, limit) if limit else max(0, n - offset)


def fix(stats, cats, limit=None, offset=0, dry_run=False, workers=6,
        no_download=False) -> None:
    """两阶段修复：先并发下载缺失图片，再串行改写 HTML。

    阶段分离的原因：下载受网络 I/O 限制（并发收益显著），
    而改写 HTML 必须串行（同一文件不能并发写）。

    Args:
        no_download: 只改写「本地已有图片」的引用，不下载新图。
            用于中断后快速补写：图片已下载但改写阶段没跑完时，
            用该开关可在秒级把已下载图片写回页面，无需重新联网。
    """
    from bs4 import BeautifulSoup

    # ---------- 阶段 1：收集待处理项 ----------
    pages = []            # [(文件路径, [(attr, 原值, 本地相对路径), ...]), ...]
    need_download = {}    # 本地相对路径 -> (代理下载地址, Referer)
    n = 0
    for f, rel in iter_article_files(cats):
        n += 1
        if n <= offset:
            continue
        if limit and n > offset + limit:
            break
        try:
            html = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        if PLACEHOLDER_HINT not in html:
            continue                                  # 该页无占位符，跳过

        # 仅用 BeautifulSoup 提取待替换清单，写回走字符串精确替换
        soup = BeautifulSoup(html, "html.parser")
        items = []
        for img in soup.find_all("img"):
            for attr in IMG_ATTRS:
                val = img.get(attr)
                if not isinstance(val, str) or not val.strip():
                    continue
                u = render._normalize_img_url(val.strip())
                if not render._ABS_URL_RE.match(u):
                    continue
                real, fetch = render._proxy_pair(u)
                local_rel = render.img_rel_path(real)
                if not local_rel:
                    continue
                items.append((attr, val.strip(), local_rel))
                dst = OUT_DIR / local_rel
                if dst.is_file() and dst.stat().st_size > 0:
                    stats["reused"] += 1              # 本地已有，直接复用
                else:
                    referer = "https://" + render.DOMAIN_POOL[0] + "/" + rel
                    need_download.setdefault(local_rel, (fetch, referer))
        if items:
            pages.append((f, items))

    stats["images_total"] = sum(len(p[1]) for p in pages)
    stats["pending_download"] = len(need_download)
    stats["files_scanned"] = len(pages)

    if dry_run:
        return

    # ---------- 阶段 2：并发下载缺失图片（按本地路径去重，同一张只下一次）----------
    ok_rels = set()
    if need_download and not no_download:
        with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
            futures = {
                ex.submit(download_image, fetch, OUT_DIR / lrel, ref): lrel
                for lrel, (fetch, ref) in need_download.items()
            }
            for fut in as_completed(futures):
                lrel = futures[fut]
                try:
                    if fut.result():
                        ok_rels.add(lrel)
                        stats["downloaded"] += 1
                    else:
                        stats["failed"] += 1
                except Exception:
                    stats["failed"] += 1

    # ---------- 阶段 3：串行改写 HTML（外科手术式精确替换）----------
    for f, items in pages:
        try:
            html = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        new_html = html
        changed = False
        for attr, old, local_rel in items:
            if local_rel not in ok_rels and not (OUT_DIR / local_rel).is_file():
                continue                              # 下载失败，保留原链接（不比原来更差）
            for quote in ('"', "'"):
                pat = f"{attr}={quote}{old}{quote}"
                if pat in new_html:
                    new_html = new_html.replace(pat, f"{attr}={quote}/{local_rel}{quote}")
                    changed = True
        if changed and new_html != html:
            f.write_text(new_html, encoding="utf-8")
            stats["files_changed"] += 1


def verify(stats, cats, limit=None, offset=0) -> None:
    """批量校验已落盘图片是否真实可用（存在 + 非空 + 文件头合法）。"""
    remote_root = OUT_DIR / "zb_users" / "remote"
    n = 0
    for p in sorted(remote_root.rglob("*")):
        if not p.is_file() or p.suffix == ".tmp":
            continue
        n += 1
        if limit and n > limit:
            break
        try:
            size = p.stat().st_size
        except OSError:
            continue
        stats["checked"] += 1
        if size == 0:
            stats["empty"] += 1
            stats["bad_samples"].append(str(p.relative_to(OUT_DIR)))
            continue
        try:
            head = p.open("rb").read(16)
        except OSError:
            continue
        if not is_image_bytes(head):
            stats["corrupt"] += 1
            if len(stats["bad_samples"]) < 20:
                stats["bad_samples"].append(str(p.relative_to(OUT_DIR)))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="存量帖子图片修复与校验工具")
    ap.add_argument("--scan", action="store_true", help="只扫描统计，不做任何修改")
    ap.add_argument("--verify", action="store_true", help="校验已落盘图片的可用性")
    ap.add_argument("--cat", action="append", help="指定分类，可重复；默认全部")
    ap.add_argument("--limit", type=int, help="本批最多处理多少篇文章")
    ap.add_argument("--offset", type=int, default=0, help="跳过前 N 篇，用于分批续跑")
    ap.add_argument("--workers", type=int, default=6, help="下载并发数，默认 6")
    ap.add_argument("--no-download", action="store_true",
                    help="只改写本地已有图片的引用，不下载新图（中断后快速补写）")
    ap.add_argument("--dry-run", action="store_true", help="只统计待修复数量，不下载不写盘")
    args = ap.parse_args(argv)

    cats = args.cat or CATEGORIES
    stats = {"files_scanned": 0, "files_changed": 0, "total": 0, "placeholder": 0,
             "local": 0, "local_missing": 0, "external": 0, "other": 0,
             "images_total": 0, "reused": 0, "downloaded": 0, "failed": 0,
             "pending_download": 0, "checked": 0, "empty": 0, "corrupt": 0,
             "bad_samples": []}

    t0 = time.time()
    if args.scan:
        scan(stats, cats, args.limit, args.offset)
        print("=== 扫描结果（只读）===")
        print(f"  扫描文章页        : {stats['files_scanned']}")
        print(f"  图片引用总数      : {stats['total']}")
        print(f"  ├ 懒加载占位符    : {stats['placeholder']}  ← 需修复（镜像站无 image.php，必 404）")
        print(f"  ├ 已本地化        : {stats['local']}")
        print(f"  │  └ 文件缺失     : {stats['local_missing']}  ← 引用本地路径但文件不存在")
        print(f"  ├ 外部直链        : {stats['external']}")
        print(f"  └ 其他            : {stats['other']}")
    elif args.verify:
        verify(stats, cats, args.limit, args.offset)
        print("=== 图片可用性校验 ===")
        print(f"  已检查文件        : {stats['checked']}")
        print(f"  ├ 空文件(0 字节)  : {stats['empty']}")
        print(f"  └ 文件头非法      : {stats['corrupt']}  （可能是错误页被存成图片）")
        if stats["bad_samples"]:
            print("  问题样例：")
            for s in stats["bad_samples"][:10]:
                print(f"    - {s}")
    else:
        fix(stats, cats, args.limit, args.offset, args.dry_run, args.workers,
            args.no_download)
        tag = "（dry-run，未下载未写盘）" if args.dry_run else ""
        print(f"=== 修复结果{tag} ===")
        print(f"  涉及文章页        : {stats['files_scanned']}")
        print(f"  占位符图片引用    : {stats['images_total']}")
        print(f"  ├ 复用已存图片    : {stats['reused']}")
        if args.dry_run:
            print(f"  └ 待下载（去重后）: {stats['pending_download']}")
        else:
            print(f"  ├ 新下载          : {stats['downloaded']}")
            print(f"  └ 下载失败        : {stats['failed']}")
            print(f"  实际改写页面数    : {stats['files_changed']}")
    print(f"  耗时              : {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
