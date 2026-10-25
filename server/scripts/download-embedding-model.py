"""Explicit setup step; downloads public weights only, never sends document text."""
from pathlib import Path
from huggingface_hub import snapshot_download

snapshot_download(
    repo_id='sentence-transformers/all-MiniLM-L6-v2',
    revision='1110a243fdf4706b3f48f1d95db1a4f5529b4d41',
    local_dir=str(Path(__file__).resolve().parents[1] / 'models' / 'all-MiniLM-L6-v2'),
    allow_patterns=['*.json', '*.txt', '*.safetensors', '1_Pooling/*', 'README.md', 'LICENSE'],
    token=False,
)
