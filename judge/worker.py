"""
campus404 Judge Worker — Standalone Redis consumer process.

This is NOT a FastAPI app. It runs as a separate container/process.
It blocks on the Redis queue, pops jobs one at a time, executes them safely,
and stores results back in Redis.

A crash in user code CANNOT crash this worker — every execution is wrapped
in a try/except so the worker loop continues regardless.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
import time

import redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [worker] %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)

# ── Redis connection ──────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://campus404-redis:6379/0")
QUEUE_KEY = "execution_queue"
JOB_TTL = 3600

_redis = redis.from_url(REDIS_URL, decode_responses=True)

# ── Language execution map ────────────────────────────────────────────────────
#   Each entry: [command, ...] with {code} as placeholder for the source file path
#   or {src} for inline source (languages that support -c/-e)

LANGUAGE_RUNNERS: dict[int, dict] = {
    50:  {"name": "C",          "ext": ".c",   "compile": ["gcc", "{src}", "-o", "{out}"],   "run": ["{out}"]},
    54:  {"name": "C++",        "ext": ".cpp",  "compile": ["g++", "{src}", "-o", "{out}"],   "run": ["{out}"]},
    62:  {"name": "Java",       "ext": ".java", "compile": ["javac", "{src}"],               "run": ["java", "-cp", "{dir}", "Main"]},
    63:  {"name": "JavaScript", "ext": ".js",   "run": ["node", "{src}"]},
    68:  {"name": "PHP",        "ext": ".php",  "run": ["php", "{src}"]},
    71:  {"name": "Python",     "ext": ".py",   "run": ["python3", "{src}"]},
    72:  {"name": "Ruby",       "ext": ".rb",   "run": ["ruby", "{src}"]},
    73:  {"name": "Rust",       "ext": ".rs",   "compile": ["rustc", "{src}", "-o", "{out}"], "run": ["{out}"]},
    60:  {"name": "Go",         "ext": ".go",   "run": ["go", "run", "{src}"]},
    51:  {"name": "C#",         "ext": ".cs",   "compile": ["mcs", "{src}", "-out:{out}.exe"], "run": ["mono", "{out}.exe"]},
}

CPU_LIMIT = float(os.getenv("JUDGE_CPU_TIME_LIMIT", "5"))   # seconds
MEM_LIMIT_MB = int(os.getenv("JUDGE_MEMORY_LIMIT_MB", "128"))


def _substitute(args: list[str], src: str, out: str, src_dir: str) -> list[str]:
    return [
        a.replace("{src}", src).replace("{out}", out).replace("{dir}", src_dir)
        for a in args
    ]


def _run_process(cmd: list[str], stdin: str | None = None) -> tuple[str, str, int]:
    """Run a subprocess with timeout. Returns (stdout, stderr, returncode)."""
    try:
        result = subprocess.run(
            cmd,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=CPU_LIMIT,
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "Execution timed out (exceeded CPU limit).", -9
    except FileNotFoundError as e:
        return "", f"Interpreter/compiler not found: {e}", -1


def _normalize(text: str) -> str:
    """Normalize output for comparison: strip edges, collapse inner whitespace."""
    return " ".join(text.lower().split())


def _check_output(actual: str, job: dict) -> bool:
    """
    Smart output checker supporting 3 modes:

    - "normalize" (default): strip + lowercase + collapse whitespace.
      Handles trailing newlines, extra spaces, and minor case differences.
    - "exact": byte-for-byte match after stripping only the final newline.
    - "any_of": pass if actual matches ANY string in expected_outputs list.
      Each candidate is checked under the current match_mode.

    The job dict may carry:
      expected_output  (str)        — legacy single-value field
      expected_outputs (list[str])  — new multi-value field (preferred)
      match_mode       (str)        — "normalize" | "exact" | "any_of"
    """
    mode = str(job.get("match_mode", "normalize")).lower()

    # Build candidate list from either the new or legacy field
    candidates: list[str] = job.get("expected_outputs") or []
    if not candidates:
        legacy = job.get("expected_output")
        if legacy:
            candidates = [legacy]

    if not candidates:
        # No expected output defined → just run, don't grade
        return True

    def _matches_one(actual_s: str, expected_s: str) -> bool:
        if mode == "exact":
            return actual_s.rstrip("\n") == expected_s.rstrip("\n")
        # normalize mode (default for both "normalize" and "any_of" per-candidate)
        return _normalize(actual_s) == _normalize(expected_s)

    if mode == "any_of":
        return any(_matches_one(actual, c) for c in candidates)
    else:
        # For "normalize" and "exact" just check against all candidates (any match wins)
        return any(_matches_one(actual, c) for c in candidates)


def execute_job(job: dict) -> dict:
    """
    Execute source code for the given language.
    Always returns a result dict — never raises.

    Verdict hierarchy (checked in order):
      Time Limit Exceeded  — process killed after CPU_LIMIT seconds
      Compilation Error    — compiler returned non-zero
      Runtime Error        — interpreter/runner returned non-zero
      Wrong Answer         — output did not match any accepted output
      Accepted             — output matched at least one accepted output
                             (or no expected outputs were defined → free run)
    """
    source_code: str = job.get("source_code", "")
    language_id: int = job.get("language_id", 0)
    stdin_data: str | None = job.get("stdin")

    runner = LANGUAGE_RUNNERS.get(language_id)
    if not runner:
        return {
            "status": "completed",
            "output": None,
            "error": f"Unsupported language_id: {language_id}",
            "verdict": "Internal Error",
            "time": "0.000",
        }

    ext = runner["ext"]
    start_time = time.monotonic()

    with tempfile.TemporaryDirectory() as tmpdir:
        filename = "Main" if language_id == 62 else "solution"
        src_path = os.path.join(tmpdir, filename + ext)
        out_path = os.path.join(tmpdir, filename)

        with open(src_path, "w", encoding="utf-8") as f:
            f.write(source_code)

        # ── Compile (optional) ───────────────────────────────────────
        if "compile" in runner:
            compile_cmd = _substitute(runner["compile"], src_path, out_path, tmpdir)
            _, compile_err, rc = _run_process(compile_cmd)
            if rc != 0:
                return {
                    "status": "completed",
                    "output": None,
                    "error": compile_err,
                    "verdict": "Compilation Error",
                    "time": f"{time.monotonic() - start_time:.3f}",
                }

        # ── Run ──────────────────────────────────────────────────────
        run_cmd = _substitute(runner["run"], src_path, out_path, tmpdir)
        stdout, stderr, rc = _run_process(run_cmd, stdin=stdin_data)

        elapsed = f"{time.monotonic() - start_time:.3f}"

        if rc == -9:
            verdict = "Time Limit Exceeded"
        elif rc != 0:
            verdict = "Runtime Error"
        elif not _check_output(stdout, job):
            verdict = "Wrong Answer"
        else:
            verdict = "Accepted"

        return {
            "status": "completed",
            "output": stdout if stdout else None,
            "error": stderr if stderr else None,
            "verdict": verdict,
            "time": elapsed,
        }


# ── Main worker loop ──────────────────────────────────────────────────────────

def main() -> None:
    log.info("campus404 judge worker started. Waiting for jobs on '%s'...", QUEUE_KEY)

    while True:
        try:
            # Block until a job arrives (timeout=0 = block forever)
            item = _redis.brpop(QUEUE_KEY, timeout=0)
            if item is None:
                continue

            _, raw = item
            job = json.loads(raw)
            job_id = job.get("job_id", "unknown")

            log.info("Processing job %s (lang=%s)", job_id, job.get("language_id"))

            # Mark as processing
            _redis.set(
                f"job:{job_id}",
                json.dumps({"status": "processing", "output": None, "error": None}),
                ex=3600,
            )

            # Execute — wrapped so a bad job never crashes the worker
            try:
                result = execute_job(job)
            except Exception as exc:
                log.exception("Unexpected error executing job %s", job_id)
                result = {
                    "status": "completed",
                    "output": None,
                    "error": str(exc),
                    "verdict": "Internal Error",
                    "time": "0.000",
                }

            # Store final result
            _redis.set(f"job:{job_id}", json.dumps(result), ex=3600)
            log.info("Job %s finished — verdict: %s", job_id, result.get("verdict"))

        except redis.RedisError as e:
            log.error("Redis error: %s — retrying in 3s", e)
            time.sleep(3)
        except Exception as e:
            log.exception("Unexpected worker error: %s", e)
            time.sleep(1)


if __name__ == "__main__":
    main()
