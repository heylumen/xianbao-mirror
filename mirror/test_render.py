#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mirror/test_render.py — render.py 核心纯函数单元测试（xianbao.fun 适配版）

覆盖 url_to_local / fix_url / rewrite_text_asset / discover_links（分页上限）。
运行（仓库根目录）：python -m pytest mirror/test_render.py -v
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render


def set_prefix(prefix):
    render.PAGES_PREFIX = prefix


# ---------------------------------------------------------------------------
# url_to_local
# ---------------------------------------------------------------------------
def test_url_to_local_root():
    assert render.url_to_local("https://new.xianbao.fun/") == "index.html"
    assert render.url_to_local("https://new.xianbao.fun") == "index.html"


def test_url_to_local_article():
    assert render.url_to_local("https://new.xianbao.fun/haodan/6654815.html") == "haodan/6654815.html"


def test_url_to_local_dir():
    assert render.url_to_local("https://new.xianbao.fun/haodan/") == "haodan/index.html"


def test_url_to_local_no_ext():
    assert render.url_to_local("https://new.xianbao.fun/haodan") == "haodan.html"


def test_url_to_local_cross_origin_returns_none():
    assert render.url_to_local("https://example.com/x") is None


# ---------------------------------------------------------------------------
# fix_url
# ---------------------------------------------------------------------------
def test_fix_url_root_absolute_prefix_slash():
    set_prefix("/")
    assert render.fix_url("/haodan/6654815") == "/haodan/6654815.html"


def test_fix_url_cross_origin_unchanged():
    set_prefix("/")
    assert render.fix_url("https://example.com/foo") == "https://example.com/foo"


def test_fix_url_subdomain_not_same_origin():
    set_prefix("/")
    assert render.fix_url("https://new.xianbao.fun.evil.com/x") == "https://new.xianbao.fun.evil.com/x"


def test_fix_url_fragment_preserved():
    set_prefix("/")
    assert render.fix_url("/haodan/6654815#c1") == "/haodan/6654815.html#c1"


def test_fix_url_protocol_relative_unchanged():
    set_prefix("/")
    assert render.fix_url("//cdn.example.com/x") == "//cdn.example.com/x"


def test_fix_url_bare_origin_returns_root():
    set_prefix("/")
    assert render.fix_url("https://new.xianbao.fun") == "/"
    assert render.fix_url("https://new.xianbao.fun/") == "/"


# ---------------------------------------------------------------------------
# rewrite_text_asset —— CSS 双斜杠回归
# ---------------------------------------------------------------------------
def test_css_double_slash_regression_prefix_slash():
    set_prefix("/")
    css = "body{background:url(/lib/bg.png)}"
    out = render.rewrite_text_asset(css, "https://new.xianbao.fun/lib/x.css")
    assert "url(//lib" not in out
    assert "url(/lib/bg.png)" in out


def test_css_absolute_domain_replaced_no_double_slash():
    set_prefix("/")
    css = "body{background:url(https://new.xianbao.fun/lib/bg.png)}"
    out = render.rewrite_text_asset(css, "https://new.xianbao.fun/lib/x.css")
    assert "url(//lib" not in out
    assert "url(/lib/bg.png)" in out


def test_css_relative_path_unchanged():
    set_prefix("/")
    css = "body{background:url(../img/x.png)}"
    out = render.rewrite_text_asset(css, "https://new.xianbao.fun/lib/x.css")
    assert "url(../img/x.png)" in out


def test_non_css_asset_domain_replaced():
    set_prefix("/")
    js = "var u='https://new.xianbao.fun/x'"
    out = render.rewrite_text_asset(js, "https://new.xianbao.fun/lib/x.js")
    assert "https://new.xianbao.fun" not in out
    assert "/x" in out


# ---------------------------------------------------------------------------
# discover_links —— 分页上限（RECENT_LIST_PAGES）
# ---------------------------------------------------------------------------
def test_discover_links_pagination_within_cap():
    set_prefix("/")
    render.RECENT_LIST_PAGES = 50
    html = '<a href="/page/2/">2</a><a href="/page/50/">50</a>'
    links = render.discover_links(html, "https://new.xianbao.fun/")
    assert "https://new.xianbao.fun/page/2" in links
    assert "https://new.xianbao.fun/page/50" in links


def test_discover_links_pagination_beyond_cap_excluded():
    set_prefix("/")
    render.RECENT_LIST_PAGES = 50
    html = '<a href="/page/2/">2</a><a href="/page/1298/">尾页</a>'
    links = render.discover_links(html, "https://new.xianbao.fun/")
    assert "https://new.xianbao.fun/page/2" in links
    # 尾页（1298）超出上限，不应被收录
    assert "https://new.xianbao.fun/page/1298" not in links


def test_discover_links_category_pagination_capped():
    set_prefix("/")
    render.RECENT_LIST_PAGES = 50
    html = '<a href="/haodan/page/3/">3</a><a href="/haodan/page/200/">尾页</a>'
    links = render.discover_links(html, "https://new.xianbao.fun/haodan/")
    assert "https://new.xianbao.fun/haodan/page/3" in links
    assert "https://new.xianbao.fun/haodan/page/200" not in links


def test_discover_links_cross_origin_excluded():
    set_prefix("/")
    render.RECENT_LIST_PAGES = 50
    html = '<a href="https://evil.example.com/x">x</a>'
    links = render.discover_links(html, "https://new.xianbao.fun/")
    assert "https://evil.example.com/x" not in links


def test_discover_links_article_included():
    set_prefix("/")
    render.RECENT_LIST_PAGES = 50
    html = '<a href="/haodan/6654815.html">好单</a>'
    links = render.discover_links(html, "https://new.xianbao.fun/")
    assert "https://new.xianbao.fun/haodan/6654815.html" in links
