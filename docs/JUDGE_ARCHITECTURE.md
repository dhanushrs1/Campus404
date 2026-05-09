User types code → clicks Run
│
▼
[WorkspacePage] → POST /api/v1/judge/submissions
│
▼ ← Python API is middleman #1
[FastAPI API] → POST http://campus404-judge:2358/submissions
│
▼ ← Judge API is middleman #2
[campus404-judge] → lpush execution_queue → [Redis]
│
brpop ←─────────────┘
[judge_worker]
│ executes code in subprocess
▼
set job:{id} result → Redis

[WorkspacePage] polls GET /api/v1/judge/submissions/{job_id} every 800ms
→ FastAPI → judge API → Redis GET → return result
