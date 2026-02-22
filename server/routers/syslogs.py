"""
routers/syslogs.py — Campus404
Admin route for fetching and viewing real-time Docker container logs.
"""
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
import docker

from database import get_db
from templates_config import templates

router = APIRouter()

# Initialize Docker client using the mounted socket
try:
    docker_client = docker.from_env()
except Exception as e:
    docker_client = None
    print(f"[Campus404] ⚠️ Could not initialize Docker client: {e}")

AVAILABLE_CONTAINERS = {
    "campus_backend": "Backend API Server",
    "campus_frontend": "Frontend Vite Server",
    "campus_sandbox_api": "Judge0 Server API",
    "campus_sandbox_worker": "Judge0 Worker",
    "campus_db": "MySQL Database",
    "campus_nginx": "Nginx Proxy",
    "campus_sandbox_db": "PostgreSQL Sandbox DB",
    "campus_sandbox_redis": "Redis Sandbox Queue"
}

@router.get("/admin/logs", response_class=HTMLResponse)
async def admin_logs_page(request: Request, db: Session = Depends(get_db)):
    """Render the log viewer page."""
    return templates.TemplateResponse("admin/logs.html", {
        "request": request,
        "active": "system_logs",
        "containers": AVAILABLE_CONTAINERS,
        "docker_connected": docker_client is not None
    })

@router.get("/admin/logs/api")
async def fetch_container_logs(container: str = "campus_backend", tail: int = 200, db: Session = Depends(get_db)):
    """Return the last N lines of logs for the specified container."""
    if not docker_client:
        raise HTTPException(status_code=503, detail="Docker socket not mounted or unavailable.")
    
    if container not in AVAILABLE_CONTAINERS:
        raise HTTPException(status_code=400, detail="Invalid container specified.")
    
    try:
        target_container = docker_client.containers.get(container)
        logs_bytes = target_container.logs(tail=tail, timestamps=True)
        # Decode ignoring errors, some logs might have non-utf8 characters
        logs_str = logs_bytes.decode("utf-8", errors="replace")
        return {"logs": logs_str}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail=f"Container {container} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
