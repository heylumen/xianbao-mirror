"""图片本地化修复的回归测试（离线、零网络）。

背景：源站图片走 IntersectionObserver 懒加载，静态 HTML 里
`<img src="/plus/api/image.php?imgurl=<真实CDN>">` 只是**相对**占位符；
镜像站没有 image.php 这个 PHP 代理，直接请求必然 404（裂图）。

而 `localize_images` 原先只用 `^https?://` 过滤，这类相对占位符被整体跳过，
导致存量文章的图片从未被本地化（实测仅 zuankeba 一个分类就有 6766 篇）。
修复：收集图片 URL 前先用 `_normalize_img_url` 把相对占位符规范化为绝对 URL。
"""

from __future__ import annotations

import re

import render

REMOTE_RE = re.compile(r"^https?://", re.I)

# 取自真实帖子 xianbao/zuankeba/6941656.html
REAL_PLACEHOLDER = (
    "/plus/api/image.php?imgurl=http%3A%2F%2Fimg.zuanke8.cn%2Fforum%2F202609%2F03%2F"
    "153826j8nuj2nnrkzr8nn2.jpg"
)


def test_relative_placeholder_is_normalized_to_absolute() -> None:
    """相对占位符必须被规范化成绝对 URL，否则会被 remote_re 过滤掉。"""
    assert not REMOTE_RE.match(REAL_PLACEHOLDER)  # 修复前：不匹配 → 被跳过
    normalized = render._normalize_img_url(REAL_PLACEHOLDER)
    assert REMOTE_RE.match(normalized)            # 修复后：可进入本地化流程


def test_normalized_url_resolves_to_real_cdn() -> None:
    """规范化后应能解析出真实 CDN（落盘依据）与源站代理下载地址。"""
    real, fetch = render._proxy_pair(render._normalize_img_url(REAL_PLACEHOLDER))
    assert real == "http://img.zuanke8.cn/forum/202609/03/153826j8nuj2nnrkzr8nn2.jpg"
    # 下载必须走源站代理（真实 CDN 有 Referer 防盗链，直连 403）
    assert "/plus/api/image.php?imgurl=" in fetch
    assert "img.zuanke8.cn" in fetch


def test_absolute_url_is_returned_unchanged() -> None:
    url = "https://img.zuanke8.cn/a/b.jpg"
    assert render._normalize_img_url(url) == url


def test_ordinary_relative_path_is_untouched() -> None:
    """非代理类的站内相对资源不应被改写（如主题 logo）。"""
    url = "/zb_users/theme/xianbao_theme/image/newlogo.png"
    assert render._normalize_img_url(url) == url


def test_empty_value_is_safe() -> None:
    assert render._normalize_img_url("") == ""


def test_proxy_abs_url_rejects_non_proxy_paths() -> None:
    assert render._proxy_abs_url("/zb_users/theme/x.png") is None
    assert render._proxy_abs_url("") is None
    assert render._proxy_abs_url(None) is None


def test_proxy_pair_passthrough_for_normal_url() -> None:
    url = "https://img.zuanke8.cn/x.jpg"
    assert render._proxy_pair(url) == (url, url)
