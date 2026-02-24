# Judge0 Code Execution — Campus404

> Campus404 uses a **self-hosted Judge0** instance for sandboxed code execution.
> Judge0 runs as a Docker service and is accessed internally by the FastAPI backend.

---

## Services

| Container               | Role                                             |
| ----------------------- | ------------------------------------------------ |
| `campus_sandbox_api`    | Judge0 HTTP API server (port 2358)               |
| `campus_sandbox_worker` | Judge0 background worker (pulls jobs from queue) |
| `campus_sandbox_db`     | PostgreSQL 14 (Judge0's persistent store)        |
| `campus_sandbox_redis`  | Redis 7 (job queue)                              |

Configuration: `sandbox/judge0.conf`

---

## How Code Execution Works

### Flow

```
Workspace.jsx
  → POST /api/execute (Nginx strips /api →)
  → FastAPI /execute endpoint (api.py)
  → POST http://judge0-server:2358/submissions?base64_encoded=false&wait=true
  → Judge0 executes in isolated container
  → Returns { stdout, stderr, compile_output, status }
  → FastAPI returns { "output": "..." }
  → Terminal panel displays output
```

### Request to Judge0

```json
POST http://judge0-server:2358/submissions?base64_encoded=false&wait=true
{
  "source_code": "print('hello')",
  "language_id": 71
}
```

`wait=true` means Judge0 blocks until execution is complete (synchronous mode, up to Judge0's timeout).

### Response Handling

| Condition                               | Output Returned                                                   |
| --------------------------------------- | ----------------------------------------------------------------- |
| `stdout` is present                     | `stdout` value                                                    |
| `stderr` is present (no stdout)         | `stderr` value                                                    |
| `compile_output` present                | `compile_output` value                                            |
| Internal Error (Python, language_id 71) | **Subprocess fallback** (see below)                               |
| Other statuses                          | `"Execution finished with status: {status}\nNo output returned."` |

---

## Subprocess Fallback (Python)

Judge0 has a known crash on Docker Desktop (WSL2) for Python. When `status == "Internal Error"` and `language_id == 71`, the backend falls back to:

```python
import subprocess, tempfile, os

with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
    f.write(source_code)
    temp_name = f.name

proc = subprocess.run(
    ["python", temp_name],
    capture_output=True,
    timeout=5.0,
    text=True
)
output = proc.stdout
# Appends stderr if present
```

**Timeout:** 5 seconds. Returns `"Execution timed out (5s limit)."` on timeout.

> ⚠️ This fallback runs code in the backend container, not in Judge0's isolated sandbox. It should be replaced with proper Judge0 configuration once the WSL2 issue is resolved in production.

---

## Supported Languages

Judge0 supports 60+ languages. The frontend currently hardcodes `language_id: 71` (Python 3).

Common language IDs:

| Language             | ID  |
| -------------------- | --- |
| Python 3             | 71  |
| JavaScript (Node.js) | 63  |
| Java                 | 62  |
| C++ (GCC 9.2.0)      | 54  |
| C (GCC 9.2.0)        | 50  |
| Bash                 | 46  |

See full list at: [Judge0 Language IDs](https://ce.judge0.com/languages)

---

## Configuration (`sandbox/judge0.conf`)

The `judge0.conf` file controls:

- Worker concurrency
- Max execution time
- Max memory
- Network isolation

Key settings to tune for production:

- `MAX_PROCESSES`: Concurrent submissions
- `CPU_TIME_LIMIT`: Seconds before timeout
- `MEMORY_LIMIT`: in KB

---

## Judge0 URL (Configurable)

The Judge0 URL can be changed in **Admin → Settings → Platform tab**:

- Setting key: `judge0_api_url`
- Default: `http://judge0-server:2358`

The dashboard health check pings `{judge0_api_url}/about` with a 2-second timeout.

---

## Future: Submission Grading

Currently, `/execute` only runs code and returns output. **Submission grading** (comparing output to test cases) is **not yet implemented**.

Planned flow:

1. Student clicks "Submit"
2. Backend runs each `TestCase` through Judge0
3. Compares `stdout.strip()` to `expected_output.strip()`
4. Creates `Submission` record with `status = "passed"` or `"failed"`
5. If passed: award XP, update `UserProgress`, check badge thresholds
6. If failed: increment `UserProgress.failed_attempts`, check `max_fail_unlock` to reveal `repo_link`
