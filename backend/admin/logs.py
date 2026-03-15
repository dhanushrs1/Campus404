from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
import docker
from database import get_db
from jose import jwt, JWTError
from authentications.security import SECRET_KEY, ALGORITHM
import models as user_models

router = APIRouter()

def _get_current_user_from_request(request: Request, db: Session) -> user_models.User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        payload = jwt.decode(auth[7:], SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token. Error: {str(e)} | Token: {auth}")
    
    user = db.query(user_models.User).filter(user_models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user

@router.get("")
def get_system_logs(
    request: Request,
    container_name: str = Query("campus_backend", description="Name of the container to fetch logs from"),
    lines: int = Query(100, description="Number of lines to fetch"),
    db: Session = Depends(get_db)
):
    current_user = _get_current_user_from_request(request, db)

    # Only admins can view logs
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view system logs.")

    try:
        client = docker.from_env()
        container = client.containers.get(container_name)
        
        # Get logs from the container
        logs_bytes = container.logs(tail=lines, stdout=True, stderr=True, timestamps=True)
        logs_str = logs_bytes.decode('utf-8', errors='replace')
        
        # split into list of lines for easier frontend rendering
        log_lines = logs_str.strip().split('\n') if logs_str else []
        
        return {
            "container": container_name,
            "logs": log_lines
        }
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail=f"Container {container_name} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/containers")
def list_containers(
    request: Request,
    db: Session = Depends(get_db)
):
    current_user = _get_current_user_from_request(request, db)

    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized.")

    try:
        client = docker.from_env()
        containers = client.containers.list(all=True)
        container_list = [{"name": c.name, "status": c.status, "id": c.short_id} for c in containers]
        return {"containers": container_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
