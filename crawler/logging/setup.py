"""结构化日志层（零第三方依赖）。

替代现有 `render.py` 中 35 处裸 `print`（痛点 P3）。收益：
- **JSON 行输出**：可按 `run_id` / `site` / `url` 聚合检索，排障不再靠肉眼翻屏；
- **上下文绑定**：`bind(run_id=..., site=...)` 一次绑定，调用处无需反复传参；
- **自动脱敏**：token / cookie 等敏感字段统一打码，避免凭据泄漏进日志。

对应架构文档 §5。
"""

from __future__ import annotations

import json
import logging
import sys
import time
from typing import Any

__all__ = ["JsonFormatter", "setup_logging", "get_logger", "bind"]

# 命中这些关键字的字段值会被打码
_SENSITIVE_HINTS = (
    "token", "cookie", "authorization", "password", "secret", "api_key", "apikey",
)

# LogRecord 内置属性，序列化为 JSON 时需排除
_RESERVED = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "getMessage", "message", "asctime", "taskName",
}


def _mask(key: str, value: Any) -> Any:
    """对敏感字段打码。"""
    lowered = str(key).lower()
    if any(hint in lowered for hint in _SENSITIVE_HINTS):
        return "***"
    return value


class JsonFormatter(logging.Formatter):
    """把日志记录渲染为单行 JSON。"""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(record.created)),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        # 附加通过 bind() 绑定的上下文字段
        for key, value in record.__dict__.items():
            if key in _RESERVED or key.startswith("_"):
                continue
            payload[key] = _mask(key, value)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


_DEFAULT_CTX: dict[str, Any] = {}


def setup_logging(
    level: str | int = "INFO",
    *,
    json_output: bool = True,
    stream: Any = None,
    **defaults: Any,
) -> logging.Logger:
    """初始化 crawler 日志器。

    Args:
        level: 日志级别。
        json_output: True 输出 JSON 行；False 输出易读文本。
        stream: 输出流，默认 stderr。
        **defaults: 全局默认上下文字段，如 `run_id=...`、`site=...`。
    """
    logger = logging.getLogger("crawler")
    logger.setLevel(level)
    logger.propagate = False
    for handler in list(logger.handlers):
        logger.removeHandler(handler)

    handler = logging.StreamHandler(stream or sys.stderr)
    if json_output:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-7s %(message)s")
        )
    logger.addHandler(handler)

    _DEFAULT_CTX.clear()
    _DEFAULT_CTX.update(defaults)
    return logger


def get_logger(name: str = "crawler") -> logging.Logger:
    """获取 crawler 命名空间下的日志器。"""
    if name == "crawler" or name.startswith("crawler."):
        return logging.getLogger(name)
    return logging.getLogger(f"crawler.{name}")


class _ContextAdapter(logging.LoggerAdapter):
    """上下文适配器：合并「bind 绑定字段」与「调用处 extra」。

    标准库 `LoggerAdapter.process` 会直接用 `self.extra` **覆盖** `kwargs["extra"]`，
    导致调用处传入的字段被静默丢弃（如 `bind(run_id=..).info("x", extra={"url": ..})`
    中的 url 会消失）。此处改为合并，避免这类隐性丢字段问题。
    """

    def process(self, msg, kwargs):  # type: ignore[override]
        merged = dict(self.extra)
        merged.update(kwargs.get("extra") or {})
        kwargs["extra"] = merged
        return msg, kwargs


def bind(**ctx: Any) -> logging.LoggerAdapter:
    """绑定上下文并返回适配器。

    用法：`bind(run_id=rid, site="xianbao").info("page.rendered", extra={"url": u})`
    两类字段会被合并输出，不会互相覆盖。
    """
    extra = {**_DEFAULT_CTX, **ctx}
    return _ContextAdapter(get_logger(), extra)
