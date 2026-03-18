"""
LightFM Recommendation Service for OmniLearn
Uses hybrid collaborative filtering with user/item features for content recommendations.
omnilearn.space | Afflatus Consulting Group
"""

import os
import json
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
from lightfm import LightFM
from lightfm.data import Dataset
from scipy.sparse import coo_matrix
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI(title="OmniLearn Recommendations")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

API_URL = os.getenv("OMNILEARN_API_URL", "http://localhost:4000")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")
MODEL_PATH = Path(os.getenv("MODEL_PATH", "./data/model.pkl"))
DATA_PATH = Path(os.getenv("DATA_PATH", "./data"))
MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

# In-memory model and mappings (loaded from disk or built from API)
model: Optional[LightFM] = None
user_id_to_idx: dict = {}
item_id_to_idx: dict = {}
idx_to_item_id: list = []
user_features_matrix = None
item_features_matrix = None


def fetch_interactions_and_features():
    """Fetch user-item interactions and user/item metadata from OmniLearn API."""
    interactions = []  # (user_id, content_id, weight)
    user_meta = {}  # user_id -> {department, position, industry, sectorFocus}
    item_meta = {}  # content_id -> {type, domainId, sectorTag}

    try:
        headers = {}
        if INTERNAL_SERVICE_KEY:
            headers["x-internal-key"] = INTERNAL_SERVICE_KEY
        with httpx.Client(timeout=30) as client:
            r = client.get(f"{API_URL}/intelligence/lightfm/interactions", headers=headers)
            if r.status_code == 200:
                data = r.json()
                raw = data.get("interactions", [])
                interactions = [(x["userId"], x["contentId"], x["weight"]) for x in raw]
                user_meta = data.get("userFeatures", {})
                item_meta = data.get("itemFeatures", {})
    except Exception as e:
        print(f"Fetch error: {e}")
        # Return empty for cold start
        return [], {}, {}

    return interactions, user_meta, item_meta


def build_dataset(interactions, user_meta, item_meta):
    """Build LightFM Dataset with user/item features."""
    user_ids = list(set(u for u, _, _ in interactions))
    item_ids = list(set(i for _, i, _ in interactions))

    # Add feature tokens
    user_feature_tokens = set()
    for uid, meta in user_meta.items():
        if meta.get("department"):
            user_feature_tokens.add(f"dept:{meta['department']}")
        if meta.get("position"):
            user_feature_tokens.add(f"pos:{meta['position']}")
        if meta.get("industry"):
            user_feature_tokens.add(f"ind:{meta['industry']}")
        if meta.get("sectorFocus"):
            user_feature_tokens.add(f"sec:{meta['sectorFocus']}")
        user_feature_tokens.add(f"user:{uid}")

    item_feature_tokens = set()
    for iid, meta in item_meta.items():
        if meta.get("type"):
            item_feature_tokens.add(f"type:{meta['type']}")
        if meta.get("domainId"):
            item_feature_tokens.add(f"dom:{meta['domainId']}")
        if meta.get("sectorTag"):
            item_feature_tokens.add(f"sector:{meta['sectorTag']}")
        item_feature_tokens.add(f"item:{iid}")

    dataset = Dataset(user_identity_features=False, item_identity_features=False)
    dataset.fit(
        users=user_ids,
        items=item_ids,
        user_features=list(user_feature_tokens),
        item_features=list(item_feature_tokens),
    )

    # Build interaction matrix
    (interactions_matrix, weights) = dataset.build_interactions(
        [(u, i, w) for u, i, w in interactions]
    )

    # Build user features
    user_features_list = []
    for uid in user_ids:
        feats = [f"user:{uid}"]
        meta = user_meta.get(uid, {})
        if meta.get("department"):
            feats.append(f"dept:{meta['department']}")
        if meta.get("position"):
            feats.append(f"pos:{meta['position']}")
        if meta.get("industry"):
            feats.append(f"ind:{meta['industry']}")
        if meta.get("sectorFocus"):
            feats.append(f"sec:{meta['sectorFocus']}")
        user_features_list.append((uid, feats))

    user_features_matrix = dataset.build_user_features(user_features_list)

    # Build item features
    item_features_list = []
    for iid in item_ids:
        feats = [f"item:{iid}"]
        meta = item_meta.get(iid, {})
        if meta.get("type"):
            feats.append(f"type:{meta['type']}")
        if meta.get("domainId"):
            feats.append(f"dom:{meta['domainId']}")
        if meta.get("sectorTag"):
            feats.append(f"sector:{meta['sectorTag']}")
        item_features_list.append((iid, feats))

    item_features_matrix = dataset.build_item_features(item_features_list)

    return dataset, interactions_matrix, weights, user_features_matrix, item_features_matrix, user_ids, item_ids


def train_model():
    """Train or retrain the LightFM model."""
    global model, user_id_to_idx, item_id_to_idx, idx_to_item_id, user_features_matrix, item_features_matrix

    interactions, user_meta, item_meta = fetch_interactions_and_features()

    if not interactions:
        print("No interactions - using fallback.")
        model = None
        return {"status": "no_data", "message": "No interaction data yet. Recommendations will use fallback."}

    dataset, inter_matrix, weights, uf, if_, user_ids, item_ids = build_dataset(
        interactions, user_meta, item_meta
    )

    user_id_to_idx = {uid: i for i, uid in enumerate(user_ids)}
    item_id_to_idx = {iid: i for i, iid in enumerate(item_ids)}
    idx_to_item_id = item_ids

    model = LightFM(loss="warp", no_components=30, learning_rate=0.05)
    model.fit(
        inter_matrix,
        user_features=uf,
        item_features=if_,
        sample_weight=weights,
        epochs=20,
        num_threads=2,
    )

    user_features_matrix = uf
    item_features_matrix = if_

    # Persist
    state = {
        "model": model,
        "user_id_to_idx": user_id_to_idx,
        "item_id_to_idx": item_id_to_idx,
        "idx_to_item_id": idx_to_item_id,
        "user_features": user_features_matrix,
        "item_features": item_features_matrix,
    }
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(state, f)

    return {"status": "trained", "users": len(user_ids), "items": len(item_ids)}


def load_model():
    """Load model from disk."""
    global model, user_id_to_idx, item_id_to_idx, idx_to_item_id, user_features_matrix, item_features_matrix
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            state = pickle.load(f)
        model = state["model"]
        user_id_to_idx = state["user_id_to_idx"]
        item_id_to_idx = state["item_id_to_idx"]
        idx_to_item_id = state["idx_to_item_id"]
        user_features_matrix = state.get("user_features")
        item_features_matrix = state.get("item_features")


@app.on_event("startup")
def startup():
    load_model()


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/train")
def train():
    result = train_model()
    return result


@app.get("/recommend/{user_id}")
def recommend(user_id: str, limit: int = 10, exclude: Optional[str] = None):
    """Get content recommendations for a user."""
    exclude_ids = [x.strip() for x in (exclude or "").split(",") if x.strip()]

    if model is None:
        return {"recommendations": [], "source": "fallback"}

    user_idx = user_id_to_idx.get(user_id)
    if user_idx is None:
        # Cold start: return popular items
        scores = np.array(model.item_biases).flatten()
        top_indices = np.argsort(-scores)[: limit + len(exclude_ids)]
        recs = []
        for idx in top_indices:
            if idx < len(idx_to_item_id):
                iid = idx_to_item_id[idx]
                if iid not in exclude_ids:
                    recs.append({"contentId": iid, "score": float(scores[idx])})
                    if len(recs) >= limit:
                        break
        return {"recommendations": recs, "source": "cold_start"}

    # Predict scores for all items
    n_items = len(item_id_to_idx)
    user_indices = np.full(n_items, user_idx)
    item_indices = np.arange(n_items)
    scores = model.predict(
        user_indices,
        item_indices,
        user_features=user_features_matrix,
        item_features=item_features_matrix,
    )

    # Exclude and sort
    recs = []
    for idx in np.argsort(-scores):
        if idx < len(idx_to_item_id):
            iid = idx_to_item_id[idx]
            if iid not in exclude_ids:
                recs.append({"contentId": iid, "score": float(scores[idx])})
                if len(recs) >= limit:
                    break
    return {"recommendations": recs, "source": "lightfm"}
