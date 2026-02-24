from __future__ import annotations

from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import time
import hashlib
import uuid

app = FastAPI(title="PAI 8-Channel -> Meta Cube System (MVP)")

CHANNELS = ["CH1", "CH2", "CH3", "CH4", "CH5", "CH6", "CH7", "CH8"]

# -----------------------------
# In-memory stores (swap later)
# -----------------------------
RAW_STORE: Dict[str, Dict[str, Any]] = {}          # raw_id -> raw record
RAW_BY_SEU: Dict[str, Dict[str, str]] = {}         # seu_id -> {CHx: raw_id}

FEATURE_STORE: Dict[str, Dict[str, Any]] = {}      # (seu_id, ch) -> features
META_STORE: Dict[str, Dict[str, Any]] = {}         # (seu_id, ch) -> channel meta

CUBE_STORE: Dict[str, Dict[str, Any]] = {}         # seu_id -> cube
EVENT_BUS: List[Dict[str, Any]] = []               # append-only event list


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def stable_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def key(seu_id: str, channel_id: str) -> str:
    return f"{seu_id}::{channel_id}"


def ensure_seu(seu_id: str) -> None:
    if seu_id not in RAW_BY_SEU:
        RAW_BY_SEU[seu_id] = {}


def all_channels_present(seu_id: str) -> bool:
    m = RAW_BY_SEU.get(seu_id, {})
    return all(ch in m for ch in CHANNELS)


def get_raw(seu_id: str, channel_id: str) -> Dict[str, Any]:
    raw_map = RAW_BY_SEU.get(seu_id, {})
    raw_id = raw_map.get(channel_id)
    if not raw_id:
        raise HTTPException(status_code=404, detail=f"missing raw for {channel_id}")
    return RAW_STORE[raw_id]


def build_features_from_raw(raw: Dict[str, Any]) -> Dict[str, Any]:
    # Raw-first. No compression by default.
    return {
        "feature_ref": f"feature://{raw['channel_id']}/{raw['seu_id']}",
        "raw_ref": raw["raw_ref"],
        "raw_hash": raw["raw_hash"],
        "quality_flags": raw.get("quality_flags", []),
    }


def build_channel_meta(channel_id: str, features: Dict[str, Any]) -> Dict[str, Any]:
    # AI plug-in point #1: channel meta extraction
    return {
        "channel_id": channel_id,
        "confidence": 0.5,
        "summary": f"meta_summary_for_{channel_id}",
        "source_channels": [channel_id],
        "evidence_refs": [
            {"kind": "raw_ref", "ref": features["raw_ref"]},
            {"kind": "raw_hash", "ref": features["raw_hash"]},
        ],
    }


def merge_evidence(metas: Dict[str, Dict[str, Any]], ch_list: List[str]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for ch in ch_list:
        out.extend(metas[ch].get("evidence_refs", []))
    return out


def synthesize_cube(seu_id: str) -> Dict[str, Any]:
    # AI plug-in point #2: cube fusion
    metas: Dict[str, Dict[str, Any]] = {}
    for ch in CHANNELS:
        k = key(seu_id, ch)
        if k not in META_STORE:
            raise HTTPException(status_code=400, detail=f"missing channel meta for {ch}")
        metas[ch] = META_STORE[k]

    c_sources = ["CH1", "CH4", "CH8"]
    i_sources = ["CH2", "CH3", "CH7"]
    e_sources = ["CH2", "CH5"]

    # time from CH4 as the canonical timeline channel
    t_raw = get_raw(seu_id, "CH4")

    cube = {
        "seu_id": seu_id,
        "t": {
            "ts_start": t_raw.get("ts_start", ""),
            "ts_end": t_raw.get("ts_end", ""),
            "duration_ms": None,
        },
        "c": {
            "value": "context_compiled",
            "confidence": 0.6,
            "source_channels": c_sources,
            "evidence_refs": merge_evidence(metas, c_sources),
        },
        "i": {
            "value": "intent_compiled",
            "confidence": 0.6,
            "source_channels": i_sources,
            "evidence_refs": merge_evidence(metas, i_sources),
        },
        "e": {
            "value": "emotion_compiled",
            "confidence": 0.6,
            "source_channels": e_sources,
            "evidence_refs": merge_evidence(metas, e_sources),
        },
        "m": {
            "status": "empty",
            "notes": "reserved for next layers",
        },
        "pai": {
            "created_at": now_iso(),
            "pipeline_status": "cube_written",
        }
    }
    return cube


def emit(event_type: str, payload: Dict[str, Any]) -> None:
    EVENT_BUS.append({
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "emitted_at": now_iso(),
        "payload": payload,
    })


# -----------------------------
# API Models
# -----------------------------
class SEUTime(BaseModel):
    ts_start: str
    ts_end: str
    duration_ms: int


class SEUCreateRequest(BaseModel):
    seu_id: Optional[str] = None
    time: SEUTime
    device_id: str
    privacy_level: str = Field(default="raw_first")


class SEUCreateResponse(BaseModel):
    seu_id: str
    status: str
    expected_channels: List[str]


class ChannelRawRegisterRequest(BaseModel):
    seu_id: str
    channel_id: str
    ts_start: str
    ts_end: str
    raw_ref: str
    raw_hash: Optional[str] = None
    encryption_key_id: str = "key_default"
    retention_policy_id: str = "retain_default"
    consent_policy_id: str = "consent_default"
    quality_flags: List[str] = Field(default_factory=list)
    extra: Dict[str, Any] = Field(default_factory=dict)


class ChannelRawRegisterResponse(BaseModel):
    raw_id: str
    status: str


# -----------------------------
# Routes
# -----------------------------
@app.post("/seu", response_model=SEUCreateResponse)
def create_seu(req: SEUCreateRequest):
    seu_id = req.seu_id or f"seu_{now_iso()}_{uuid.uuid4().hex[:6]}"
    ensure_seu(seu_id)

    emit("seu.created", {
        "seu_id": seu_id,
        "time": req.time.model_dump(),
        "device_id": req.device_id,
        "privacy_level": req.privacy_level,
    })

    return SEUCreateResponse(seu_id=seu_id, status="created", expected_channels=CHANNELS)


@app.post("/channel/raw", response_model=ChannelRawRegisterResponse)
def register_raw(req: ChannelRawRegisterRequest):
    if req.channel_id not in CHANNELS:
        raise HTTPException(status_code=400, detail="invalid channel_id")

    ensure_seu(req.seu_id)

    raw_id = f"raw_{uuid.uuid4().hex}"
    raw_hash = req.raw_hash or stable_hash(req.raw_ref)

    rec = {
        "raw_id": raw_id,
        "seu_id": req.seu_id,
        "channel_id": req.channel_id,
        "ts_start": req.ts_start,
        "ts_end": req.ts_end,
        "raw_ref": req.raw_ref,
        "raw_hash": raw_hash,
        "encryption_key_id": req.encryption_key_id,
        "retention_policy_id": req.retention_policy_id,
        "consent_policy_id": req.consent_policy_id,
        "quality_flags": req.quality_flags,
        "extra": req.extra,
        "created_at": now_iso(),
    }

    RAW_STORE[raw_id] = rec
    RAW_BY_SEU[req.seu_id][req.channel_id] = raw_id

    emit("channel.raw_registered", {
        "seu_id": req.seu_id,
        "channel_id": req.channel_id,
        "raw_id": raw_id,
        "raw_ref": req.raw_ref,
        "raw_hash": raw_hash,
    })

    return ChannelRawRegisterResponse(raw_id=raw_id, status="registered")


@app.post("/channel/meta/{seu_id}/{channel_id}")
def compute_meta(seu_id: str, channel_id: str):
    if channel_id not in CHANNELS:
        raise HTTPException(status_code=400, detail="invalid channel_id")

    raw = get_raw(seu_id, channel_id)
    k = key(seu_id, channel_id)

    features = build_features_from_raw(raw)
    FEATURE_STORE[k] = features

    meta = build_channel_meta(channel_id, features)
    META_STORE[k] = meta

    emit("channel.meta_created", {"seu_id": seu_id, "channel_id": channel_id, "meta_key": k})

    return {"seu_id": seu_id, "channel_id": channel_id, "meta": meta}


@app.post("/cube/build")
def build_cube(payload: Dict[str, Any]):
    seu_id = payload.get("seu_id")
    if not seu_id:
        raise HTTPException(status_code=400, detail="seu_id required")

    if not all_channels_present(seu_id):
        raise HTTPException(status_code=400, detail="not all channel raws present")

    # auto meta build if missing
    for ch in CHANNELS:
        k = key(seu_id, ch)
        if k not in META_STORE:
            raw = get_raw(seu_id, ch)
            FEATURE_STORE[k] = build_features_from_raw(raw)
            META_STORE[k] = build_channel_meta(ch, FEATURE_STORE[k])

    cube = synthesize_cube(seu_id)
    CUBE_STORE[seu_id] = cube

    emit("cube.created", {
        "seu_id": seu_id,
        "t": cube["t"],
        "c": cube["c"],
        "i": cube["i"],
        "e": cube["e"],
        "privacy_level": "raw_first",
        "retrieval_token": f"token://{seu_id}",
    })

    return {"seu_id": seu_id, "status": "cube_written", "cube": cube}


@app.get("/cube/{seu_id}")
def get_cube(seu_id: str):
    if seu_id not in CUBE_STORE:
        raise HTTPException(status_code=404, detail="cube not found")
    return CUBE_STORE[seu_id]


@app.get("/events")
def events(limit: int = 50):
    return {"events": EVENT_BUS[-limit:]}

@app.get("/")
def root():
    return {
        "service": "PAI 8-Channel -> Meta Cube System (MVP)",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
def health():
    return {"status": "ok"}
