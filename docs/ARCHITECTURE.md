# campus404 Architecture

campus404 is designed as a distributed, microservices-first coding education platform.

## Canonical Repository Layout

This layout is intentionally strict to avoid concern leakage between services.

```text
/campus404
├── /infra          # NGINX configuration (API Gateway)
├── /client         # React + Vite (Static Frontend)
├── /api            # Python + FastAPI (Backend)
├── /judge          # Judge0 + Redis (Execution Engine)
└── /docs           # Architecture and contribution docs
```

## Service Responsibilities

### infra
- Owns external HTTP entry and request routing.
- Serves static frontend assets from the Vite build output.
- Proxies `/api/*` traffic to the backend service.
- Never contains application business logic.

### client
- Owns browser UI and user interactions.
- Calls backend via `/api/*` routes exposed by gateway.
- Ships as static assets (HTML, CSS, JS bundle).
- Should not contain secrets.
- Production caching rule: `index.html` and SPA fallback routes must be served with no-cache headers, while hashed `/assets/*` files may be cached immutably. This prevents stale admin UI shells after deploys on localhost, Docker, or a real domain.

### api
- Stateless application layer.
- Handles auth, validation, and database access patterns.
- Forwards execution requests to judge network.
- Must never execute untrusted user code.

### judge
- Isolated code execution plane.
- Judge0 API receives submissions and returns tokens.
- Redis queue and worker processes execute code asynchronously.

### docs
- Source of truth for architecture decisions and contributor workflows.

## Critical Boundary Rule

The API receives code payloads but does not run them.
Execution always occurs in the judge stack.
