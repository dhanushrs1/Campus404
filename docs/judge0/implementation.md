# Campus404 Sandbox Judge Implementation

## Overview
The Campus404 Judge is a highly scalable, isolated code-execution environment located under the `sandbox/` directory. It acts as a safety barrier between the React frontend and the raw `Judge0` Docker containers.

By handling code execution in a dedicated `FastAPI` router running asynchronously, the core backend is completely protected from crashes, memory floods, and infinite loops created by users.

## The Endpoint

All submissions must be sent to the isolated judge endpoint:

**`POST /api/judge/submit`**

### Security & Limits
1. **Nginx Rate Limiting:** The endpoint is protected by an Nginx configuration (`infra/nginx.conf`) that strictly allows a maximum of **2 requests per second per IP** (with a burst limit of 5). Exceeding this will return a `503 Service Temporarily Unavailable`.
2. **Asynchronous Execution:** The backend uses `httpx.AsyncClient` so the main event loop never blocks during heavy code compilation.
3. **Execution Limits:** 
   - Max CPU Time: `5.0 seconds`
   - Max Memory: `128 MB`
   - Output truncation: STDOUT/STDERR are automatically truncated to 10,000 characters to prevent massive payloads from crashing the user's browser.
4. **Input Validation:** Source code length is strictly enforced to a maximum of `50,000` characters using Pydantic models.

---

## 1. Request Format

**Headers:**
`Content-Type: application/json`

**Body:**
```json
{
  "source_code": "print('Hello World')",
  "language_id": 71,
  "expected_output": "Hello World\n"  // Optional: Used by the local mock for validation
}
```

### Supported Language IDs
The local fallback mock and the underlying Judge0 sandbox natively support:
- `50`: C (`gcc`)
- `54`: C++ (`g++`)
- `51`: C# (`csc`)
- `60`: Go (`go run`)
- `62`: Java (`javac` / `java`)
- `63`: JavaScript (`node`)
- `68`: PHP (`php`)
- `71`: Python 3 (`python`)
- `72`: Ruby (`ruby`)
- `73`: Rust (`rustc`)

---

## 2. Response Format

The API parses the result from the executor and responds with a JSON object.

```json
{
  "stdout": "Hello World\n",
  "time": "0.015",
  "memory": 3164,
  "stderr": null,
  "compile_output": null,
  "status": {
    "id": 3,
    "description": "Accepted"
  }
}
```

### Important Status IDs
Your frontend should look at `status.id` to determine success:

- `3` = **Accepted** (The code executed correctly).
- `4` = **Wrong Answer** (The code ran, but the output did not match `expected_output`).
- `5` = **Time Limit Exceeded** (Infinite loop detected).
- `6` = **Compilation Error** (Syntax error in compiled languages).
- `11` = **Runtime Error** (The code crashed or threw an exception).
- `13` = **Internal Error** (The sandbox failed to process the request).
