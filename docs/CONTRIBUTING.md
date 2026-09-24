# Contributing to campus404

Thank you for contributing.

This repository is split into clear service boundaries.
Please keep changes isolated to the correct directory.

## Local Setup (Bootstrap)

### 1. Frontend (client)
- Install dependencies with `npm install`.
- Start dev server with `npm run dev`.
- When using Docker locally, keep `docker compose up` running. The local `docker-compose.override.yml` switches the `client` service from the production NGINX image to Vite, mounts `./client` into the container, and enables hot reload. You should not need to run `npm run build` or restart Docker for normal React/CSS edits.

### 2. Backend (api)
- Create a Python virtual environment.
- Install dependencies from `requirements.txt`.
- Run API with `uvicorn main:app --reload --host 0.0.0.0 --port 8000`.
- When using Docker locally, the same `docker-compose.override.yml` mounts `./api` and runs Uvicorn with `--reload`, so ordinary Python source edits restart the API process automatically. Rebuild the API image only after dependency or Dockerfile changes.

### 3. Judge stack (judge)
- Start services with `docker compose up -d`.
- Verify Judge0 API on port `2358`.

### 4. Gateway (infra)
- Mount built frontend assets to NGINX static root.
- Load `nginx.conf` and route requests through gateway.
- Production is different from development: the `client` service ships static files from `npm run build`. Rebuild the image only when deploying a release, for example `docker compose -f docker-compose.yml up -d --build client gateway`. Do not deploy the local override file to production.
- `client/nginx.conf` intentionally serves SPA HTML with `no-cache, no-store, must-revalidate` and hashed `/assets/*` files with long immutable caching, so browsers can cache JS/CSS safely without keeping an old app shell after a deployment.

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
