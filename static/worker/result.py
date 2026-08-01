"""JSON-safe result helpers for the PythonShell Pyodide worker."""

from __future__ import annotations

import traceback
from typing import Any, Optional


MAX_TRACEBACK_CHARS = 8000
MAX_MESSAGE_CHARS = 2000


def truncate(text: Optional[str], limit: int) -> str:
    if not text:
        return ""
    text = str(text)
    if len(text) <= limit:
        return text
    return text[: limit - 20] + "\n... [truncated]"


def sanitize_traceback(tb: str) -> str:
    """Keep learner .py frames; drop result/runpy/<exec> and stdlib frames."""
    if not tb:
        return ""
    lines = tb.splitlines()
    out: list[str] = []
    keep_block = False
    kept_learner_frame = False
    for line in lines:
        if line.startswith("Traceback"):
            out.append(line)
            keep_block = False
            continue
        if line.startswith("  File "):
            skip = (
                "result.py" in line
                or "runpy.py" in line
                or "<exec>" in line
                or "/lib/" in line
                or "site-packages" in line
            )
            keep_block = (".py" in line) and not skip
            if keep_block:
                kept_learner_frame = True
                out.append(line)
            continue
        if keep_block:
            out.append(line)
            continue
        if line and not line.startswith(" "):
            out.append(line)
    if not kept_learner_frame:
        return tb
    return "\n".join(out)


def format_exception(exc: BaseException) -> dict[str, str]:
    """Return a sanitized exception payload for the browser."""
    tb = "".join(
        traceback.format_exception(type(exc), exc, exc.__traceback__)
    )
    tb = sanitize_traceback(tb)
    return {
        "type": type(exc).__name__,
        "message": truncate(str(exc), MAX_MESSAGE_CHARS),
        "traceback": truncate(tb, MAX_TRACEBACK_CHARS),
    }


def safe_str(value: Any, limit: int = MAX_MESSAGE_CHARS) -> str:
    try:
        return truncate("" if value is None else str(value), limit)
    except Exception:
        return "<unprintable>"
