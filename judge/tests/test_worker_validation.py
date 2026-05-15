import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from frontend_validation import execute_frontend_validation


def test_frontend_validation_accepts_required_files_text_selectors_and_css():
    result = execute_frontend_validation(
        {
            "files": [
                {"file_path": "index.html", "content": '<main class="profile-card"><h1>Campus404</h1></main>'},
                {"file_path": "styles.css", "content": ".profile-card { background: #dff0ff; }"},
            ],
            "validation_config": {
                "required_files": ["index.html", "styles.css"],
                "required_text": ["Campus404"],
                "required_selectors": [".profile-card", "h1"],
                "css_contains": ["background"],
            },
        }
    )

    assert result["verdict"] == "Accepted"


def test_frontend_validation_reports_missing_requirement():
    result = execute_frontend_validation(
        {
            "files": [{"file_path": "index.html", "content": "<main></main>"}],
            "validation_config": {"required_selectors": [".profile-card"]},
        }
    )

    assert result["verdict"] == "Wrong Answer"
    assert "Missing required selector" in result["output"]


def test_frontend_validation_rejects_empty_rule_config():
    result = execute_frontend_validation(
        {
            "files": [{"file_path": "index.html", "content": "<main>Campus404</main>"}],
            "validation_config": {},
        }
    )

    assert result["verdict"] == "Wrong Answer"
    assert "No frontend validation rules" in result["output"]
