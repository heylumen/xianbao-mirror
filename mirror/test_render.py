#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mirror/test_render.py — render.py 核心纯函数单元测试（状态化增量 + 5 分类白名单版）

覆盖：url_to_local / fix_url（白名单本地化、非白名单绝对化、资源本地化、跨站原样）/
is_allowed / discover_article_links（仅文章链接）/ content_signature（内容签名）/
build_search_index（搜索索引生成）。

运行（仓库根目录）：python -m pytest mirror/test_render.py -v
"""
import os
import sys
import json
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render

# 固定目标域名，保证 fix_url 绝对化分支可断言
render.TARGET = "https://new.xianbao.fun"
render.ORIGIN = "https://new.xianbao.fun"
render.ORIGIN_NETLOC = "new.xianbao.fun"
render.PAGES_PREFIX = "/"


# ---------------------------------------------------------------------------
# url_to_local
# ---------------------------------------------------------------------------
def test_url_to_local_root():
    assert render.url_to_local("https://new.xianbao.fun/") == "index.html"
    assert render.url_to_local("https://new.xianbao.fun") == "index.html"


def test_url_to_local_article():
    assert render.url_to_local("https://new.xianbao.fun/zuankeba/6648140.html") == "zuankeba/6648140.html"


def test_url_to_local_dir():
    assert render.url_to_local("https://new.xianbao.fun/zuankeba/") == "zuankeba/index.html"


def test_url_to_local_no_ext():
    assert render.url_to_local("https://new.xianbao.fun/zuankeba/6648140") == "zuankeba/6648140.html"


def test_url_to_local_cross_origin_returns_none():
    assert render.url_to_local("https://example.com/x") is None


def test_url_to_local_sibling_domain_same_local():
    # 轮换域名不影响落地路径（不碎片）
    assert render.url_to_local("https://news.ixbk.net/zuankeba/6648140.html") == "zuankeba/6648140.html"


# ---------------------------------------------------------------------------
# is_allowed —— 5 分类白名单
# ---------------------------------------------------------------------------
def test_is_allowed_category_list():
    assert render.is_allowed("https://new.xianbao.fun/category-zuankeba/")
    assert render.is_allowed("https://new.xianbao.fun/category-xiaodao/2/")


def test_is_allowed_article():
    assert render.is_allowed("https://new.xianbao.fun/zuankeba/6648140.html")


def test_is_allowed_other_category_excluded():
    assert not render.is_allowed("https://new.xianbao.fun/haodan/6654815.html")


def test_is_allowed_static_excluded():
    assert not render.is_allowed("https://new.xianbao.fun/guanyu.html")


def test_is_allowed_root():
    assert render.is_allowed("https://new.xianbao.fun/")


def test_is_allowed_cross_origin():
    assert not render.is_allowed("https://evil.example.com/x")


# ---------------------------------------------------------------------------
# fix_url
# ---------------------------------------------------------------------------
def test_fix_url_allowed_article_local():
    assert render.fix_url("/zuankeba/6648140") == "/zuankeba/6648140.html"


def test_fix_url_allowed_article_fragment():
    assert render.fix_url("/zuankeba/6648140#c1") == "/zuankeba/6648140.html#c1"


def test_fix_url_disallowed_page_absolute():
    # 非白名单页面 -> 原站绝对地址（跳活站）
    assert render.fix_url("/haodan/6654815") == "https://new.xianbao.fun/haodan/6654815.html"


def test_fix_url_disallowed_page_fragment():
    assert render.fix_url("/haodan/6654815#c1") == "https://new.xianbao.fun/haodan/6654815.html#c1"


def test_fix_url_asset_local():
    assert render.fix_url("/zb_users/style.css") == "/zb_users/style.css"


def test_fix_url_cross_origin_unchanged():
    assert render.fix_url("https://example.com/foo") == "https://example.com/foo"


def test_fix_url_subdomain_not_pool():
    assert render.fix_url("https://new.xianbao.fun.evil.com/x") == "https://new.xianbao.fun.evil.com/x"


def test_fix_url_protocol_relative_unchanged():
    assert render.fix_url("//cdn.example.com/x") == "//cdn.example.com/x"


def test_fix_url_bare_origin_root():
    assert render.fix_url("https://new.xianbao.fun") == "/"
    assert render.fix_url("https://new.xianbao.fun/") == "/"


# ---------------------------------------------------------------------------
# discover_article_links —— 仅文章链接
# ---------------------------------------------------------------------------
def test_discover_article_only():
    html = (
        '<a href="/zuankeba/6648140.html">A</a>'
        '<a href="/xiaodao/12.html">B</a>'
        '<a href="/category-gonggao/">其他分类</a>'
        '<a href="/guanyu.html">关于</a>'
        '<a href="https://evil.com/x">外链</a>'
    )
    links = render.discover_article_links(html, "https://new.xianbao.fun/")
    assert "https://new.xianbao.fun/zuankeba/6648140.html" in links
    assert "https://new.xianbao.fun/xiaodao/12.html" in links
    # 其他分类 / 静态页 / 外链 均不应出现
    assert all("category-gonggao" not in l for l in links)
    assert all("guanyu.html" not in l for l in links)
    assert all("evil.com" not in l for l in links)


def test_discover_article_excludes_other_category_posts():
    html = '<a href="/haodan/6654815.html">好单</a>'
    links = render.discover_article_links(html, "https://new.xianbao.fun/")
    assert links == []


# ---------------------------------------------------------------------------
# content_signature —— 内容签名（隔离易变元素）
# ---------------------------------------------------------------------------
def test_content_signature_same_when_only_volatile_differs():
    a = '<html><body><div class="content">中奖名单公布</div><span class="view">阅读123</span></body></html>'
    b = '<html><body><div class="content">中奖名单公布</div><span class="view">阅读999</span></body></html>'
    assert render.content_signature(a) == render.content_signature(b)


def test_content_signature_differs_on_content_change():
    a = '<html><body><div class="content">旧内容</div></body></html>'
    b = '<html><body><div class="content">新评论已更新</div></body></html>'
    assert render.content_signature(a) != render.content_signature(b)


# ---------------------------------------------------------------------------
# build_search_index —— 搜索索引生成
# ---------------------------------------------------------------------------
def test_build_search_index():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        art = d / "zuankeba"
        art.mkdir(parents=True)
        (art / "6648140.html").write_text(
            '<html><head><title>红包活动-线报酷镜像</title></head>'
            '<body><div class="content">京东红包活动入口，每日可领。</div></body></html>',
            encoding="utf-8")
        # 非文章页不应进索引
        (d / "guanyu.html").write_text(
            '<html><head><title>关于</title></head><body><div>关于我们</div></body></html>',
            encoding="utf-8")
        n = render.build_search_index(d)
        assert n == 1
        data = json.loads((d / "search.json").read_text(encoding="utf-8"))
        assert data[0]["title"] == "红包活动"
        assert "京东红包" in data[0]["body"]
        assert data[0]["url"] == "/zuankeba/6648140.html"
        assert (d / "search.html").exists()
