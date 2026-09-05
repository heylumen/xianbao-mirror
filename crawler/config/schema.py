"""配置模型层。

设计约束（来自项目部署记忆）：
- **零新增依赖**：现有 requirements 仅含 playwright / beautifulsoup4 / pytest / qrcode / pillow，
  引入 pydantic 或 PyYAML 会改变 CI 安装与运行环境，故全部用标准库 `dataclasses` 实现。
- **fail-fast**：校验在加载阶段完成，避免运行中途才因配置错误崩溃。
- 对应架构文档 §4（统一配置管理）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping

__all__ = [
    "ConfigError",
    "RateLimitConfig",
    "RetryConfig",
    "AntiCrawlConfig",
    "GlobalConfig",
    "SiteConfig",
    "Config",
]


class ConfigError(ValueError):
    """配置校验失败（加载阶段抛出，便于 fail-fast）。"""


def _check_positive(name: str, value: Any) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ConfigError(f"{name} 必须为正整数，当前={value!r}")


def _check_non_negative(name: str, value: Any) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ConfigError(f"{name} 必须为非负整数，当前={value!r}")


def _check_range(name: str, value: Any, low: float, high: float) -> None:
    if not isinstance(value, (int, float)) or not (low <= float(value) <= high):
        raise ConfigError(f"{name} 必须落在 [{low}, {high}]，当前={value!r}")


@dataclass
class RateLimitConfig:
    """限流参数：每域独立令牌桶（架构文档 §6.3）。"""

    requests_per_second: float = 2.0
    burst: int = 5
    respect_robots: bool = True
    jitter_ms: int = 0  # 请求节律随机抖动上限（毫秒），0 表示关闭

    def validate(self) -> "RateLimitConfig":
        _check_range("rate_limit.requests_per_second", self.requests_per_second, 0.01, 1000.0)
        _check_positive("rate_limit.burst", self.burst)
        _check_non_negative("rate_limit.jitter_ms", self.jitter_ms)
        return self


@dataclass
class RetryConfig:
    """重试策略（架构文档 §6.2）。

    修正现有实现的不足（P4）：区分「可重试」与「永久死链」，
    404/410 直接标记 dead，不再浪费重试次数，也避免被误判为待补页。
    """

    max_attempts: int = 5
    base_delay_ms: int = 500
    max_delay_ms: int = 30_000
    retry_statuses: tuple[int, ...] = (429, 500, 502, 503, 504)
    dead_statuses: tuple[int, ...] = (404, 410)

    def validate(self) -> "RetryConfig":
        _check_positive("retry.max_attempts", self.max_attempts)
        _check_positive("retry.base_delay_ms", self.base_delay_ms)
        _check_positive("retry.max_delay_ms", self.max_delay_ms)
        if self.max_delay_ms < self.base_delay_ms:
            raise ConfigError("retry.max_delay_ms 不得小于 base_delay_ms")
        return self


@dataclass
class AntiCrawlConfig:
    """反爬策略（架构文档 §6.4）。默认关闭代理池，按需开启。"""

    user_agents: tuple[str, ...] = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    )
    rotate_ua: bool = True
    stealth_js_enabled: bool = True
    proxies: tuple[str, ...] = ()
    proxy_failure_threshold: float = 0.5  # 单个代理失败率超过此值则切换

    def validate(self) -> "AntiCrawlConfig":
        if not self.user_agents:
            raise ConfigError("anti.user_agents 不可为空")
        _check_range("anti.proxy_failure_threshold", self.proxy_failure_threshold, 0.0, 1.0)
        return self


@dataclass
class GlobalConfig:
    """全局运行参数。默认值与现有 render.py 保持一致，确保行为兼容。"""

    max_pages_per_run: int = 600
    checkpoint_every: int = 120  # 0 表示关闭检查点
    crawl_delay_ms: int = 200
    concurrency: int = 4
    run_timeout_seconds: int = 6 * 3600  # 单轮超时兜底，对应 CI timeout-minutes:360
    state_backend: str = "json"
    log_level: str = "INFO"
    log_json: bool = True

    def validate(self) -> "GlobalConfig":
        _check_positive("globals.max_pages_per_run", self.max_pages_per_run)
        _check_non_negative("globals.checkpoint_every", self.checkpoint_every)
        _check_non_negative("globals.crawl_delay_ms", self.crawl_delay_ms)
        _check_positive("globals.concurrency", self.concurrency)
        _check_positive("globals.run_timeout_seconds", self.run_timeout_seconds)
        if self.state_backend not in ("json", "sqlite"):
            raise ConfigError(f"不支持的 state_backend={self.state_backend!r}")
        if self.log_level not in ("DEBUG", "INFO", "WARNING", "ERROR"):
            raise ConfigError(f"不支持的 log_level={self.log_level!r}")
        return self


@dataclass
class SiteConfig:
    """单站点配置。多站点时每个站点一份，互不影响。"""

    name: str = "default"
    start_urls: tuple[str, ...] = ()
    allowed_categories: tuple[str, ...] = ()
    fetcher: str = "playwright"  # playwright | httpx
    recheck_per_run: int = 200
    adapter: str = ""
    rate_limit: RateLimitConfig = field(default_factory=RateLimitConfig)
    retry: RetryConfig = field(default_factory=RetryConfig)
    anti: AntiCrawlConfig = field(default_factory=AntiCrawlConfig)

    def validate(self) -> "SiteConfig":
        if not self.name:
            raise ConfigError("site.name 不可为空")
        if self.fetcher not in ("playwright", "httpx"):
            raise ConfigError(f"不支持的 fetcher={self.fetcher!r}")
        _check_non_negative("site.recheck_per_run", self.recheck_per_run)
        self.rate_limit.validate()
        self.retry.validate()
        self.anti.validate()
        return self


@dataclass
class Config:
    """顶层配置对象：一份全局参数 + 若干站点配置。"""

    globals: GlobalConfig = field(default_factory=GlobalConfig)
    sites: dict[str, SiteConfig] = field(default_factory=dict)

    def validate(self) -> "Config":
        self.globals.validate()
        if not self.sites:
            raise ConfigError("至少需要一个站点配置")
        for name, site in self.sites.items():
            if site.name and site.name != name:
                raise ConfigError(f"站点键名 {name!r} 与内部 name {site.name!r} 不一致")
            site.name = site.name or name
            site.validate()
        return self

    def site(self, name: str) -> SiteConfig:
        try:
            return self.sites[name]
        except KeyError:
            raise ConfigError(f"未找到站点 {name!r}，可用：{sorted(self.sites)}") from None


def _filter_keys(mapping: Mapping[str, Any], known: Iterable[str]) -> dict[str, Any]:
    """按已知字段名过滤字典，忽略未知键（保持向后兼容）。"""
    allowed = set(known)
    return {k: v for k, v in mapping.items() if k in allowed}
