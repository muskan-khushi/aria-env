"""
ARIA — Custom Audit Generator
Converts raw strings or uploaded documents into standard ARIA task formats.
"""
import uuid
import json
from pathlib import Path

TASKS_DIR = Path(__file__).parent.parent / "tasks"

def create_task_from_text(raw_text: str, filename: str = "Uploaded Document") -> dict:
    """Takes a raw doc string and formats it into the ARIA task.json schema."""
    # Chunking logic for large texts
    words = raw_text.split()
    chunk_size = 500  # Words per section
    sections = []
    
    for i in range(0, len(words), chunk_size):
        chunk_words = words[i:i+chunk_size]
        sections.append({
            "section_id": f"s{i//chunk_size + 1}",
            "title": f"Section {i//chunk_size + 1}",
            "content": " ".join(chunk_words),
            "subsections": []
        })

    doc_id = str(uuid.uuid4())[:8]

    # Empty Ground truth for custom audits
    task_data = {
        "task_id": f"custom_{doc_id}",
        "title": f"Custom Audit: {filename}",
        "difficulty": "medium",
        "description": "Custom audit generated from uploaded text.",
        "max_steps": len(sections) * 3 + 10,
        "frameworks_in_scope": ["GDPR", "HIPAA", "CCPA", "SOC2"],
        "documents": [
            {
                "doc_id": doc_id,
                "title": filename,
                "sections": sections
            }
        ],
        "ground_truth": {
            "gaps": [],
            "conflicts": []
        }
    }

    # Save to disk as 'custom'
    target_dir = TASKS_DIR / "custom"
    target_dir.mkdir(parents=True, exist_ok=True)
    
    with open(target_dir / "task.json", "w", encoding="utf-8") as f:
        json.dump(task_data, f, indent=2)

    return task_data
