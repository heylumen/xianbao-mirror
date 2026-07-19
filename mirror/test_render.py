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
import importlib
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
    # 非白名单页面 -> 本地相对路径（留在镜像站内，不再跳转到原站）
    assert render.fix_url("/haodan/6654815") == "/haodan/6654815.html"


def test_fix_url_disallowed_page_fragment():
    assert render.fix_url("/haodan/6654815#c1") == "/haodan/6654815.html#c1"


def test_strip_chrome_removes_offsite_chrome():
    html = (
        '<html><head><style>.xianbao-search-fab{color:red}</style></head>'
        '<body>'
        '<header class="header sb"><a href="/category-xianbaoku/">线报酷</a></header>'
        '<div class="content"><div class="article-box"><div class="article-content">'
        '<h1>标题</h1><p>正文内容</p>'
        '<div class="post-comment">评论区</div>'
        '</div></div>'
        '<aside><div class="rank-list">热门</div></aside>'
        '<footer class="footer"><a href="https://beian.miit.gov.cn/">备案</a></footer>'
        '<a class="xianbao-search-fab" href="/search.html">🔍</a>'
        '</body></html>'
    )
    out = render.strip_chrome(html, cat_slug="huluxia")
    assert "<header" not in out
    assert "<footer" not in out
    assert "rank-list" not in out
    assert "xianbao-search-fab" not in out  # 锚点与死样式均移除
    assert "返回列表" in out and 'href="/category-huluxia/"' in out
    assert "post-comment" in out  # 评论保留
    assert "article-content" in out  # 正文保留
    assert "xianbao-chrome-stripped" in out  # 幂等标记


def test_fix_url_asset_local():
    assert render.fix_url("/zb_users/style.css") == "/zb_users/style.css"


def test_fix_url_cross_origin_unchanged():
    assert render.fix_url("https://example.com/foo") == "https://example.com/foo"


def test_fix_url_subdomain_not_pool():
    assert render.fix_url("https://new.xianbao.fun.evil.com/x") == "https://new.xianbao.fun.evil.com/x"


def test_fix_url_protocol_relative_unchanged():
    assert render.fix_url("//cdn.example.com/x") == "//cdn.example.com/x"


def test_fix_url_protocol_relative_source_rewritten():
    # 协议相对链接若属于源站，应改写成本地路径，避免点击后跳到源站
    assert render.fix_url("//new.xianbao.fun/zuankeba/6656382.html") == "/zuankeba/6656382.html"


def test_fix_url_protocol_relative_source_disallowed():
    # 非白名单分类也改成站内相对路径，不再跳活站
    assert render.fix_url("//new.xianbao.fun/haodan/6654815") == "/haodan/6654815.html"


def test_fix_url_window_open_in_html():
    html = '<script>window.open("https://new.xianbao.fun/haodan/6654815");</script>'
    out = render.rewrite_html(html)
    assert 'window.open("/haodan/6654815.html")' in out

def test_fix_url_bare_origin_root():
    assert render.fix_url("https://new.xianbao.fun") == "/"
    assert render.fix_url("https://new.xianbao.fun/") == "/"


def test_fix_url_forum_thread_default_slug():
    # v1.xianbao.net 论坛帖子链接 -> 本地同分类（兜底 xinzuanba）路径，不再跳源站
    assert render.fix_url("https://v1.xianbao.net/thread-310278-1-1.html") == "/xinzuanba/310278.html"


def test_fix_url_forum_thread_with_cat_slug():
    assert render.fix_url("https://v1.xianbao.net/thread-310278-1-1.html",
                          cat_slug="xinzuanba") == "/xinzuanba/310278.html"


def test_fix_url_forum_non_thread_unchanged():
    # 论坛域名上非 thread 链接（如其它页面）保持原样（属外部）
    assert render.fix_url("https://v1.xianbao.net/forum.php") == "https://v1.xianbao.net/forum.php"


def test_rewrite_html_forum_thread_link_local():
    html = ('<a href="https://v1.xianbao.net/thread-310278-1-1.html" '
            'data-yuanurl="https://v1.xianbao.net/thread-310278-1-1.html">帖</a>')
    out = render.rewrite_html(html, cat_slug="xinzuanba")
    assert 'href="/xinzuanba/310278.html"' in out
    assert 'data-yuanurl="/xinzuanba/310278.html"' in out
    assert "v1.xianbao.net" not in out


def test_rewrite_html_strips_source_domain_inside_qr_widget():
    # 分享二维码组件：src 的 netloc 是二维码 API，内部 d= 参数才是源站绝对地址。
    # fix_url 只改写属性顶层 URL（外部域名保持不变），故需 rewrite_html 的全局兜底
    # 把 d= 里的源站域名抹掉、保留本地路径。
    html = (
        '<img src="//qr.example.com/api/qr.php?qrsize=200&amp;'
        'd=https://news.xianbao.fun/category-zuankeba/">'
    )
    out = render.rewrite_html(html)
    assert "news.xianbao.fun" not in out
    assert "d=/category-zuankeba/" in out


def test_rewrite_html_removes_protocol_relative_source_everywhere():
    html = '<a href="//new.ixbk.net/haodan/6654815">x</a>'
    out = render.rewrite_html(html)
    assert "new.ixbk.net" not in out
    assert 'href="/haodan/6654815.html"' in out


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


def test_discover_forum_thread_maps_to_portal():
    # 列表页（base_url 为 xinzuanba 分类）中的论坛帖子链接，应映射为门户同分类文章 URL
    html = '<a href="https://v1.xianbao.net/thread-310278-1-1.html">帖</a>'
    links = render.discover_article_links(
        html, "https://new.xianbao.fun/category-xinzuanba/")
    assert "https://new.xianbao.fun/xinzuanba/310278.html" in links


def test_drain_frontier_round_robin_fairness(monkeypatch):
    # 模拟：xiaodigu 队列庞大，xinzuanba/zuankeba 很少。
    # 旧逻辑按字母序排，xiaodigu 会吃光预算；新逻辑应 round-robin 让各分类都分到。
    state = {
        "pending": {f"/xiaodigu/{i}.html" for i in range(200)}
                   | {f"/xinzuanba/{i}.html" for i in range(3)}
                   | {f"/zuankeba/{i}.html" for i in range(3)},
        "crawled": {},
        "dead": {},
    }
    render.MAX_PAGES_PER_RUN = 10
    render.CRAWL_DELAY_MS = 0
    order = []

    def fake_render(page, url, path, raw_docs, state):
        order.append(path.split("/")[1])
        return (True, "<html></html>", "<html></html>")

    monkeypatch.setattr(render, "render_page", fake_render)

    def fake_save(path, rendered, kind):
        pass

    counter = [0]
    render.drain_frontier(None, {}, fake_save, state, counter)
    # 新赚客吧 / 赚客吧 都应被抓取（未被 xiaodigu 饿死）
    assert "xinzuanba" in order, order
    assert "zuankeba" in order, order
    assert not all(s == "xiaodigu" for s in order), order


def test_TARGET_without_scheme_is_normalized(monkeypatch):
    # 当 TARGET_URL 只给域名没给 scheme 时，模块应自动补 https://，避免 ORIGIN 缺 scheme
    # 导致 discover_article_links 把相对路径拼成错误 URL。
    orig = os.environ.get("TARGET_URL")
    monkeypatch.setenv("TARGET_URL", "news.xianbao.fun")
    importlib.reload(render)
    try:
        assert render.TARGET.startswith("https://")
        assert render.ORIGIN.startswith("https://")
        assert render.ORIGIN_NETLOC == "news.xianbao.fun"
        # 验证此时 discover_article_links 仍能正确解析相对文章链接
        links = render.discover_article_links(
            '<a href="/zuankeba/6656382.html">x</a>', render.ORIGIN + "/category-zuankeba/"
        )
        assert any("/zuankeba/6656382.html" in l for l in links)
    finally:
        if orig is None:
            monkeypatch.delenv("TARGET_URL", raising=False)
        else:
            monkeypatch.setenv("TARGET_URL", orig)
        importlib.reload(render)
        # 恢复测试文件顶部的固定值，保证后续测试稳定
        render.TARGET = "https://new.xianbao.fun"
        render.ORIGIN = "https://new.xianbao.fun"
        render.ORIGIN_NETLOC = "new.xianbao.fun"


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

