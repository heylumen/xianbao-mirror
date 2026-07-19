#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mirror/test_backup_features.py — 备份完整性增强的单元测试

覆盖（对应「完整备份防丢失」目标）：
  - _clean_text：正文去噪声（面包屑/版权/评论）
  - _qr_payload：二维码服务 URL 内容提取
  - rewrite_html：源站文章链接改写为本地路径，非文章链接中和
  - SOURCE_HOST_RE：源站家族子域（h5.xdglt.com 等）覆盖
  - _extract_article_meta：结构化提取 author / tags
  - build_search_index：写入 author/tags/content_clean 并生成 sitemap/atom/link-map
  - localize_images：二维码本地重生（qrickit.com -> 本地 PNG）

运行（仓库根目录）：python -m pytest mirror/test_backup_features.py -v
"""
import os
import sys
import json
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render

# 固定目标域名，保证链接改写分支可断言
render.TARGET = "https://new.xianbao.fun"
render.ORIGIN = "https://new.xianbao.fun"
render.ORIGIN_NETLOC = "new.xianbao.fun"
render.PAGES_PREFIX = "/"


# ---------------------------------------------------------------------------
# 1) 内容完整性：干净正文
# ---------------------------------------------------------------------------
def test_clean_text_strips_noise():
    raw = ("首页 › 小嘀咕 › 文章正文 这是正文 举报 收藏文章 复制文案 重新抓取 "
           "版权声明：本站作为免费线报整合平台 评论列表 只看楼主 评论内容")
    clean = render._clean_text(raw)
    assert "文章正文" not in clean
    assert "版权声明" not in clean
    assert "评论列表" not in clean
    assert "举报" not in clean
    assert "这是正文" in clean


# ---------------------------------------------------------------------------
# 2) 内容完整性：二维码内容提取
# ---------------------------------------------------------------------------
def test_qr_payload_extracts_data():
    assert render._qr_payload(
        "https://qrickit.com/qrickit.php?d=https%3A%2F%2Fexample.com%2Ffoo&qrsize=150"
    ) == "https://example.com/foo"
    assert render._qr_payload(
        "https://api.qrserver.com/v1/create-qr-code/?data=HELLO&size=150x150"
    ) == "HELLO"
    # 支付宝短码：内容即该 URL 本身
    assert render._qr_payload("https://qr.alipay.com/tsxabc123") == \
        "https://qr.alipay.com/tsxabc123"
    # 非二维码图片返回 None
    assert render._qr_payload("https://pic.xiaodigu.cn/a.jpg") is None


def test_qr_regen_writes_local_png(tmp_path):
    payload = "https://example.com/activity?u=1"
    url = "https://qrickit.com/qrickit.php?d=" + urllib.parse.quote(payload, safe="")
    dst = tmp_path / "qr.png"
    assert render._regen_qr(url, dst) is True
    assert dst.exists() and dst.stat().st_size > 0


# ---------------------------------------------------------------------------
# 3) 结构保留：源站文章链接改写本地，非文章中和
# ---------------------------------------------------------------------------
def test_rewrite_html_source_article_link_to_local():
    html = (
        '<html><head><title>线报酷镜像 - 测试</title></head><body>'
        '<a href="https://new.xianbao.fun/xiaodigu/6437971.html">帖子</a>'
        '<a href="https://news.ixbk.net/">首页</a>'
        '<a href="https://app.xdglt.com/foo">源站后端</a>'
        '</body></html>'
    )
    out = render.rewrite_html(html, cat_slug="xiaodigu")
    assert 'href="/xiaodigu/6437971.html"' in out      # 文章链接 -> 本地
    assert 'href="#"' in out                            # 非文章 -> 中和
    assert "new.xianbao.fun" not in out                 # 不再外跳源站


def test_source_host_re_matches_subdomains():
    assert render.SOURCE_HOST_RE.match("h5.xdglt.com")
    assert render.SOURCE_HOST_RE.match("m.xiaodigu.cn")
    assert render.SOURCE_HOST_RE.match("app.xdglt.com")
    assert not render.SOURCE_HOST_RE.match("example.com")


# ---------------------------------------------------------------------------
# 4) 内容完整性：结构化元数据 author / tags
# ---------------------------------------------------------------------------
def test_extract_article_meta_author_tags(tmp_path):
    p = tmp_path / "xiaodigu" / "6437971.html"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(
        '<html><head><title>测试帖 - 线报酷镜像</title></head><body>'
        '<div class="content"><p>正文</p></div>'
        '<span class="author">张三</span>'
        '<div class="post-tags"><a href="/tag/a">优惠</a><a href="/tag/b">红包</a></div>'
        '<time datetime="2026-06-17 01:02">2026年06月17日 01:02</time>'
        '</body></html>', encoding="utf-8")
    meta = render._extract_article_meta(p)
    assert meta["author"] == "张三"
    assert "优惠" in meta["tags"] and "红包" in meta["tags"]
    assert meta["time"] == "2026年06月17日 01:02"


# ---------------------------------------------------------------------------
# 5) 内容完整性 + 可访问性：搜索索引字段 + 生成器
# ---------------------------------------------------------------------------
def test_build_search_index_metadata_and_generators(tmp_path, monkeypatch):
    # 避免 build_search_page 联网拉取 vendor
    monkeypatch.setattr(render, "ensure_minisearch", lambda *a, **k: True)
    cat = tmp_path / "xiaodigu"
    cat.mkdir()
    (cat / "6437971.html").write_text(
        '<html><head><title>测试帖 - 线报酷镜像</title></head><body>'
        '<div class="content">首页 › 小嘀咕 › 文章正文 真·正文 版权声明：声明</div>'
        '<span class="author">李四</span>'
        '<div class="post-tags"><a href="/tag/x">标签X</a></div>'
        '<time datetime="2026-06-17 01:02">2026年06月17日 01:02</time>'
        '</body></html>', encoding="utf-8")

    n = render.build_search_index(tmp_path)
    assert n == 1
    data = json.loads((tmp_path / "search.json").read_text(encoding="utf-8"))
    it = data[0]
    assert it["author"] == "李四"
    assert "标签X" in it["tags"]
    assert "版权声明" not in it["content_clean"]      # 干净正文
    assert "真·正文" in it["content_clean"]
    # 生成器产物
    assert (tmp_path / "sitemap.xml").exists()
    assert (tmp_path / "atom.xml").exists()
    assert (tmp_path / "link-map.json").exists()
    sm = (tmp_path / "sitemap.xml").read_text(encoding="utf-8")
    assert "<urlset" in sm and "/xiaodigu/6437971.html" in sm
    lm = json.loads((tmp_path / "link-map.json").read_text(encoding="utf-8"))
    assert "/xiaodigu/6437971.html" in lm
    assert "https://new.xianbao.fun/xiaodigu/6437971.html" in lm


# ---------------------------------------------------------------------------
# 6) 内容完整性：二维码本地化重生（localize_images）
# ---------------------------------------------------------------------------
def test_localize_images_qr_regen(tmp_path):
    art = tmp_path / "xiaodigu"
    art.mkdir()
    payload = "https://example.com/activity?u=9"
    q = urllib.parse.quote(payload, safe="")
    (art / "6437971.html").write_text(
        f'<html><body><img src="https://qrickit.com/qrickit.php?d={q}"></body></html>',
        encoding="utf-8")
    stats = render.localize_images(tmp_path)
    html = (art / "6437971.html").read_text(encoding="utf-8")
    assert "/zb_users/remote/qr/" in html
    assert stats["qr_regen"] >= 1
    # 本地 PNG 已生成
    qr_files = list((tmp_path / "zb_users" / "remote" / "qr").glob("*.png"))
    assert qr_files and qr_files[0].stat().st_size > 0

