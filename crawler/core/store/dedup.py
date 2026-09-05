"""去重与内容指纹（架构文档 §7.1）。

三层去重：
1. **URL 归一化**：去 fragment、规范大小写与默认端口、统一 trailing slash、
   过滤无关查询参数 —— 作为 frontier 主键，避免同一页面被重复入队。
2. **sha256 全文档指纹**：精确去重，检测内容是否发生变化。
3. **simhash 正文指纹**：近重复检测（中文按 2-gram 切分），识别改标题/插广告的重复页。

零第三方依赖：simhash 为标准库实现（不引入 simhash 包）。
"""

from __future__ import annotations

import hashlib
import re
from typing import Iterable
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

__all__ = [
    "normalize_url",
    "content_sha256",
    "tokenize",
    "simhash",
    "hamming_distance",
    "is_near_duplicate",
]

# 归一化时默认丢弃的查询参数（分页与主内容无关的参数会制造大量伪重复 URL）
_DEFAULT_KEEP_QUERY = ("page", "p", "id")

_WORD_RE = re.compile(r"[a-zA-Z0-9]+")
_CJK_RE = re.compile(r"[\u4e00-\u9fff]")


def normalize_url(url: str, *, keep_query: Iterable[str] = _DEFAULT_KEEP_QUERY) -> str:
    """归一化 URL，返回可作为去重主键的规范形式。

    - scheme / host 统一小写，去掉 80/443 默认端口；
    - 去掉 fragment；
    - 路径去掉多余结尾斜杠（根路径 `/` 保留）；
    - 查询参数按键排序，且仅保留 `keep_query` 中列出的键。
    """
    if not url:
        return ""
    parts = urlsplit(url.strip())

    path = parts.path or "/"
    if len(path) > 1:
        path = path.rstrip("/") or "/"

    allowed = set(keep_query)
    query_pairs = [
        (k, v)
        for k, v in sorted(parse_qsl(parts.query, keep_blank_values=True))
        if k in allowed
    ]
    query = urlencode(query_pairs)

    # 站内相对路径（如 /zuankeba/6862513.html）保持相对形态：
    # 现有 xianbao/.crawl-state.json 的 pending / crawled 键均为此格式，
    # 若强行补全 scheme/host 会破坏与既有状态文件的互操作。
    if not parts.scheme and not parts.netloc:
        return urlunsplit(("", "", path, query, ""))

    scheme = (parts.scheme or "https").lower()
    netloc = parts.netloc.lower()
    # 去掉默认端口
    for default_port in (":80", ":443"):
        if netloc.endswith(default_port):
            netloc = netloc[: -len(default_port)]
            break

    return urlunsplit((scheme, netloc, path, query, ""))


def content_sha256(text: str) -> str:
    """计算文本内容的 sha256 指纹（精确去重 / 变更检测）。"""
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


def tokenize(text: str) -> list[str]:
    """切词：英文数字按词切分，中文按 2-gram 切分（无第三方分词依赖）。"""
    if not text:
        return []
    lowered = text.lower()
    tokens = list(_WORD_RE.findall(lowered))

    cjk_chars = _CJK_RE.findall(lowered)
    # 中文 2-gram：'abcd' -> ['ab','bc','cd']
    tokens.extend("".join(cjk_chars[i:i + 2]) for i in range(len(cjk_chars) - 1))
    if len(cjk_chars) == 1:
        tokens.append(cjk_chars[0])
    return tokens


def simhash(text: str, *, bits: int = 64) -> int:
    """计算文本 simhash 指纹（近重复检测）。

    实现：每个 token 取 sha256 前 64 位作为向量方向，按位加权累加后符号化。
    """
    tokens = tokenize(text)
    if not tokens:
        return 0

    vector = [0] * bits
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8", errors="replace")).digest()
        # 取前 8 字节作为 64 位哈希
        value = int.from_bytes(digest[:8], "big")
        for i in range(bits):
            if value >> i & 1:
                vector[i] += 1
            else:
                vector[i] -= 1

    fingerprint = 0
    for i in range(bits):
        if vector[i] > 0:
            fingerprint |= 1 << i
    return fingerprint


def hamming_distance(left: int, right: int) -> int:
    """两个指纹的汉明距离。"""
    return bin(left ^ right).count("1")


def is_near_duplicate(left: int, right: int, *, threshold: int = 3) -> bool:
    """判断两个 simhash 指纹是否近重复（距离 ≤ 阈值）。"""
    return hamming_distance(left, right) <= threshold
