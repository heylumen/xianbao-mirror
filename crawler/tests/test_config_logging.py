"""M1 · 配置层与日志层单元测试（离线、零网络、零新增依赖）。

对应架构文档 §4（统一配置管理）与 §5（统一日志机制）。
"""

from __future__ import annotations

import io
import json

import pytest

from crawler.config.loader import load_config
from crawler.config.schema import Config, ConfigError, GlobalConfig, SiteConfig
from crawler.logging.setup import bind, setup_logging


# ------------------------------------------------------------------ 配置层

def test_default_config_validates() -> None:
    cfg = Config(
        globals=GlobalConfig(), sites={"xianbao": SiteConfig(name="xianbao")}
    ).validate()
    assert cfg.globals.max_pages_per_run == 600
    assert cfg.globals.checkpoint_every == 120
    assert cfg.site("xianbao").fetcher == "playwright"
    assert cfg.site("xianbao").recheck_per_run == 200


def test_load_from_json_file(tmp_path) -> None:
    data = {
        "globals": {"max_pages_per_run": 50},
        "sites": {
            "xianbao": {
                "allowed_categories": ["zuankeba", "xiaodao"],
                "recheck_per_run": 7,
            }
        },
    }
    path = tmp_path / "config.json"
    path.write_text(json.dumps(data), encoding="utf-8")

    cfg = load_config(path)
    assert cfg.globals.max_pages_per_run == 50
    assert cfg.site("xianbao").recheck_per_run == 7
    # list 自动转为 tuple
    assert cfg.site("xianbao").allowed_categories == ("zuankeba", "xiaodao")


def test_env_overrides_file(tmp_path) -> None:
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"globals": {"max_pages_per_run": 50}}), encoding="utf-8")

    cfg = load_config(
        path,
        env={"CRAWL__GLOBAL__MAX_PAGES_PER_RUN": "999"},
        overrides={"sites": {"xianbao": {}}},
    )
    assert cfg.globals.max_pages_per_run == 999


def test_overrides_have_highest_priority(tmp_path) -> None:
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"globals": {"max_pages_per_run": 50}}), encoding="utf-8")

    cfg = load_config(
        path,
        env={"CRAWL__GLOBAL__MAX_PAGES_PER_RUN": "999"},
        overrides={
            "globals": {"max_pages_per_run": 11},
            "sites": {"xianbao": {}},  # 校验要求至少一个站点
        },
    )
    assert cfg.globals.max_pages_per_run == 11


def test_env_type_coercion(tmp_path) -> None:
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"sites": {"xianbao": {}}}), encoding="utf-8")

    cfg = load_config(
        path,
        env={
            "CRAWL__GLOBAL__CONCURRENCY": "8",              # int
            "CRAWL__SITE__XIANBAO__RATE_LIMIT__RESPECT_ROBOTS": "false",  # bool
            "CRAWL__SITE__XIANBAO__RATE_LIMIT__REQUESTS_PER_SECOND": "1.5",  # float
            "CRAWL__SITE__XIANBAO__FETCHER": "httpx",       # str
        },
    )
    assert cfg.globals.concurrency == 8
    site = cfg.site("xianbao")
    assert site.rate_limit.respect_robots is False
    assert site.rate_limit.requests_per_second == 1.5
    assert site.fetcher == "httpx"


@pytest.mark.parametrize(
    "payload",
    [
        {"globals": {"max_pages_per_run": -1}},      # 负值
        {"globals": {"concurrency": 0}},             # 零
        {"globals": {"log_level": "TRACE"}},         # 非法级别
        {"sites": {"xianbao": {"fetcher": "selenium"}}},  # 非法下载器
    ],
)
def test_invalid_values_raise(tmp_path, payload) -> None:
    path = tmp_path / "config.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ConfigError):
        load_config(path, env={})


def test_unknown_key_raises(tmp_path) -> None:
    """拼写错误的配置项必须报错，而不是被静默忽略。"""
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"globals": {"max_page_per_run": 10}}), encoding="utf-8")
    with pytest.raises(ConfigError):
        load_config(path, env={})


def test_missing_sites_raises(tmp_path) -> None:
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"globals": {}}), encoding="utf-8")
    with pytest.raises(ConfigError):
        load_config(path, env={})


def test_missing_config_file_raises(tmp_path) -> None:
    with pytest.raises(ConfigError):
        load_config(tmp_path / "nope.json", env={})


# ------------------------------------------------------------------ 日志层

def test_json_logging_includes_bound_context() -> None:
    stream = io.StringIO()
    setup_logging("INFO", stream=stream)

    bind(run_id="r1", site="xianbao").info("page.rendered", extra={"url": "/a.html"})

    payload = json.loads(stream.getvalue().strip())
    assert payload["level"] == "INFO"
    assert payload["event"] == "page.rendered"
    assert payload["run_id"] == "r1"
    assert payload["site"] == "xianbao"
    assert payload["url"] == "/a.html"
    assert "ts" in payload


def test_logging_masks_sensitive_fields() -> None:
    stream = io.StringIO()
    setup_logging("INFO", stream=stream)

    bind(token="secret-value", cookie="sid=1", url="/a.html").info("fetched")

    payload = json.loads(stream.getvalue().strip())
    assert payload["token"] == "***"
    assert payload["cookie"] == "***"
    assert payload["url"] == "/a.html"  # 非敏感字段保持原样


def test_setup_logging_defaults_context() -> None:
    stream = io.StringIO()
    setup_logging("INFO", stream=stream, run_id="global-run")

    bind().info("started")

    payload = json.loads(stream.getvalue().strip())
    assert payload["run_id"] == "global-run"


def test_text_logging_mode() -> None:
    stream = io.StringIO()
    setup_logging("INFO", stream=stream, json_output=False)
    bind(run_id="r1").info("plain text event")
    assert "plain text event" in stream.getvalue()
