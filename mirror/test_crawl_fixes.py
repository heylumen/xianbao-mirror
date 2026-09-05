"""针对本轮代码审查修复项的回归测试。

覆盖：
  - H1  drain_frontier 渲染失败时回填 pending（原逻辑会把文章永久丢弃）
  - H3  源站 5xx 不再被当作正常页面渲染入库
  - H4  导航失败返回 reason="network"，供调用方区分「临时故障」与「已抓完」
  - M3  load_state 对 stats 采用合并而非整体覆盖
  - 兼容性  render_page 仍返回 3 元组
"""
import json

import render


def test_drain_frontier_requeues_failed_path(monkeypatch):
    """H1：首次渲染失败应回填 pending，避免文章永久丢失。"""
    monkeypatch.setattr(render, "CRAWL_DELAY_MS", 0)
    state = {"pending": {"/zuankeba/1.html"}, "crawled": {}, "dead": {}}
    monkeypatch.setattr(render, "render_page",
                        lambda *a, **k: (False, None, None))
    render.drain_frontier(None, {}, lambda *a: None, state, [0])
    # 原逻辑下该 path 已从 pending 移除、又未入 crawled/dead → 永久丢失
    assert "/zuankeba/1.html" in state["pending"], state
    assert state["pending_fails"]["/zuankeba/1.html"] == 1, state


def test_drain_frontier_gives_up_after_dead_fail_limit(monkeypatch, tmp_path):
    """H1：失败累计达 DEAD_FAIL_LIMIT 后转 dead，避免无限回填占用 pending。

    转 dead 会使 pending 得以清空，回填完成判定（依赖 pending 为空）才能置位。
    """
    monkeypatch.setattr(render, "CRAWL_DELAY_MS", 0)
    monkeypatch.setattr(render, "DEAD_FAIL_LIMIT", 2)
    # 把 OUT_DIR 指向临时目录，避免 _tombstone 真的去复制镜像产物
    monkeypatch.setattr(render, "OUT_DIR", tmp_path)
    state = {"pending": {"/zuankeba/1.html"}, "crawled": {}, "dead": {},
             "pending_fails": {"/zuankeba/1.html": 1}}
    monkeypatch.setattr(render, "render_page",
                        lambda *a, **k: (False, None, None))
    render.drain_frontier(None, {}, lambda *a: None, state, [0])
    assert "/zuankeba/1.html" in state["dead"], state
    assert "/zuankeba/1.html" not in state["pending"], state


def test_drain_frontier_clears_fail_count_on_success(monkeypatch):
    """H1：抓取成功后应清除该 path 的历史失败计数。"""
    monkeypatch.setattr(render, "CRAWL_DELAY_MS", 0)
    state = {"pending": {"/zuankeba/1.html"}, "crawled": {}, "dead": {},
             "pending_fails": {"/zuankeba/1.html": 1}}
    monkeypatch.setattr(render, "render_page",
                        lambda *a, **k: (True, "<html></html>", "<html></html>"))
    render.drain_frontier(None, {}, lambda *a: None, state, [0])
    assert "/zuankeba/1.html" not in state.get("pending_fails", {}), state


def test_render_page_ex_server_error_not_stored(monkeypatch):
    """H3：5xx 重试耗尽后返回 server_error，错误页不得作为内容返回。"""
    monkeypatch.setattr(render.time, "sleep", lambda s: None)

    class Resp:
        status = 500

    class Page:
        def goto(self, url, wait_until=None, timeout=None):
            return Resp()

    ok, rendered, raw, reason = render.render_page_ex(
        Page(), "https://x/a.html", "/a.html", {}, {"dead": {}})
    assert ok is False
    assert reason == "server_error"
    assert rendered is None      # 关键：不得把 5xx 错误页当正文返回


def test_render_page_ex_network_reason(monkeypatch):
    """H4：导航异常返回 reason="network"，调用方据此不判定「已抓完」。"""
    monkeypatch.setattr(render.time, "sleep", lambda s: None)

    class Page:
        def goto(self, url, wait_until=None, timeout=None):
            raise RuntimeError("boom")

    ok, rendered, raw, reason = render.render_page_ex(
        Page(), "https://x/a.html", "/a.html", {}, {"dead": {}})
    assert ok is False
    assert reason == "network"


def test_render_page_ex_dead_reason(monkeypatch):
    """404/410 返回 reason="dead" 并记入 state.dead。"""
    monkeypatch.setattr(render.time, "sleep", lambda s: None)

    class Resp:
        status = 404

    class Page:
        def goto(self, url, wait_until=None, timeout=None):
            return Resp()

    state = {"dead": {}}
    ok, rendered, raw, reason = render.render_page_ex(
        Page(), "https://x/a.html", "/a.html", {}, state)
    assert ok is False
    assert reason == "dead"
    assert "/a.html" in state["dead"]


def test_render_page_wrapper_keeps_three_tuple(monkeypatch):
    """兼容封装：render_page 仍返回 3 元组，既有调用点与测试签名不受影响。"""
    monkeypatch.setattr(
        render, "render_page_ex",
        lambda page, url, path, raw_docs, state=None: (
            True, "<p>x</p>", "<p>x</p>", "ok"))
    out = render.render_page(None, "https://x/a.html", "/a.html", {}, {})
    assert isinstance(out, tuple) and len(out) == 3
    assert out[0] is True and out[1] == "<p>x</p>"


def test_load_state_merges_stats(tmp_path):
    """M3：旧状态缺新增计数字段时应补全，避免 save_page 触发 KeyError。"""
    p = tmp_path / "state.json"
    p.write_text(json.dumps(
        {"stats": {"pages": 5, "articles": 3, "rechecks": 1}}), encoding="utf-8")
    st = render.load_state(p)
    assert st["stats"]["pages"] == 5        # 已有值保留
    assert st["stats"]["updated"] == 0      # 缺失字段补全
