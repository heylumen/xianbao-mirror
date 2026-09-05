"""P10 · 回填完成判定修复的回归测试（离线、零网络）。

锁定语义：**maintenance 抽样复查不得再被「源站持续发新帖」永久阻塞**。

背景：原判定置于 `drain_frontier` 之前，形如 `all(exhausted) AND not pending`；
每轮开头的「各分类第 1 页探新帖」都会把新帖补进 pending，使条件恒成立为假
→ mode 永远停在 crawl、recheck 从未启动（实测 recheck_idx 恒为 0）。
修复：判定移到 drain 之后 + 采用一次性标记 `backfill_complete`。
"""

from __future__ import annotations

import json

import render


def _exhausted_state(**overrides):
    """构造「所有分类已翻完」的状态。"""
    state = render.default_state()
    state["category_exhausted"] = {s: True for s in render.ALLOWED_CATEGORIES}
    state.update(overrides)
    return state


# ------------------------------------------------------------ 状态字段默认值

def test_default_state_has_backfill_fields() -> None:
    state = render.default_state()
    assert state["backfill_complete"] is False
    assert state["backfill_completed_at"] is None


def test_load_state_backfills_missing_fields(tmp_path) -> None:
    """旧状态文件缺 backfill_* 字段时自动补默认值，不丢进度。"""
    legacy = {
        "version": 2,
        "mode": "crawl",
        "category_exhausted": {s: True for s in render.ALLOWED_CATEGORIES},
        "crawled": {"/zuankeba/1.html": {"hash": "h", "local": "1.html"}},
        "pending": ["/zuankeba/2.html"],
        "recheck_idx": 0,
    }
    path = tmp_path / "state.json"
    path.write_text(json.dumps(legacy), encoding="utf-8")

    state = render.load_state(path)
    assert state["backfill_complete"] is False
    assert state["backfill_completed_at"] is None
    # 既有数据保持完整
    assert state["crawled"] == {"/zuankeba/1.html": {"hash": "h", "local": "1.html"}}
    assert state["pending"] == {"/zuankeba/2.html"}


# ------------------------------------------------------------ 置位条件

def test_not_marked_while_pending_not_drained() -> None:
    """pending 尚未排空时不得置位（需等 drain 之后才判定）。"""
    state = _exhausted_state(pending={"/zuankeba/1.html"})
    assert render.mark_backfill_if_complete(state) is False
    assert state["backfill_complete"] is False
    assert state["mode"] == "crawl"


def test_not_marked_until_all_categories_exhausted() -> None:
    state = _exhausted_state(pending=set())
    state["category_exhausted"]["xiaodao"] = False
    assert render.mark_backfill_if_complete(state) is False


def test_marked_when_exhausted_and_pending_drained() -> None:
    state = _exhausted_state(pending=set())
    assert render.mark_backfill_if_complete(state) is True
    assert state["backfill_complete"] is True
    assert state["backfill_completed_at"] is not None
    assert state["mode"] == "maintenance"
    assert state["completed_at"] is not None


def test_mark_is_idempotent() -> None:
    state = _exhausted_state(pending=set())
    assert render.mark_backfill_if_complete(state) is True
    assert render.mark_backfill_if_complete(state) is False  # 幂等


def test_mark_is_sticky_despite_new_posts() -> None:
    """★ 核心回归：置位后源站新帖再入队也不得回退。

    旧实现因 pending 恒被新帖补充而永不置位，导致复查从未启动。
    此测试锁定「一次性标记」语义，防止修复被回退。
    """
    state = _exhausted_state(pending=set())
    render.mark_backfill_if_complete(state)

    state["pending"].add("/zuankeba/9999999.html")  # 模拟源站发布新帖
    assert render.mark_backfill_if_complete(state) is False
    assert state["backfill_complete"] is True       # 不回退
    assert state["mode"] == "maintenance"           # 复查仍可启动


def test_missing_exhausted_key_is_treated_as_incomplete() -> None:
    """分类状态缺失时按未完成处理（保守，避免误判完成而停止回填）。"""
    state = render.default_state()
    state["category_exhausted"] = {}  # 空表
    assert render.mark_backfill_if_complete(state) is False


# ------------------------------------------------------------ 复查取样范围

def test_recheck_sample_covers_article_pages_only() -> None:
    """复查只取文章页：列表页每轮重建，复查无增量价值且挤占配额。"""
    pages = [
        "/zuankeba/1.html",
        "/xiaodao/9.html",
        "/category-zuankeba/",
        "/category-zuankeba/2/",
        "/index.html",
        "/search.html",
    ]
    articles = [p for p in pages if render.ART_RE.match(p)]
    assert articles == ["/zuankeba/1.html", "/xiaodao/9.html"]


def test_art_re_matches_real_article_paths() -> None:
    assert render.ART_RE.match("/zuankeba/6941656.html")
    assert render.ART_RE.match("/xinzuanba/123.html")
    assert not render.ART_RE.match("/zuankeba/")
    assert not render.ART_RE.match("/zuankeba/abc.html")
