from pydantic import BaseModel, Field
from typing import List, Optional

class CodeSubmission(BaseModel):
    source_code: str = Field(..., max_length=50000, description="The raw source code")
    language_id: int = Field(..., description="Judge0 language ID (e.g., 71 for Python 3, 63 for JS, 54 for C++)")
    stdin: str | None = Field(default=None, max_length=10000, description="Standard input to feed to the program")

    # Legacy single-value field (kept for backwards compat)
    expected_output: str | None = Field(default=None, max_length=10000, description="Single expected output (legacy)")

    # New multi-value fields
    expected_outputs: List[str] | None = Field(default=None, description="List of accepted outputs (any match = Accepted)")
    match_mode: str | None = Field(
        default="normalize",
        description=(
            "How to compare output: "
            "'normalize' (strip + lowercase + collapse whitespace, default), "
            "'exact' (strip trailing newline only), "
            "'any_of' (normalize-match against any value in expected_outputs)"
        ),
    )

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