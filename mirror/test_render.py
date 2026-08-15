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
    # 源站 header（含站外线报酷链接）被移除，但注入了新的导航 header
    assert "category-xianbaoku" not in out  # 源站 header 链接已清除
    assert "xianbao-article-nav" in out  # 新导航已注入
    assert "<footer" not in out
    assert "rank-list" not in out
    assert "xianbao-search-fab" not in out  # 锚点与死样式均移除
    assert "返回列表" not in out and 'href="/category-huluxia/"' in out  # 导航含当前分类
    assert "post-comment" in out  # 评论保留
    assert "article-content" in out  # 正文保留
    assert "xianbao-chrome-stripped" in out  # 幂等标记


def test_strip_chrome_injects_fancybox_noshift_fix():
    """回归护栏：strip_chrome 必须注入「灯箱防晃」修复，且新爬文章页自带。
    历史坑：Fancybox v5 开合灯箱时切换 <html> 的 overflow 并给 <body> 加
    margin-right 补偿，导致评论区左右晃动。修复须 (a) 全局强制滚动条常驻 +
    body margin-right 0（不能绑 .with-fancybox 类，关闭动画中该类会被短暂移除，
    绑类规则会失效一瞬间而回弹）；(b) Fancybox.show 带 hideScrollbar:false 从源头
    去掉 hide-scrollbar 补偿路径。本测试防未来改动静默删掉这两项。"""
    html = (
        '<html><head></head><body>'
        '<div class="article-content"><p>正文</p>'
        '<img data-fancybox="article-img" src="/zb_users/remote/x/1.jpg"></div>'
        '<div class="post-comment"><div class="ul">'
        '<img data-fancybox="pinglun-img" src="/zb_users/remote/x/2.jpg"></div>'
        '</div></body></html>'
    )
    out = render.strip_chrome(html, cat_slug="huluxia")

    # (1) 内联防晃 style 已注入，且为「全局」规则（不依赖 .with-fancybox）
    assert 'id="xianbao-fancybox-noshift"' in out
    style = out[out.index('id="xianbao-fancybox-noshift"'):]
    style = style[: style.index("</style>")]
    assert "overflow-y:scroll !important" in style
    assert "margin-right:0 !important" in style
    # 关键：绝不能回退成「绑定 .with-fancybox 类」的旧写法（那会在关闭动画中途失效）
    assert "html.with-fancybox" not in style

    # (2) 初始化脚本已注入，且 show 带 hideScrollbar:false（不是裸 {}）
    assert 'id="xianbao-fancybox-init"' in out
    assert "Fancybox.show(items,{hideScrollbar:false})" in out
    assert "Fancybox.show(items,{})" not in out

    # (3) 幂等：再跑一次不应重复注入（防止 recheck 时节点翻倍）
    out2 = render.strip_chrome(out, cat_slug="huluxia")
    assert out2.count('id="xianbao-fancybox-noshift"') == 1
    assert out2.count('id="xianbao-fancybox-init"') == 1


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


def test_rewrite_html_strips_source_addr_line():
    # 用户要求删除帖子正文里的「原文地址：」行。rewrite_html 应定位含「原文地址」
    # 的 <strong> 并删除其整行（块级父容器），而非仅中和 href。版权声明等其余块保留。
    html = (
        '<div class="art-copyright br"><div>'
        '<strong class="addr">原文地址：</strong>'
        '<a href="https://app.xdglt.com/mag/circle/v1/show/wapShowView?content_id=449149" '
        'target="_blank" title="8点百度">app.xdglt.com/...</a></div>'
        '<div><strong class="copyright">版权声明：</strong>本站作为免费线报整合平台</div>'
        '</div>'
    )
    out = render.rewrite_html(html)
    assert "原文地址" not in out                 # 整行删除
    assert "app.xdglt.com" not in out            # 源站 URL 一并消失
    assert "版权声明" in out                      # 其余块保留
    # 正文不受影响
    body = '<article><div class="article-content">正文内容</div></article>'
    assert "正文内容" in render.rewrite_html(body)


def test_rewrite_html_neutralizes_x6d_everywhere():
    # 用户要求 xiaodao 完全不跳源站（连优惠也留站内），故 www.x6d.com 已纳入
    # SOURCE_HOST_RE，正文优惠链接应中和；同时「原文地址：」整行应被删除。
    html = (
        '<div class="art-copyright br"><div>'
        '<strong class="addr">原文地址：</strong>'
        '<a href="https://www.x6d.com/thread-123.html">原文</a></div></div>'
        '<p>好价：<a href="https://www.x6d.com/item/888.html">点此领券</a></p>'
    )
    out = render.rewrite_html(html)
    assert "原文地址" not in out                  # 原文地址整行删除
    assert "www.x6d.com" not in out              # 优惠域名已中和
    assert 'href="#"' in out                     # 优惠链接被中和
    assert "点此领券" in out                      # 优惠可见文字保留
    assert "原文" not in out                      # 原文地址行已删除


def test_rewrite_html_neutralizes_source_family_host_anywhere():
    # 无歧义源站家族域名（app.xiaodigu.cn / app.xdglt.com / v1.xianbao.net 等）
    # 不论出现在正文、标题还是版权块，任何 <a href> 都应中和，避免跳源站。
    html = (
        '<div class="d-biaoti"><a href="https://app.xiaodigu.cn/mag/circle/v1/show/wapShowView?content_id=1">标题</a></div>'
        '<p>正文：<a href="https://app.xdglt.com/foo/bar">源站链接</a></p>'
    )
    out = render.rewrite_html(html)
    assert 'href="#"' in out
    assert "标题" in out and "源站链接" in out  # 可见文字保留
    assert "app.xiaodigu.cn" not in out and "app.xdglt.com" not in out  # 域名已中和
    # 京东优惠链接不受影响
    html2 = '<a href="https://u.jd.com/abc">领券</a>'
    assert 'href="https://u.jd.com/abc"' in render.rewrite_html(html2)


def test_rewrite_html_neutralizes_title_external_link():
    # 文章标题块 d-biaoti 内的外链一律中和（标题本就不该外跳），本地相对链接保留。
    html = (
        '<div class="d-biaoti"><a href="https://example.com/x">外链标题</a></div>'
        '<div class="d-biaoti"><a href="/xiaodigu/123.html">本地标题</a></div>'
    )
    out = render.rewrite_html(html)
    assert 'href="#"' in out
    assert 'href="/xiaodigu/123.html"' in out  # 本地相对链接保留


def test_rewrite_html_strips_domain_lock_redirect_script():
    # 源站 hex 混淆的「域名锁定」脚本：检测 hostname 不在官方域名列表就跳回源站。
    # 镜像站加载该脚本会把访客甩回 new.xianbao.fun，必须删除（这是之前“点帖子跳源站”
    # 的真正根因——页面加载即 JS 重定向，而非 <a href> 问题）。
    lock = (
        '<script>if (!["\\x6e\\x65\\x77\\x2e\\x78\\x69\\x61\\x6e\\x62\\x61\\x6f\\x2e\\x66\\x75\\x6e"]'
        '.includes(window["\\x6c\\x6f\\x63\\x61\\x74\\x69\\x6f\\x6e"]'
        '["\\x68\\x6f\\x73\\x74\\x6e\\x61\\x6d\\x65"]))'
        ' { window["\\x6c\\x6f\\x63\\x61\\x74\\x69\\x6f\\x6e"]'
        '["\\x68\\x72\\x65\\x66"]'
        ' = "\\x68\\x74\\x74\\x70\\x3a\\x2f\\x2f\\x6e\\x65\\x77\\x2e\\x78\\x69\\x61\\x6e\\x62\\x61\\x6f\\x2e\\x66\\x75\\x6e"; }</script>'
    )
    out = render.rewrite_html(lock + "<p>正文</p>")
    assert "new.xianbao.fun" not in out        # 源站域名已移除
    assert "location" not in out               # 整段脚本被删除
    assert "<script>" not in out               # 内联脚本块被剥离
    assert "正文" in out                        # 正文保留
    # 普通内联脚本不受影响
    html2 = '<script>console.log("hello")</script><p>ok</p>'
    assert "console.log" in render.rewrite_html(html2)


def test_rewrite_html_fixes_breadcrumb_separator():
    # 源站面包屑分隔符用 iconfont 图标（依赖外部 CDN at.alicdn.com），本地/部分环境
    # 不显示，导致「首页赚客吧文章正文」挤成一团。rewrite_html 应替换为文本「 › 」。
    html = (
        '<div class="mianbaoxie article-mbx">'
        '<a href="/">首页</a><i class="iconfont icon-right"></i>'
        '<a href="/category-zuankeba/">赚客吧</a><i class="iconfont icon-right"></i>'
        '文章正文</div>'
    )
    out = render.rewrite_html(html)
    assert "icon-right" not in out
    assert out.count(" › ") == 2                  # 两个分隔符已替换
    assert 'href="/"' in out and 'href="/category-zuankeba/"' in out  # 导航链接保留
    assert "首页" in out and "赚客吧" in out and "文章正文" in out


def test_strip_source_addr_regex():
    # 已提交 HTML 就地清理：外科手术式删「原文地址：」整行，零漂移。
    html = (
        '<div class="art-copyright br">'
        '<div><strong class="addr">原文地址：</strong>'
        '<a href="#">http://www.zuanke8.com/thread-9543109-1-1.html</a></div>'
        '<div><strong class="copyright">版权声明：</strong>本站声明</div></div>'
    )
    out = render.strip_source_addr(html)
    assert "原文地址" not in out
    assert "zuanke8.com" not in out
    assert "版权声明" in out


def test_strip_breadcrumb_icon_regex():
    # 已提交 HTML 就地清理：面包屑分隔符 icon-right -> 文本「 › 」。
    html = (
        '<a href="/">首页</a><i class="iconfont icon-right"></i>'
        '<a href="/category-x/">X</a><i class="iconfont icon-right"></i>文章正文'
    )
    out = render.strip_breadcrumb_icon(html)
    assert "icon-right" not in out
    assert out.count(" › ") == 2
    assert "首页" in out and "X" in out and "文章正文" in out


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
# 首页 / 分类页重构 —— 使用源站模板，仅列出本地已存在的文章
# ---------------------------------------------------------------------------
def test_format_list_time_today_vs_other_day():
    from datetime import datetime
    today = datetime.now()
    today_str = f"{today.year}年{today.month:02d}月{today.day:02d}日 12:07"
    assert render._format_list_time(today_str) == ("12:07", True)
    assert render._format_list_time("2026年06月22日 06:35") == ("06-22", False)
    assert render._format_list_time("") == ("", False)


def test_local_articles_by_cat_extracts_title_and_time(tmp_path):
    art = tmp_path / "zuankeba"
    art.mkdir(parents=True)
    (art / "6500001.html").write_text(
        '<html><head><title>红包-线报酷</title></head>'
        '<body><div class="article-box">'
        '<div class="head-info">'
        '<span class="comment"><i class="iconfont icon-comment"></i> 9</span>'
        '</div>'
        '<time><i class="iconfont icon-time"></i>2026年06月22日 06:35</time>'
        '<div class="content">京东红包</div></div></body></html>',
        encoding="utf-8")
    (art / "6500002.html").write_text(
        '<html><head><title>话费-线报酷</title></head>'
        '<body><time>2026年06月23日 08:00</time></body></html>',
        encoding="utf-8")
    by_cat = render._local_articles_by_cat(tmp_path)
    assert len(by_cat["zuankeba"]) == 2
    assert by_cat["zuankeba"][0]["id"] == 6500002  # 降序
    assert by_cat["zuankeba"][0]["title"] == "话费"
    assert by_cat["zuankeba"][1]["time"] == "2026年06月22日 06:35"
    assert by_cat["zuankeba"][1]["comments"] == 9
    assert by_cat["zuankeba"][1]["cat_label"] == "赚客吧"


def test_rebuild_category_page_keeps_existing_and_neutralizes_missing(tmp_path):
    # 构造源站风格分类页模板
    cat_dir = tmp_path / "category-zuankeba"
    cat_dir.mkdir(parents=True)
    template = cat_dir / "index.html"
    template.write_text(
        '<!DOCTYPE html><html><head><title>赚客吧-线报酷</title></head><body>'
        '<ul class="new-post">'
        '<li class="article-list"><p class="title"><a href="/zuankeba/6500001.html">a</a></p></li>'
        '<li class="article-list"><p class="title"><a href="/zuankeba/6500002.html">b</a></p></li>'
        '</ul>'
        '<div class="sidebar"><a href="/zuankeba/6500003.html">sidebar</a></div>'
        '</body></html>',
        encoding="utf-8")
    # 仅创建 6500001
    art_dir = tmp_path / "zuankeba"
    art_dir.mkdir(parents=True)
    (art_dir / "6500001.html").write_text(
        '<html><head><title>test-线报酷</title></head><body></body></html>',
        encoding="utf-8")
    items = [{
        "id": 6500001,
        "url": "/zuankeba/6500001.html",
        "title": "真实文章",
        "time": "2026年06月22日 06:35"
    }]
    render.rebuild_category_page(template, template, tmp_path, items, title="赚客吧")
    html = template.read_text(encoding="utf-8")
    # 主列表应使用新标题
    assert "真实文章" in html
    # 不存在的文章链接应被中和
    assert 'href="/zuankeba/6500003.html"' not in html
    assert 'href="#"' in html
    # 标题已更新
    assert "<title>赚客吧-线报酷镜像</title>" in html


def test_build_hub_uses_source_template(tmp_path):
    # 构造 zuankeba 分类页模板
    cat_dir = tmp_path / "category-zuankeba"
    cat_dir.mkdir(parents=True)
    (cat_dir / "index.html").write_text(
        '<!DOCTYPE html><html><head><title>赚客吧-线报酷</title></head><body>'
        '<ul class="new-post"></ul>'
        '</body></html>',
        encoding="utf-8")
    art_dir = tmp_path / "zuankeba"
    art_dir.mkdir(parents=True)
    (art_dir / "6500001.html").write_text(
        '<html><head><title>首页文章-线报酷</title></head>'
        '<body><time>2026年06月22日 06:35</time></body></html>',
        encoding="utf-8")
    render.build_hub(tmp_path)
    idx = (tmp_path / "index.html").read_text(encoding="utf-8")
    assert "首页文章" in idx
    assert "<title>首页-线报酷镜像</title>" in idx
    assert 'class="new-post"' in idx


def test_rebuild_category_pages_generates_pagination(tmp_path):
    # 构造 zuankeba 模板 + 210 篇本地文章（每页 100，共 3 页）
    cat_dir = tmp_path / "category-zuankeba"
    cat_dir.mkdir(parents=True)
    (cat_dir / "index.html").write_text(
        '<!DOCTYPE html><html><head><title>赚客吧-线报酷</title></head><body>'
        '<ul class="new-post"></ul><div class="pagebar"></div></body></html>',
        encoding="utf-8")
    art_dir = tmp_path / "zuankeba"
    art_dir.mkdir(parents=True)
    for i in range(210, 0, -1):
        (art_dir / f"6500{i:03d}.html").write_text(
            '<html><head><title>test-线报酷</title></head><body></body></html>',
            encoding="utf-8")
    render.rebuild_category_pages(tmp_path)
    assert (tmp_path / "category-zuankeba" / "index.html").exists()
    assert (tmp_path / "category-zuankeba" / "2" / "index.html").exists()
    assert (tmp_path / "category-zuankeba" / "3" / "index.html").exists()
    assert not (tmp_path / "category-zuankeba" / "4").exists()
    html2 = (tmp_path / "category-zuankeba" / "2" / "index.html").read_text(encoding="utf-8")
    assert 'href="/category-zuankeba/"' in html2  # 首页
    assert 'href="/category-zuankeba/3/"' in html2  # 下一页
    assert 'class="pagebar"' in html2


def test_rebuild_category_page_fixes_search_form(tmp_path):
    cat_dir = tmp_path / "category-zuankeba"
    cat_dir.mkdir(parents=True)
    (cat_dir / "index.html").write_text(
        '<!DOCTYPE html><html><head><title>赚客吧-线报酷</title></head><body>'
        '<form action="/zb_system/cmd.php?act=search" method="post"><input name="q"/><input name="cate" type="hidden" value="16"/></form>'
        '<script src="/zb_users/theme/xianbao_theme/script/meta.php?type=category&cateid=16"></script>'
        '<ul class="new-post"></ul></body></html>',
        encoding="utf-8")
    render.rebuild_category_page(cat_dir / "index.html", cat_dir / "index.html", tmp_path, [])
    html = (cat_dir / "index.html").read_text(encoding="utf-8")
    assert 'action="/search.html"' in html
    assert 'method="get"' in html
    assert 'name="cate"' not in html
    assert "meta.php" not in html


def test_rebuild_category_page_sanitizes_nonexistent_local_links(tmp_path):
    cat_dir = tmp_path / "category-zuankeba"
    cat_dir.mkdir(parents=True)
    (cat_dir / "index.html").write_text(
        '<!DOCTYPE html><html><head><title>赚客吧-线报酷</title></head><body>'
        '<ul class="new-post"></ul>'
        '<a href="/category-xianbaoku/">不存在的分类</a>'
        '<a href="/gonggao/6763.html">不存在的文章</a>'
        '</body></html>',
        encoding="utf-8")
    render.rebuild_category_page(cat_dir / "index.html", cat_dir / "index.html", tmp_path, [])
    html = (cat_dir / "index.html").read_text(encoding="utf-8")
    assert 'href="/category-xianbaoku/"' not in html
    assert 'href="/gonggao/6763.html"' not in html
    assert 'href="#"' in html

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


def test_build_source_list_item_has_comment_count_and_target_blank():
    from bs4 import BeautifulSoup
    soup = BeautifulSoup("<html><body></body></html>", "html.parser")
    item = {
        "id": 6500001,
        "url": "/zuankeba/6500001.html",
        "title": "红包活动",
        "time": "2026年06月22日 06:35",
        "comments": 9,
        "cat_label": "赚客吧",
    }
    li = render._build_source_list_item(soup, item)
    html = str(li)
    assert 'class="badge com"' in html
    assert '<i class="iconfont icon-comment"></i>' in html
    assert '>9<' in html or '>9</span>' in html
    assert 'target="_blank"' in html
    assert 'data-comments="9"' in html
    assert 'data-catename="赚客吧"' in html


def test_prune_nav_removes_unmirrored_categories_and_keeps_allowed(tmp_path):
    cat_dir = tmp_path / "category-zuankeba"
    cat_dir.mkdir(parents=True)
    (cat_dir / "index.html").write_text(
        '<!DOCTYPE html><html><head><title>赚客吧-线报酷</title></head><body>'
        '<ul class="nav-ul">'
        '<li id="nvabar-item-index"><a href="/">首页</a></li>'
        '<li id="navbar-category-xianbaoku"><a href="#">线报酷</a></li>'
        '<li id="navbar-category-zuankeba"><a href="/category-zuankeba/">赚客吧</a></li>'
        '<li id="navbar-category-xinzuanba"><a href="/category-xinzuanba/">新赚吧</a></li>'
        '<li id="navbar-category-douban"><a href="#">豆瓣线报</a></li>'
        '<li id="navbar-category-qita"><a href="#">其他区</a></li>'
        '</ul>'
        '<ul class="nav2-ul"><li>xxx</li></ul>'
        '</body></html>',
        encoding="utf-8")
    render.rebuild_category_page(cat_dir / "index.html", cat_dir / "index.html", tmp_path, [], cat="zuankeba", title="赚客吧")
    html = (cat_dir / "index.html").read_text(encoding="utf-8")
    # 保留首页和已镜像分类
    assert 'id="nvabar-item-index"' in html
    assert 'id="navbar-category-zuankeba"' in html
    assert 'id="navbar-category-xinzuanba"' in html
    # 删除未镜像分类
    assert 'id="navbar-category-xianbaoku"' not in html
    assert 'id="navbar-category-douban"' not in html
    assert 'id="navbar-category-qita"' not in html
    # 补充 huluxia / xiaodao
    assert 'id="navbar-category-huluxia"' in html
    assert 'id="navbar-category-xiaodao"' in html
    # 次级导航删除
    assert 'nav2-ul' not in html
    # 当前分类高亮
    assert 'class="active"' in html and 'id="navbar-category-zuankeba"' in html


def test_build_search_page_uses_source_template(tmp_path):
    cat_dir = tmp_path / "category-zuankeba"
    cat_dir.mkdir(parents=True)
    (cat_dir / "index.html").write_text(
        '<!DOCTYPE html><html><head><title>赚客吧-线报酷</title></head><body>'
        '<header class="header sb"><ul class="nav-ul"><li id="nvabar-item-index"><a href="/">首页</a></li>'
        '<li id="navbar-category-zuankeba"><a href="/category-zuankeba/">赚客吧</a></li></ul></header>'
        '<div class="content container clearfix"><section class="fl br mb sb" id="mainbox">'
        '<div class="mianbaoxie article-mbx"><a href="/">首页</a> › <a href="/category-zuankeba/">赚客吧</a></div>'
        '<div class="listbox"><ul class="new-post"></ul></div>'
        '</section><aside class="fr" id="sidebar"><div class="theiaStickySidebar celan"></div></aside></div>'
        '</body></html>',
        encoding="utf-8")
    items = [
        {"id": "1", "title": "移动话费", "url": "/zuankeba/1.html", "body": "移动", "cat": "zuankeba", "cat_label": "赚客吧", "comments": 5, "time": "2026年06月22日 06:35"},
        {"id": "2", "title": "联通流量", "url": "/xiaodigu/2.html", "body": "联通", "cat": "xiaodigu", "cat_label": "小嘀咕", "comments": 3, "time": "2026年06月22日 07:35"},
    ]
    render.build_search_page(tmp_path, items)
    html = (tmp_path / "search.html").read_text(encoding="utf-8")
    # 标题、面包屑、搜索框、列表、脚本
    assert "<title>搜索-线报酷镜像</title>" in html
    assert 'class="mianbaoxie' in html and "搜索" in html
    assert 'id="q"' in html
    assert 'ul class="new-post"' in html
    assert 'MiniSearch' in html
    # 右侧热榜（12/24/48 小时榜）已移除
    assert 'xianbao-rank-box' not in html
    assert '十二小时榜' not in html
    assert 'id="sidebar"' not in html
    # 列表页居中作用域类已注入
    assert 'xianbao-list' in html
    # 导航被清理
    assert 'id="navbar-category-zuankeba"' in html


def test_build_search_index_includes_cat_and_comments(tmp_path):
    art = tmp_path / "zuankeba"
    art.mkdir(parents=True)
    (art / "6500001.html").write_text(
        '<html><head><title>红包-线报酷</title></head>'
        '<body><div class="head-info"><span class="comment"><i class="iconfont icon-comment"></i> 7</span></div>'
        '<div class="content">京东红包</div></body></html>',
        encoding="utf-8")
    n = render.build_search_index(tmp_path)
    assert n == 1
    idx = json.loads((tmp_path / "search.json").read_text(encoding="utf-8"))
    assert idx[0]["cat"] == "zuankeba"
    assert idx[0]["cat_label"] == "赚客吧"
    assert idx[0]["comments"] == 7
    assert (tmp_path / "search.html").exists()


def test_prune_nav_removes_login_icon_and_about_and_hot_dropdown(tmp_path):
    cat_dir = tmp_path / "category-zuankeba"
    cat_dir.mkdir(parents=True)
    (cat_dir / "index.html").write_text(
        '<!DOCTYPE html><html><head><title>赚客吧-线报酷</title></head><body>'
        '<div class="login fr"><a href="#"><i class="iconfont icon-user"></i></a></div>'
        '<ul class="nav-ul">'
        '<li id="nvabar-item-index"><a href="/">首页</a></li>'
        '<li id="navbar-category-zuankeba"><a href="/category-zuankeba/">赚客吧</a>'
        '<span class="toggle-btn"><i class="iconfont icon-down"></i></span>'
        '<ul class="dropdown-nav nav-sb br sub-nav"><li><a href="#">赚客吧热帖</a></li></ul>'
        '</li>'
        '</ul>'
        '<footer class="footer"><div class="f-about fl"><p class="title">关于本站</p></div>'
        '<div class="f-contact fl"><p class="title">联系我们</p></div></footer>'
        '</body></html>',
        encoding="utf-8")
    render.rebuild_category_page(
        cat_dir / "index.html", cat_dir / "index.html", tmp_path, [],
        cat="zuankeba", title="赚客吧")
    html = (cat_dir / "index.html").read_text(encoding="utf-8")
    # 登录图标移除
    assert 'class="login' not in html
    assert 'icon-user' not in html
    # 热帖下拉移除，但「赚客吧」导航项本身保留
    assert 'navbar-category-zuankeba' in html
    assert '热帖' not in html
    assert 'dropdown-nav' not in html
    assert 'toggle-btn' not in html
    # 关于本站 / 联系我们 / 关注我们 全部移除（页脚属于源站联系方式，镜像不展示）
    assert '关于本站' not in html
    assert 'f-about' not in html
    assert '联系我们' not in html
    assert 'f-contact' not in html
    assert 'footer' not in html


def test_strip_chrome_removes_xiangguan():
    html = (
        '<html><head></head><body>'
        '<div class="content"><p>正文内容</p></div>'
        '<div class="xiangguan sb mt"><div class="clearfix">'
        '<div class="mianbaoxie">猜你还会喜欢（红包）</div>'
        '<div class="swiper">...</div></div></div>'
        '</body></html>'
    )
    out = render.strip_chrome(html, cat_slug="huluxia")
    assert "xiangguan" not in out
    assert "猜你还会喜欢" not in out
    assert "正文内容" in out  # 正文保留


def test_ensure_minisearch_copies_vendor(tmp_path):
    ok = render.ensure_minisearch(tmp_path)
    assert ok
    lib = tmp_path / "lib" / "minisearch.umd.min.js"
    assert lib.exists() and lib.stat().st_size > 0


def test_localize_images_downloads_and_rewrites(tmp_path, monkeypatch):
    art = tmp_path / "xiaodigu"
    art.mkdir()
    (art / "6437971.html").write_text(
        '<html><body><img alt="x" referrerpolicy="no-referrer" '
        'src="https://pic.xiaodigu.cn/pic/20260608/1780914956809419802.jpg"></body></html>',
        encoding="utf-8")

    import urllib.request as urllib_request

    captured = {}

    class FakeResp:
        headers = {"Content-Type": "image/jpeg"}

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return b"\xff\xd8\xff\xe0fakejpeg"

    def fake_open(req, timeout=30):
        captured["url"] = req.full_url
        return FakeResp()

    monkeypatch.setattr(urllib_request, "urlopen", fake_open)

    stats = render.localize_images(tmp_path)
    html = (art / "6437971.html").read_text(encoding="utf-8")
    assert "/zb_users/remote/pic.xiaodigu.cn/pic/20260608/1780914956809419802.jpg" in html
    local = tmp_path / "zb_users/remote/pic.xiaodigu.cn/pic/20260608/1780914956809419802.jpg"
    assert local.exists()
    assert stats["downloaded"] == 1
    assert stats["rewritten"] == 1
    assert captured["url"].startswith("https://pic.xiaodigu.cn/")


def test_rebuild_category_page_strips_source_common_js(tmp_path):
    """回归护栏：列表页（首页/分类页）必须剥离源站 common.js。

    历史坑：源站 common.js 自绑定 #search-button / .m-nav-btn，与
    _inject_nav_tools 注入的自包含交互脚本冲突（双重 toggle），导致分类页
    点击搜索框反而隐藏、移动端汉堡菜单错乱。文章页由 strip_chrome 处理，
    列表页此前漏掉（首页侥幸复用已剥离的 zuankeba 模板）。本测试防回归。
    """
    tpl_src = Path("xianbao/category-zuankeba/index.html").read_text(encoding="utf-8")
    assert "common.js" not in tpl_src  # 当前产物已干净
    # 人为注入 common.js 模拟 bug 复现条件
    injected = tpl_src.replace(
        "</head>",
        '<script src="/zb_users/theme/xianbao_theme/script/common.js?v=20260211212111"></script></head>',
        1,
    )
    assert "common.js" in injected
    cat_dir = tmp_path / "category-xiaodao"
    cat_dir.mkdir(parents=True)
    tpl = cat_dir / "index.html"
    tpl.write_text(injected, encoding="utf-8")
    render.rebuild_category_page(
        tpl, tpl, tmp_path, items=[], cat="xiaodao", page=1, total_pages=1, title="小刀娱乐网"
    )
    out = tpl.read_text(encoding="utf-8")
    assert "common.js" not in out        # 关键：common.js 必须消失
    assert "search-area" in out          # 搜索框结构保留
    assert "xianbao-nav-tools" in out    # 自包含交互脚本仍在


def test_resolve_dir_file_conflict_renames_blocking_file(tmp_path):
    """回归：源站 `/forum`(文件) 与 `/forum/202605/...`(目录) 映射到同一站内路径时，
    ensure_download 的 mkdir 不再抛 FileExistsError。挡路的【文件】应被改名避让保留，
    且目标目录最终可成功创建。"""
    # 制造冲突：祖先 `forum` 已是一个文件（而非目录）
    blocking = tmp_path / "zb_users" / "remote" / "img.xianbao.net" / "data" / "attachment" / "forum"
    blocking.parent.mkdir(parents=True)
    blocking.write_text("i am a stray file, not a dir")
    # 目标：在 forum 之下再建子目录并落文件
    target_parent = blocking.parent / "forum" / "202605" / "14"

    # 修复前会抛 FileExistsError；修复后冲突文件被改名、目录可建
    render._resolve_dir_file_conflict(target_parent)
    target_parent.mkdir(parents=True, exist_ok=True)

    # 原冲突【文件】不再以 forum 之名存在（已被改名避让，且 forum 现为目录）
    assert blocking.is_file() is False, "原冲突文件应被改名（forum 不再是散落文件）"
    assert (blocking.parent / "forum" / "202605" / "14").is_dir(), "目标子目录应成功创建"
    # 原文件未被删除，而是改名保留且内容一致
    renamed = list(blocking.parent.glob("forum.conflict-*"))
    assert len(renamed) == 1, f"应有一个改名避让文件，实际: {renamed}"
    assert renamed[0].read_text() == "i am a stray file, not a dir"

