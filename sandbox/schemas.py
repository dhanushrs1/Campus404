from pydantic import BaseModel, Field
from typing import Optional

class CodeSubmission(BaseModel):
    source_code: str = Field(..., max_length=50000, description="The raw source code")
    language_id: int = Field(..., description="Judge0 language ID (e.g., 71 for Python 3, 63 for JS, 54 for C++)")
    expected_output: Optional[str] = Field(None, max_length=10000, description="Expected output for validation")

class JudgeStatus(BaseModel):
    id: int
    description: str

class ExecutionResult(BaseModel):
    stdout: Optional[str]
    time: str
    memory: int
    stderr: Optional[str]
    compile_output: Optional[str]
    status: JudgeStatus
