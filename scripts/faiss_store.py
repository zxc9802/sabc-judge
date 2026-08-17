#!/usr/bin/env python3
"""FAISS hot-cache for the SABC knowledge base."""
from __future__ import annotations

import json
import os
import sys

import faiss
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "kb"))
INDEX_PATH = os.path.join(ROOT, "faiss.index")
IDS_PATH = os.path.join(ROOT, "faiss_ids.json")


def ensure_dir() -> None:
    os.makedirs(ROOT, exist_ok=True)


def l2norm(mat: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(mat, axis=1, keepdims=True)
    n[n == 0] = 1.0
    return (mat / n).astype("float32")


def load():
    ensure_dir()
    if os.path.exists(INDEX_PATH) and os.path.exists(IDS_PATH):
        index = faiss.read_index(INDEX_PATH)
        with open(IDS_PATH, encoding="utf-8") as f:
            ids = json.load(f)
        return index, ids
    return None, []


def save(index, ids) -> None:
    ensure_dir()
    faiss.write_index(index, INDEX_PATH)
    with open(IDS_PATH, "w", encoding="utf-8") as f:
        json.dump(ids, f, ensure_ascii=False)


def add(items):
    index, ids = load()
    vecs = l2norm(np.array([it["vector"] for it in items], dtype="float32"))
    if index is None:
        index = faiss.IndexFlatIP(vecs.shape[1])
    if index.d != vecs.shape[1]:
        raise SystemExit(f"dim mismatch: index {index.d} vs {vecs.shape[1]}")
    index.add(vecs)
    ids.extend(it["id"] for it in items)
    save(index, ids)
    return {"ok": True, "ntotal": int(index.ntotal)}


def rebuild(items):
    if not items:
        if os.path.exists(INDEX_PATH):
            os.remove(INDEX_PATH)
        if os.path.exists(IDS_PATH):
            os.remove(IDS_PATH)
        return {"ok": True, "ntotal": 0}
    vecs = l2norm(np.array([it["vector"] for it in items], dtype="float32"))
    index = faiss.IndexFlatIP(vecs.shape[1])
    index.add(vecs)
    ids = [it["id"] for it in items]
    save(index, ids)
    return {"ok": True, "ntotal": int(index.ntotal)}


def search(vector, k=8):
    index, ids = load()
    if index is None or index.ntotal == 0:
        return {"hits": []}
    q = l2norm(np.array([vector], dtype="float32"))
    k = min(int(k), int(index.ntotal))
    scores, idxs = index.search(q, k)
    hits = []
    for score, i in zip(scores[0], idxs[0]):
        if i < 0:
            continue
        hits.append({"id": ids[int(i)], "score": float(score)})
    return {"hits": hits}


def main() -> None:
    payload = json.load(sys.stdin)
    op = payload.get("op")
    if op == "add":
        out = add(payload["items"])
    elif op == "rebuild":
        out = rebuild(payload.get("items") or [])
    elif op == "search":
        out = search(payload["vector"], payload.get("k", 8))
    else:
        raise SystemExit(f"unknown op {op}")
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
