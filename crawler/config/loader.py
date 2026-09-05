"""配置加载：三层合并（默认值 < JSON 文件 < 环境变量 < 显式覆盖），统一校验。

对应架构文档 §4。设计约束：
- **零新增依赖**：不引入 PyYAML，配置文件用 JSON（标准库即可解析）。
- **fail-fast**：加载阶段完成全部校验，非法配置立即报错而非运行中途崩溃。
- 环境变量采用 `CRAWL__GLOBAL__<字段>` / `CRAWL__SITE__<站点>__<字段>` 命名，
  便于 CI 按步骤注入调参（注意：CI 中只能放**步骤级** env，避免污染单元测试步骤）。
"""

from __future__ import annotations

import json
import os
from dataclasses import fields, is_dataclass
from pathlib import Path
from typing import Any, Mapping, get_type_hints

from .schema import (
    AntiCrawlConfig,
    Config,
    ConfigError,
    GlobalConfig,
    RateLimitConfig,
    RetryConfig,
    SiteConfig,
)

__all__ = ["load_config", "ENV_PREFIX"]

ENV_PREFIX = "CRAWL__"

# 环境变量段名别名：允许 `CRAWL__GLOBAL__X` / `CRAWL__SITE__<站点>__X` 写法，
# 内部统一归一化为 `globals` / `sites`，与配置文件键名保持一致。
_SEGMENT_ALIASES = {"global": "globals", "site": "sites"}


def _coerce_scalar(raw: str) -> Any:
    """把环境变量字符串推断为合适的 Python 类型。"""
    text = raw.strip()
    low = text.lower()
    if low in ("true", "false"):
        return low == "true"
    if low in ("null", "none", ""):
        return None
    try:
        return int(text)
    except ValueError:
        pass
    try:
        return float(text)
    except ValueError:
        pass
    return text


def _coerce_value(annotation: Any, value: Any) -> Any:
    """按目标类型注解转换：dict→嵌套 dataclass，list→tuple，其余原样。"""
    if value is None:
        return None
    if is_dataclass(annotation) and isinstance(value, Mapping):
        return _build(annotation, value)
    # 处理 tuple[int, ...] / tuple[str, ...] 等
    origin = getattr(annotation, "__origin__", None)
    if origin is tuple and isinstance(value, (list, tuple)):
        return tuple(value)
    if annotation is float and isinstance(value, int) and not isinstance(value, bool):
        return float(value)
    return value


def _build(cls: Any, data: Mapping[str, Any]) -> Any:
    """按 dataclass 字段递归构造；遇到未知键立即报错（防止拼写错误被静默忽略）。"""
    if not is_dataclass(cls):
        return data
    hints = get_type_hints(cls)
    known = {f.name for f in fields(cls)}
    kwargs: dict[str, Any] = {}
    for key, value in (data or {}).items():
        if key not in known:
            raise ConfigError(
                f"未知配置项 {cls.__name__}.{key}（可用项：{sorted(known)}）"
            )
        kwargs[key] = _coerce_value(hints.get(key, Any), value)
    return cls(**kwargs)


def _assign_path(root: dict[str, Any], parts: list[str], value: Any) -> None:
    """把 `['sites','xianbao','recheck_per_run']` 形式的路径写入嵌套字典。"""
    node = root
    for part in parts[:-1]:
        node = node.setdefault(part, {})
        if not isinstance(node, dict):
            raise ConfigError(f"配置项路径冲突：{'.'.join(parts)}")
    node[parts[-1]] = value


def _collect_env(env: Mapping[str, str]) -> dict[str, Any]:
    """收集并解析 `CRAWL__*` 环境变量为嵌套字典。"""
    collected: dict[str, Any] = {}
    for raw_key, raw_value in env.items():
        if not raw_key.startswith(ENV_PREFIX):
            continue
        parts = [p.lower() for p in raw_key[len(ENV_PREFIX):].split("__") if p]
        if not parts:
            continue
        # 归一化段名：global -> globals，site -> sites
        parts = [_SEGMENT_ALIASES.get(p, p) for p in parts]
        _assign_path(collected, parts, _coerce_scalar(raw_value))
    return collected


def _deep_merge(base: Mapping[str, Any], override: Mapping[str, Any]) -> dict[str, Any]:
    """深度合并，override 优先；两者都是 dict 时递归，否则直接覆盖。"""
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, Mapping) and isinstance(merged.get(key), Mapping):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_config(
    config_path: str | Path | None = None,
    *,
    env: Mapping[str, str] | None = None,
    overrides: Mapping[str, Any] | None = None,
) -> Config:
    """加载配置。优先级：默认值 < config_path < 环境变量 < overrides。

    Args:
        config_path: JSON 配置文件路径，可为 None（全部使用默认值）。
        env: 环境变量映射，默认取 `os.environ`。
        overrides: 显式覆盖（供 CLI 参数使用），优先级最高。
    """
    data: dict[str, Any] = {}

    if config_path is not None:
        path = Path(config_path)
        if not path.is_file():
            raise ConfigError(f"配置文件不存在：{path}")
        try:
            file_data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ConfigError(f"配置文件 JSON 解析失败：{path}（{exc}）") from exc
        if not isinstance(file_data, dict):
            raise ConfigError(f"配置文件顶层必须是对象：{path}")
        data = _deep_merge(data, file_data)

    data = _deep_merge(data, _collect_env(env if env is not None else os.environ))
    if overrides:
        data = _deep_merge(data, overrides)

    globals_cfg = _build(GlobalConfig, data.get("globals", {}))
    sites_raw = data.get("sites", {})
    if not isinstance(sites_raw, Mapping):
        raise ConfigError("sites 必须是对象")
    sites = {
        name: _build(SiteConfig, {**value, "name": value.get("name", name)})
        for name, value in sites_raw.items()
        if isinstance(value, Mapping)
    }

    return Config(globals=globals_cfg, sites=sites).validate()
