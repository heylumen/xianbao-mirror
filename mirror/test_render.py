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
import subprocess
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
# 失效地址（dead）记录 —— 减少原站负担与暴露面
# ---------------------------------------------------------------------------
def test_record_and_is_dead():
    st = {"dead": {}}
    assert not render.is_dead(st, "/zuankeba/1.html")
    render.record_dead(st, "/zuankeba/1.html", "HTTP 404")
    assert render.is_dead(st, "/zuankeba/1.html")
    assert not render.is_dead(st, "/xiaodao/2.html")  # 其他地址不受影响


def test_dead_ttl_expiry(monkeypatch):
    st = {"dead": {}}
    render.record_dead(st, "/zuankeba/1.html", "HTTP 404")
    # 模拟远未来（远超 90 天 TTL），应过期允许重试
    monkeypatch.setattr(render.time, "time", lambda: 10 ** 12)
    assert not render.is_dead(st, "/zuankeba/1.html")


def test_record_dead_keeps_fails_count():
    st = {"dead": {}}
    render.record_dead(st, "/x.html", "HTTP 404")
    render.record_dead(st, "/x.html", "HTTP 404")
    assert st["dead"]["/x.html"]["fails"] == 2


# ---------------------------------------------------------------------------
# _encode_url —— 非 ASCII / 空格路径编码
# ---------------------------------------------------------------------------
def test_encode_url_chinese():
    out = render._encode_url("https://new.xianbao.fun/record/weibo/用户8018815048.html")
    assert "%" in out
    assert "用户" not in out  # 已编码


def test_encode_url_space():
    out = render._encode_url("https://new.xianbao.fun/record/douban-pinzu/momo (健康版）.html")
    assert "%20" in out or "%EF" in out  # 空格/全角符号已编码


def test_encode_url_plain():
    out = render._encode_url("https://new.xianbao.fun/zb_users/1.css")
    assert out == "https://new.xianbao.fun/zb_users/1.css"


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


# ---------------------------------------------------------------------------
# 每日上限 + 检查点提交
# ---------------------------------------------------------------------------
def test_max_pages_per_run_default_is_200():
    # 防封 IP：默认每日渲染上限应为 200 页（列表+文章合计）；稳后可调大到 300
    assert render.MAX_PAGES_PER_RUN == 200


def test_checkpoint_outside_git_is_safe_and_saves_state(monkeypatch, tmp_path):
    # 非 git 工作区时，checkpoint 不应抛异常，且状态文件应落地
    monkeypatch.setattr(render, "OUT_DIR", tmp_path)
    fake = subprocess.CompletedProcess(["git"], 0, "false\n", "")  # 不在 git 内
    monkeypatch.setattr(render, "_git", lambda *a: fake)
    st = {"mode": "crawl", "crawled": {"/zuankeba/1.html": {}}, "dead": {},
          "category_cursor": {}, "category_exhausted": {}}
    render.checkpoint(st, "unit-test")
    assert (tmp_path / ".crawl-state.json").exists()


def test_checkpoint_commits_and_pushes_when_in_git(monkeypatch, tmp_path):
    monkeypatch.setattr(render, "OUT_DIR", tmp_path)
    calls = []

    def fake_git(*args):
        calls.append(args)
        if args[:3] == ("rev-parse", "--is-inside-work-tree"):
            return subprocess.CompletedProcess(args, 0, "true\n", "")
        if args[:2] == ("diff", "--cached"):
            # 模拟「有变更待提交」，使 checkpoint 继续 commit + push
            return subprocess.CompletedProcess(args, 1, "", "")
        return subprocess.CompletedProcess(args, 0, "", "")

    monkeypatch.setattr(render, "_git", fake_git)
    st = {"mode": "crawl", "crawled": {"/zuankeba/1.html": {}}, "dead": {},
          "category_cursor": {}, "category_exhausted": {}}
    render.checkpoint(st, "unit-test")
    joined = " ".join(" ".join(c) for c in calls)
    assert "commit" in joined and "push" in joined  # 确实提交并推送
    assert (tmp_path / ".crawl-state.json").exists()


# ---------------------------------------------------------------------------
# pending 待处理队列（跨运行续爬，保证「全量备份」不丢已发现文章）
# ---------------------------------------------------------------------------
def test_default_state_has_pending_set():
    st = render.default_state()
    assert "pending" in st and isinstance(st["pending"], set)


def test_load_state_restores_pending_as_set(tmp_path):
    p = tmp_path / ".crawl-state.json"
    p.write_text(json.dumps(
        {"pending": ["/zuankeba/1.html", "/zuankeba/2.html"],
         "crawled": {"/zuankeba/1.html": {}}}, ensure_ascii=False),
        encoding="utf-8")
    st = render.load_state(p)
    assert isinstance(st["pending"], set)
    assert st["pending"] == {"/zuankeba/1.html", "/zuankeba/2.html"}


def test_drain_frontier_persists_pending_across_cap(monkeypatch):
    # 修复「已发现文章被丢弃」：drain_frontier 受每日上限约束时，
    # 未渲染的文章与新发现的文章应留在 pending，供下次续爬（不丢页）。
    monkeypatch.setattr(render, "MAX_PAGES_PER_RUN", 3)
    monkeypatch.setattr(render, "CRAWL_DELAY_MS", 0)
    monkeypatch.setattr(render, "TARGET", "https://new.xianbao.fun")
    monkeypatch.setattr(render, "ORIGIN_NETLOC", "new.xianbao.fun")
    monkeypatch.setattr(render, "ALL_NETLOCS", {"new.xianbao.fun"})

    art = '<html><head><title>t</title></head><body>' \
          '<a href="/zuankeba/6.html">6</a><a href="/zuankeba/7.html">7</a>' \
          '<div class="content">内容</div></body></html>'
    html_by_path = {p: art for p in ["/zuankeba/%d.html" % i for i in range(1, 6)]}

    class FakePage:
        def __init__(self):
            self._url = None
        def goto(self, url, wait_until=None, timeout=None):
            self._url = url
            class R:
                status = 200
            return R()
        def wait_for_load_state(self, *a, **k):
            pass
        def wait_for_timeout(self, *a, **k):
            pass
        def evaluate(self, expr):
            path = render.urlparse(self._url).path
            return html_by_path.get(path, "<html><body>empty</body></html>")

    state = {"pending": {"/zuankeba/1.html", "/zuankeba/2.html", "/zuankeba/3.html",
                          "/zuankeba/4.html", "/zuankeba/5.html"},
             "crawled": {}, "dead": {}}
    counter = [0]
    crawled = {}
    def fake_save(path, rendered, kind):
        counter[0] += 1
        crawled[path] = {"hash": "x", "local": path, "last_check": ""}

    render.drain_frontier(FakePage(), {}, fake_save, state, counter)

    assert counter[0] == 3, counter[0]
    assert set(crawled.keys()) == {"/zuankeba/1.html", "/zuankeba/2.html",
                                     "/zuankeba/3.html"}
    # 未渲染的 4/5 与新发现的 6/7 留在 pending（跨运行续爬，不丢页）
    assert state["pending"] == {"/zuankeba/4.html", "/zuankeba/5.html",
                                 "/zuankeba/6.html", "/zuankeba/7.html"}

