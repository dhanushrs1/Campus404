from __future__ import annotations

import re


def _frontend_selector_exists(html: str, selector: str) -> bool:
    selector = selector.strip()
    if not selector:
        return True
    if selector.startswith("#"):
        ident = re.escape(selector[1:])
        return re.search(rf'id=["\']{ident}["\']', html, flags=re.IGNORECASE) is not None
    if selector.startswith("."):
        class_name = re.escape(selector[1:])
        return re.search(rf'class=["\'][^"\']*\b{class_name}\b[^"\']*["\']', html, flags=re.IGNORECASE) is not None
    tag = re.escape(selector.lower())
    return re.search(rf"<\s*{tag}(\s|>|/)", html.lower()) is not None


def execute_frontend_validation(job: dict) -> dict:
    files = job.get("files") or []
    file_map = {
        (item.get("file_path") or "").replace("\\", "/").lower(): item.get("content", "")
        for item in files
    }
    html = file_map.get("index.html", "")
    css = file_map.get("styles.css", "") or file_map.get("style.css", "")
    js = file_map.get("script.js", "") or file_map.get("main.js", "")
    config = job.get("validation_config") or {}

    failures: list[str] = []
    for path in config.get("required_files", []):
        if str(path).lower() not in file_map:
            failures.append(f"Missing required file: {path}")

    for text in config.get("required_text", []):
        if str(text).lower() not in html.lower():
            failures.append(f"Missing required text: {text}")

    for selector in config.get("required_selectors", []):
        if not _frontend_selector_exists(html, str(selector)):
            failures.append(f"Missing required selector: {selector}")

    for snippet in config.get("css_contains", []):
        if str(snippet).lower() not in css.lower():
            failures.append(f"CSS requirement not found: {snippet}")

    for snippet in config.get("js_contains", []):
        if str(snippet).lower() not in js.lower():
            failures.append(f"JavaScript requirement not found: {snippet}")

    if failures:
        return {
            "status": "completed",
            "output": "\n".join(failures),
            "error": None,
            "verdict": "Wrong Answer",
            "time": "0.000",
        }

    return {
        "status": "completed",
        "output": "Frontend validation passed.",
        "error": None,
        "verdict": "Accepted",
        "time": "0.000",
    }
