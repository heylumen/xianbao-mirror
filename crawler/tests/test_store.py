"""M1 · 存储层单元测试（离线、零网络）。

重点覆盖：
- 去重：URL 归一化 + simhash 近重复；
- frontier / crawled / dead 状态机；
- **★ P10 修正**：`backfill_complete` 一次性标记，使 maintenance 复查不再被
  「源站持续发新帖」永久阻塞；
- 与现有 `xianbao/.crawl-state.json` 格式的双向兼容（不丢进度、无需重建）。
"""

from __future__ import annotations

import json

import pytest

from crawler.core.store.dedup import (
    content_sha256,
    hamming_distance,
    is_near_duplicate,
    normalize_url,
    simhash,
)
from crawler.core.store.state import CrawlRecord, StateStore


# ------------------------------------------------------------------ URL 归一化

def test_normalize_keeps_relative_path() -> None:
    """站内相对路径必须保持相对形态（现有状态文件即为此格式）。"""
    assert normalize_url("/zuankeba/6862513.html") == "/zuankeba/6862513.html"


def test_normalize_drops_fragment() -> None:
    assert normalize_url("/a.html#comment-3") == "/a.html"
    assert normalize_url("https://a.com/x.html#top") == "https://a.com/x.html"


def test_normalize_lowercases_host_and_strips_default_port() -> None:
    assert normalize_url("https://A.COM:443/x/") == "https://a.com/x"
    assert normalize_url("http://A.com:80/x") == "http://a.com/x"


def test_normalize_filters_irrelevant_query() -> None:
    assert normalize_url("/x.html?utm_source=ad&page=2") == "/x.html?page=2"


def test_normalize_keeps_root_slash() -> None:
    assert normalize_url("https://a.com") == "https://a.com/"


def test_normalize_is_stable_within_same_url_form() -> None:
    """同一形态的 URL 组内归一化结果必须一致。

    注意：相对路径**刻意不**与绝对 URL 归并为同一值 —— 现有
    `xianbao/.crawl-state.json` 的 pending / crawled 键均为站内相对路径，
    强行补全 scheme/host 会破坏与既有状态文件的互操作。
    """
    relative = ["/a.html", "/a.html#x", "/a.html?utm=1"]
    assert len({normalize_url(v) for v in relative}) == 1

    absolute = [
        "https://a.com/x.html",
        "https://A.COM:443/x.html",
        "//a.com/x.html#top",
    ]
    assert len({normalize_url(v) for v in absolute}) == 1

    # 两种形态各自保持，互不混淆
    assert normalize_url("/a.html") != normalize_url("https://a.com/a.html")


# ------------------------------------------------------------------ 内容指纹

def test_content_sha256_detects_change() -> None:
    assert content_sha256("abc") != content_sha256("abd")
    assert content_sha256("abc") == content_sha256("abc")


def test_simhash_near_duplicate_detection() -> None:
    base = "这是一篇关于优惠活动的文章内容" * 5
    modified = base + "（广告插入）"
    assert is_near_duplicate(simhash(base), simhash(modified), threshold=8)


def test_simhash_distinguishes_different_content() -> None:
    left = simhash("优惠活动 京东 优惠券 满减" * 10)
    right = simhash("国际新闻 市场 行情 分析" * 10)
    assert not is_near_duplicate(left, right, threshold=8)


def test_hamming_distance() -> None:
    assert hamming_distance(0b1010, 0b1000) == 1
    assert hamming_distance(0b1111, 0b0000) == 4


def test_simhash_empty_text() -> None:
    assert simhash("") == 0


# ------------------------------------------------------------------ 队列与去重

def test_add_discovered_deduplicates() -> None:
    store = StateStore()
    assert store.add_discovered(["/a.html", "/a.html#x", "/b.html"]) == 2


def test_add_discovered_skips_crawled_and_dead() -> None:
    store = StateStore()
    store.mark_crawled("/a.html", "hash-a")
    store.mark_dead("/b.html", "404")
    assert store.add_discovered(["/a.html", "/b.html", "/c.html"]) == 1
    assert store.frontier == {"/c.html"}


def test_next_batch_removes_from_frontier() -> None:
    store = StateStore()
    store.add_discovered(["/a", "/b", "/c"])
    assert store.next_batch(2) == ["/a", "/b"]
    assert store.frontier == {"/c"}


def test_next_batch_respects_size_and_empty() -> None:
    store = StateStore()
    assert store.next_batch(5) == []
    store.add_discovered(["/a"])
    assert store.next_batch(0) == []


def test_mark_dead_records_reason_and_permanence() -> None:
    store = StateStore()
    store.add_discovered(["/gone"])
    store.mark_dead("/gone", "404")
    assert store.dead["/gone"]["reason"] == "404"
    assert store.dead["/gone"]["permanent"] is True
    assert store.frontier == set()  # 死链应被移出队列


# ------------------------------------------------- ★ P10 修正：回填完成语义

def test_backfill_not_complete_while_frontier_nonempty() -> None:
    store = StateStore(category_exhausted={"zuankeba": True})
    store.add_discovered(["/a"])
    assert store.update_backfill() is False
    assert store.backfill_complete is False
    assert store.next_recheck_sample(10) == []  # 回填未完成 → 不启动复查


def test_backfill_requires_all_categories_exhausted() -> None:
    store = StateStore(category_exhausted={"zuankeba": True, "xiaodao": False})
    assert store.update_backfill() is False


def test_backfill_completes_when_exhausted_and_empty() -> None:
    store = StateStore(category_exhausted={"zuankeba": True, "xiaodao": True})
    assert store.update_backfill() is True
    assert store.backfill_complete is True
    assert store.backfill_completed_at is not None


def test_backfill_complete_is_sticky_despite_new_posts() -> None:
    """★ P10 核心回归：置位后，源站新帖再填满 frontier 也不得回退。

    现有实现（render.py:2474）因 `not pending` 条件，会因新帖持续入队而永不置位，
    导致 maintenance 复查从未启动。此测试锁定「一次性标记」语义。
    """
    store = StateStore(
        crawled={"/a": {}, "/b": {}, "/c": {}},  # 存量文章，供复查取样
        category_exhausted={"zuankeba": True},
    )
    assert store.update_backfill() is True
    assert store.backfill_complete is True

    # 模拟源站持续发布新帖：frontier 再次被填满
    store.add_discovered(["/new-1", "/new-2", "/new-3"])
    assert len(store.frontier) == 3

    # 再次判定：不得回退
    assert store.update_backfill() is False  # 已置位，幂等
    assert store.backfill_complete is True
    # 关键：复查仍可进行（现有实现在此场景下会返回空）
    assert store.next_recheck_sample(2) != []


def test_recheck_sample_rotates_and_wraps() -> None:
    store = StateStore(
        crawled={"/a": {}, "/b": {}, "/c": {}}, backfill_complete=True
    )
    assert store.next_recheck_sample(2) == ["/a", "/b"]
    assert store.next_recheck_sample(2) == ["/c", "/a"]  # 轮转回绕


def test_recheck_sample_returns_empty_when_not_backfilled() -> None:
    store = StateStore(crawled={"/a": {}, "/b": {}})
    assert store.next_recheck_sample(1) == []
    assert store.recheck_idx == 0


def test_recheck_coverage_progresses() -> None:
    store = StateStore(crawled={"/a": {}, "/b": {}}, backfill_complete=True)
    assert store.recheck_coverage == 0.0
    store.next_recheck_sample(1)
    assert store.recheck_coverage == 0.5


def test_recheck_coverage_empty_store() -> None:
    assert StateStore().recheck_coverage == 0.0


# ------------------------------------------------- 与现有状态文件的兼容性

def test_load_legacy_state_file(tmp_path) -> None:
    """兼容现有 xianbao/.crawl-state.json 格式（pending 为 list）。"""
    legacy = {
        "version": 2,
        "target": "https://new.ixbk.net",
        "mode": "crawl",
        "pending": ["/zuankeba/6862513.html"],
        "crawled": {
            "/zuankeba/1.html": {
                "hash": "abc123",
                "local": "zuankeba/1.html",
                "last_check": "2026-09-01T00:00:00+00:00",
            }
        },
        "dead": {"/gone.html": {"permanent": True, "reason": "404"}},
        "category_exhausted": {"zuankeba": True, "xiaodao": True},
        "recheck_idx": 0,
    }
    path = tmp_path / "state.json"
    path.write_text(json.dumps(legacy), encoding="utf-8")

    store = StateStore.load(path)
    assert store.frontier == {"/zuankeba/6862513.html"}
    assert store.crawled["/zuankeba/1.html"].hash == "abc123"
    assert store.crawled["/zuankeba/1.html"].local == "zuankeba/1.html"
    assert store.dead["/gone.html"]["permanent"] is True
    assert store.all_exhausted is True
    # 旧文件缺少新增字段 → 自动补默认值，不丢进度
    assert store.backfill_complete is False
    assert store.backfill_completed_at is None


def test_load_missing_file_returns_empty(tmp_path) -> None:
    store = StateStore.load(tmp_path / "nope.json")
    assert store.frontier == set()
    assert store.crawled == {}
    assert store.path is not None


def test_save_preserves_pending_as_list(tmp_path) -> None:
    """写出格式与现有文件一致（pending 为 list），保证双向互操作。"""
    store = StateStore(path=tmp_path / "state.json")
    store.add_discovered(["/a", "/b"])
    store.save()

    raw = json.loads((tmp_path / "state.json").read_text(encoding="utf-8"))
    assert isinstance(raw["pending"], list)
    assert sorted(raw["pending"]) == ["/a", "/b"]


def test_save_load_roundtrip(tmp_path) -> None:
    path = tmp_path / "state.json"
    store = StateStore(path=path, category_exhausted={"zuankeba": True})
    store.add_discovered(["/x.html"])
    store.mark_crawled("/y.html", "hash-y", "y.html")
    store.save()

    reloaded = StateStore.load(path)
    assert reloaded.frontier == {"/x.html"}
    assert reloaded.crawled["/y.html"].hash == "hash-y"
    assert reloaded.crawled["/y.html"].local == "y.html"
    assert reloaded.category_exhausted == {"zuankeba": True}


def test_backfill_flag_persists(tmp_path) -> None:
    path = tmp_path / "state.json"
    store = StateStore(path=path, category_exhausted={"zuankeba": True})
    store.update_backfill()
    store.save()

    reloaded = StateStore.load(path)
    assert reloaded.backfill_complete is True
    assert reloaded.backfill_completed_at is not None


def test_summary_metrics() -> None:
    store = StateStore(
        crawled={"/a": {}}, dead={"/d": {"reason": "404"}}, backfill_complete=True
    )
    summary = store.summary()
    assert summary["crawled_total"] == 1
    assert summary["dead_total"] == 1
    assert summary["backfill_complete"] is True
    assert summary["frontier_depth"] == 0
    assert "recheck_coverage" in summary


def test_crawl_record_from_any() -> None:
    assert CrawlRecord.from_any(None).hash == ""
    assert CrawlRecord.from_any({"hash": "h", "local": "l"}).local == "l"
    record = CrawlRecord(hash="h")
    assert CrawlRecord.from_any(record) is record
