# Contributing to campus404

Thank you for contributing.

This repository is split into clear service boundaries.
Please keep changes isolated to the correct directory.

## Local Setup (Bootstrap)

### 1. Frontend (client)
- Install dependencies with `npm install`.
- Start dev server with `npm run dev`.

### 2. Backend (api)
- Create a Python virtual environment.
- Install dependencies from `requirements.txt`.
- Run API with `uvicorn main:app --reload --host 0.0.0.0 --port 8000`.

### 3. Judge stack (judge)
- Start services with `docker compose up -d`.
- Verify Judge0 API on port `2358`.

### 4. Gateway (infra)
- Mount built frontend assets to NGINX static root.
- Load `nginx.conf` and route requests through gateway.
- For Docker or real-domain deployments, rebuild/restart the `client` service after frontend changes. `client/nginx.conf` intentionally serves SPA HTML with `no-cache, no-store, must-revalidate` and hashed `/assets/*` files with long immutable caching, so browsers can cache JS/CSS safely without keeping an old app shell.

## Contribution Rules

- Keep API stateless.
- Do not execute user code in the API service.
- Route all execution to Judge0.
- Preserve directory ownership boundaries.
- Document notable architecture changes in `docs/ARCHITECTURE.md`.

## Pull Request Checklist

- [ ] Change is scoped to the correct service directory.
- [ ] No security boundary violations.
- [ ] New behavior is documented.
- [ ] Commands and setup notes still work.
