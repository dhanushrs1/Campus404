import os
from fastapi import APIRouter, HTTPException
from .schemas import CodeSubmission, ExecutionResult
from .client import JudgeClient

router = APIRouter()

# Environment variable to control whether to use native Judge0 container or mock service
# Set USE_JUDGE0_MOCK=True locally on Windows and False in production Linux
USE_MOCK = os.getenv("USE_JUDGE0_MOCK", "True").lower() == "true"
JUDGE0_URL = os.getenv("JUDGE0_URL", "http://judge0-server:2358")

judge_client = JudgeClient(base_url=JUDGE0_URL, use_mock=USE_MOCK)

@router.post("/submit", response_model=ExecutionResult)
async def submit_code(submission: CodeSubmission):
    """
    Submit code securely to the isolated sandbox environment.
    Provides a safety buffer between the frontend/users and the code execution engine.
    """
    try:
        result = await judge_client.submit_code(submission)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sandbox Execution Failed: {str(e)}")
