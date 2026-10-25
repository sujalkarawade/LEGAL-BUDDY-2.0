"""Private stdin/stdout worker. Loads local weights only; never contacts a provider."""
import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
import contextlib
import hashlib
import json
from pathlib import Path
import sys


def emit(value):
    print(json.dumps(value), flush=True)


try:
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import torch
        import sentence_transformers
        from sentence_transformers import SentenceTransformer
        torch.set_num_threads(2)
        root = Path(sys.argv[1]).resolve(strict=True)
        digest = hashlib.sha256()
        # Include weights, tokenizer, pooling, prompts, and library version in compatibility identity.
        for file in sorted(root.rglob('*')):
            if not file.is_file() or '.cache' in file.parts or file.suffix not in ('.json', '.txt', '.safetensors', '.bin'):
                continue
            digest.update(file.relative_to(root).as_posix().encode())
            with file.open('rb') as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(block)
        digest.update(sentence_transformers.__version__.encode())
        model = SentenceTransformer(str(root), device='cpu', local_files_only=True, trust_remote_code=False, token=False)
        dimensions = model.get_sentence_embedding_dimension()
        signature = 'local-st:' + digest.hexdigest() + ':' + str(dimensions) + ':window-mean-v1'
    emit({'type': 'ready', 'signature': signature, 'dimensions': dimensions})
except Exception:
    emit({'type': 'error', 'code': 'local_model_unavailable'})
    sys.exit(1)

for line in sys.stdin:
    request_id = None
    try:
        request = json.loads(line)
        request_id = request['id']
        texts = request['texts']
        if not isinstance(texts, list) or not 1 <= len(texts) <= 8 or any(not isinstance(t, str) or not t.strip() or len(t) > 6000 for t in texts):
            raise ValueError('invalid_input')
        vectors = []
        with contextlib.redirect_stdout(sys.stderr):
            for text in texts:
                # Prevent silent loss of the end of long legal clauses at the tokenizer limit.
                prompt = model.prompts.get('query' if request.get('task') == 'query' else 'document', '')
                ids = model.tokenizer.encode(prompt + text, add_special_tokens=False, truncation=False)
                window = max(16, model.max_seq_length - model.tokenizer.num_special_tokens_to_add())
                parts = [model.tokenizer.decode(ids[i:i + window], skip_special_tokens=True) for i in range(0, len(ids), window)]
                encoded = model.encode(parts, batch_size=8, normalize_embeddings=True, show_progress_bar=False)
                pooled = np.mean(encoded, axis=0)
                norm = np.linalg.norm(pooled)
                if norm <= 0 or not np.isfinite(pooled).all():
                    raise ValueError('invalid_vector')
                vectors.append((pooled / norm).tolist())
        emit({'id': request_id, 'vectors': vectors})
    except Exception:
        # Never echo contract text or exception messages into application logs.
        emit({'id': request_id, 'error': 'embedding_failed'})
