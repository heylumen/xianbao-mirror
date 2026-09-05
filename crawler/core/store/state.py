"""爬取状态存储（架构文档 §7.2 / §7.4）。

★ 核心修正（痛点 P10）：把「回填完成」与「源站持续更新」解耦。

现有 `render.py:2474` 的判定：
```python
if all(category_exhausted) and not pending:
    mode = "maintenance"; completed_at = now()
```
问题：源站持续发布新帖（9/4 实测 ≈400 篇/天），每轮抓分类第 1 页都会把新帖补进
`pending`，使 `not pending` **永不成立** → `completed_at` 恒为 `None`、
`recheck_idx` 恒为 0 → maintenance 抽样复查从未启动，
28632 篇存量文章的新评论 / 内容更新从未同步。

修正：引入**一次性标记** `backfill_complete`：
```python
if all_exhausted and not frontier:
    backfill_complete = True      # 置位后永不回退，不受后续新帖影响
if backfill_complete:             # 复查与增量并行、互不阻塞
    run_recheck_sample(...)
```

兼容性（§7.4）：可直接载入现有 `xianbao/.crawl-state.json`，
`pending(list)` / `crawled(dict)` / `dead(dict)` / `category_exhausted(dict)` /
`recheck_idx` 语义全部保留，仅新增 `backfill_complete` / `backfill_completed_at`，
旧文件自动补默认值 —— **无需重建状态、不丢进度**。
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping

from .dedup import normalize_url

__all__ = ["CrawlRecord", "StateStore"]

SCHEMA_VERSION = 2


def _now() -> str:
    """UTC 时间戳（与现有状态文件格式一致）。"""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class CrawlRecord:
    """单页爬取记录。"""

    hash: str = ""            # 内容指纹（sha256）
    local: str = ""           # 本地落盘相对路径
    last_check: str = ""      # 最近一次抓取/复查时间
    simhash: int = 0          # 正文近重复指纹（可选）

    @classmethod
    def from_any(cls, value: Any) -> "CrawlRecord":
        """兼容现有格式：`crawled[path]` 为 dict 时按字段解析。"""
        if isinstance(value, CrawlRecord):
            return value
        if isinstance(value, Mapping):
            return cls(
                hash=str(value.get("hash", "") or ""),
                local=str(value.get("local", "") or ""),
                last_check=str(value.get("last_check", "") or ""),
                simhash=int(value.get("simhash", 0) or 0),
            )
        return cls()


class StateStore:
    """frontier / crawled / dead 状态机与持久化。"""

    def __init__(
        self,
        path: str | Path | None = None,
        *,
        frontier: Iterable[str] = (),
        crawled: Mapping[str, Any] | None = None,
        dead: Mapping[str, Any] | None = None,
        category_exhausted: Mapping[str, bool] | None = None,
        category_miss: Mapping[str, int] | None = None,
        category_cursor: Mapping[str, int] | None = None,
        recheck_idx: int = 0,
        backfill_complete: bool = False,
        backfill_completed_at: str | None = None,
        stats: Mapping[str, Any] | None = None,
        mode: str = "crawl",
        completed_at: str | None = None,
        target: str = "",
        allowed_categories: Iterable[str] = (),
    ) -> None:
        self.path = Path(path) if path else None
        self.frontier: set[str] = set(frontier or ())
        self.crawled: dict[str, CrawlRecord] = {
            k: CrawlRecord.from_any(v) for k, v in (crawled or {}).items()
        }
        self.dead: dict[str, dict[str, Any]] = {
            k: dict(v) if isinstance(v, Mapping) else {"reason": str(v)}
            for k, v in (dead or {}).items()
        }
        self.category_exhausted: dict[str, bool] = dict(category_exhausted or {})
        self.category_miss: dict[str, int] = dict(category_miss or {})
        self.category_cursor: dict[str, int] = dict(category_cursor or {})
        self.recheck_idx = int(recheck_idx or 0)
        self.backfill_complete = bool(backfill_complete)
        self.backfill_completed_at = backfill_completed_at
        self.stats: dict[str, Any] = dict(stats or {})
        # 与现有状态文件保持互操作的字段
        self.mode = mode
        self.completed_at = completed_at
        self.target = target
        self.allowed_categories = list(allowed_categories or ())

    # ---------------------------------------------------------------- 持久化

    @classmethod
    def load(cls, path: str | Path) -> "StateStore":
        """从 JSON 状态文件载入；文件不存在则返回空状态。

        兼容现有 `xianbao/.crawl-state.json`：`pending` 为 list，`crawled` 为 dict。
        """
        file_path = Path(path)
        if not file_path.is_file():
            return cls(path=file_path)

        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ValueError(f"状态文件解析失败：{file_path}（{exc}）") from exc
        if not isinstance(data, dict):
            raise ValueError(f"状态文件顶层必须是对象：{file_path}")

        return cls(
            path=file_path,
            frontier=data.get("pending", []) or [],
            crawled=data.get("crawled", {}) or {},
            dead=data.get("dead", {}) or {},
            category_exhausted=data.get("category_exhausted", {}) or {},
            category_miss=data.get("category_miss", {}) or {},
            category_cursor=data.get("category_cursor", {}) or {},
            recheck_idx=data.get("recheck_idx", 0) or 0,
            # 新增字段：旧文件缺失时自动补默认值，不丢进度
            backfill_complete=bool(data.get("backfill_complete", False)),
            backfill_completed_at=data.get("backfill_completed_at"),
            stats=data.get("stats", {}) or {},
            mode=data.get("mode", "crawl"),
            completed_at=data.get("completed_at"),
            target=data.get("target", ""),
            allowed_categories=data.get("allowed_categories", []) or [],
        )

    def save(self, path: str | Path | None = None) -> Path:
        """持久化到 JSON。`pending` 以 list 写出，与现有格式保持一致。"""
        target_path = Path(path) if path else self.path
        if target_path is None:
            raise ValueError("未提供保存路径")

        payload = {
            "version": SCHEMA_VERSION,
            "target": self.target,
            "allowed_categories": self.allowed_categories,
            "mode": self.mode,
            "category_cursor": self.category_cursor,
            "category_exhausted": self.category_exhausted,
            "category_miss": self.category_miss,
            "pending": sorted(self.frontier),
            "crawled": {k: asdict(v) for k, v in self.crawled.items()},
            "dead": self.dead,
            "recheck_idx": self.recheck_idx,
            "stats": self.stats,
            # ★ P10 修正字段
            "backfill_complete": self.backfill_complete,
            "backfill_completed_at": self.backfill_completed_at,
            "completed_at": self.completed_at,
        }

        target_path.parent.mkdir(parents=True, exist_ok=True)
        # 原子写：先写临时文件再替换，避免中断产生半截文件导致进度丢失
        tmp_path = target_path.with_suffix(target_path.suffix + ".tmp")
        tmp_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        tmp_path.replace(target_path)
        return target_path

    # ------------------------------------------------------------------ 队列

    def add_discovered(self, urls: Iterable[str]) -> int:
        """把新发现的 URL 加入 frontier，返回实际新增数量。

        已抓取 / 已判定死链 / 已在队列的 URL 会被自动跳过（去重）。
        """
        added = 0
        for raw in urls:
            if not raw:
                continue
            path = normalize_url(raw)
            if not path:
                continue
            if path in self.crawled or path in self.dead or path in self.frontier:
                continue
            self.frontier.add(path)
            added += 1
        return added

    def next_batch(self, size: int) -> list[str]:
        """取出下一批待抓 URL（并从 frontier 移除）。"""
        if size <= 0 or not self.frontier:
            return []
        batch = sorted(self.frontier)[:size]
        self.frontier.difference_update(batch)
        return batch

    def mark_crawled(
        self, path: str, content_hash: str, local: str = "", *, simhash: int = 0
    ) -> None:
        """标记页面已抓取。"""
        record = self.crawled.setdefault(path, CrawlRecord())
        record.hash = content_hash
        record.local = local or record.local
        record.last_check = _now()
        if simhash:
            record.simhash = simhash

    def mark_dead(self, path: str, reason: str, *, permanent: bool = True) -> None:
        """标记失效页。permanent=True 表示不再重试（现有语义）。"""
        self.dead[path] = {
            "reason": reason,
            "permanent": bool(permanent),
            "at": _now(),
        }
        self.frontier.discard(path)

    # ------------------------------------------------- ★ P10 修正：回填完成

    @property
    def all_exhausted(self) -> bool:
        """所有分类是否均已翻到底。分类表为空时视为未完成（保守）。"""
        if not self.category_exhausted:
            return False
        return all(self.category_exhausted.values())

    def update_backfill(self, all_exhausted: bool | None = None) -> bool:
        """判定回填是否完成（**一次性**，置位后永不回退）。

        这是 P10 的核心修正：判定只依赖「列表已翻完 + frontier 当前为空」，
        一旦置位就不再受后续新帖影响，从而让 maintenance 复查能够真正启动。

        Returns:
            本次调用是否**刚刚**把 `backfill_complete` 置为 True。
        """
        if self.backfill_complete:
            return False  # 已置位，幂等
        exhausted = self.all_exhausted if all_exhausted is None else all_exhausted
        if exhausted and not self.frontier:
            self.backfill_complete = True
            self.backfill_completed_at = _now()
            return True
        return False

    def next_recheck_sample(self, size: int) -> list[str]:
        """取下一批复查样本（轮转推进 `recheck_idx`）。

        ★ P10 修正：仅当 `backfill_complete` 为真才返回样本；
        回填未完成时返回空列表，避免复查与回填抢占单轮配额。
        """
        if not self.backfill_complete or size <= 0:
            return []
        paths = sorted(self.crawled)  # 排序保证轮转确定性
        if not paths:
            return []
        start = self.recheck_idx % len(paths)
        sample = paths[start:start + size]
        if len(sample) < size:
            sample += paths[: size - len(sample)]
        self.recheck_idx = (start + size) % len(paths)
        return sample

    @property
    def recheck_coverage(self) -> float:
        """复查轮转覆盖率（0.0–1.0），用于监控「复查是否真的在推进」。"""
        if not self.crawled:
            return 0.0
        return min(1.0, self.recheck_idx / len(self.crawled))

    # ------------------------------------------------------------------ 指标

    def summary(self) -> dict[str, Any]:
        """健康度快照，供监控与日志使用。"""
        return {
            "frontier_depth": len(self.frontier),
            "crawled_total": len(self.crawled),
            "dead_total": len(self.dead),
            "backfill_complete": self.backfill_complete,
            "backfill_completed_at": self.backfill_completed_at,
            "recheck_idx": self.recheck_idx,
            "recheck_coverage": round(self.recheck_coverage, 4),
            "mode": self.mode,
        }
