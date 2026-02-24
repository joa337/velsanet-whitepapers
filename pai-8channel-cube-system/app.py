from __future__ import annotations

from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import time
import hashlib
import uuid

app = FastAPI(title="PAI 8-Channel -> Meta Cube System (MVP)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CHANNELS = ["CH1", "CH2", "CH3", "CH4", "CH5", "CH6", "CH7", "CH8"]
# CH1 — Video Frames        (RGB/Depth/Semantic 영상)
# CH2 — Audio Stream        (음성 + 주변 소음 + 환경음)
# CH3 — Spatial-Temporal    (위치·궤적·타임스탬프)
# CH4 — Biometric Signals   (심박·제스처·micro-expression)
# CH5 — Text / NLP Input    (텍스트 입력·언어 의도)
# CH6 — Device Interaction  (앱사용·터치·클릭 등 기기 상호작용)
# CH7 — User Mode / Context (현재 사용자 모드·세션 컨텍스트)
# CH8 — Environmental Meta  (온도·조도·소음레벨·공간정보 등 환경 메타)

RAW_STORE:     Dict[str, Dict[str, Any]] = {}
RAW_BY_SEU:    Dict[str, Dict[str, str]] = {}
FEATURE_STORE: Dict[str, Dict[str, Any]] = {}
META_STORE:    Dict[str, Dict[str, Any]] = {}
CUBE_STORE:    Dict[str, Dict[str, Any]] = {}
EVENT_BUS:     List[Dict[str, Any]]      = []


# ── 유틸 ─────────────────────────────────────
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
    return all(ch in RAW_BY_SEU.get(seu_id, {}) for ch in CHANNELS)

def get_raw(seu_id: str, channel_id: str) -> Dict[str, Any]:
    raw_id = RAW_BY_SEU.get(seu_id, {}).get(channel_id)
    if not raw_id:
        raise HTTPException(404, detail=f"missing raw for {channel_id}")
    return RAW_STORE[raw_id]


# ── 1단계: 원신호 분석 ────────────────────────
POSITIVE_KW = ["기대","활기","만족","편안","집중","몰입","호기심","즐거움","에너지","가볍",
               "ready","focus","calm","satisfied","curious","energized","positive","motivated"]
NEGATIVE_KW = ["긴장","피로","불안","스트레스","부담","어려움","혼란",
               "tension","stress","fatigue","anxiety","tired","overwhelmed","nervous"]
HIGH_INTENT_KW = ["완수","달성","목표","핵심","실행","완료","중요","전략",
                  "achieve","complete","goal","critical","execute","strategy","key","priority"]
SOCIAL_KW = ["팀","동료","회의","대화","협력","공유","눈인사","반응","함께",
             "team","colleague","meeting","conversation","collaborate","share","together"]
RELAX_KW  = ["이완","휴식","편안","가볍","회복","rest","relax","recover","comfortable","calm"]
TENSE_KW  = ["긴장","바른","유지","집중","upright","tense","maintain","alert","posture"]

def score_kw(text: str, pos: List[str], neg: List[str], default: float = 0.5) -> float:
    t = text.lower()
    p = sum(1 for kw in pos if kw in t)
    n = sum(1 for kw in neg if kw in t)
    if p + n == 0:
        return round(min(len(t) / 30.0, 1.0) * 0.3 + default * 0.7, 3)
    return round(min((p / (p + n)) * 0.6 + 0.4, 1.0), 3)

def extract_signal(ch: str, raw_ref: str) -> Dict[str, Any]:
    """
    백서 #06 기준 채널 정의:
    CH1: Video Frames  CH2: Audio Stream  CH3: Spatial-Temporal
    CH4: Biometric     CH5: Text Input    CH6: Device Interactions
    CH7: Metadata      CH8: Environmental Attributes
    """
    import re as _re
    t = raw_ref.strip()
    tl = t.lower()

    if ch == "CH1":  # Video Frames - 시각 장면 복잡도
        scene_kw = ["rgb","depth","조명","lighting","화면","screen","창","window","밝","bright","어두","dark","카페","cafe","사무실"]
        richness = sum(1 for k in scene_kw if k in tl)
        act = min(0.3 + richness * 0.08 + len(t)/100.0 * 0.3, 1.0)
        stype = "scene_complex" if richness > 3 else ("scene_moderate" if richness > 1 else "scene_sparse")

    elif ch == "CH2":  # Audio Stream - 음향 분류
        if any(k in tl for k in ["음악","music","jazz","bgm","melody","재즈"]):
            act, stype = 0.65, "music"
        elif any(k in tl for k in ["목소리","voice","발표","speaker","대화","conversation","다수","multiple"]):
            act, stype = 0.85, "speech_active"
        elif any(k in tl for k in ["방송","announcement","안내"]):
            act, stype = 0.55, "broadcast"
        elif any(k in tl for k in ["조용","quiet","silent","silence","없음","none"]):
            act, stype = 0.05, "silent"
        else:
            db_m = _re.search(r"(\d+)\s*db", tl)
            if db_m:
                db = int(db_m.group(1))
                act = min(db / 100.0, 1.0)
                stype = "noise_high" if db > 65 else ("noise_moderate" if db > 45 else "noise_low")
            else:
                act, stype = 0.40, "ambient"

    elif ch == "CH3":  # Spatial-Temporal - 이동성
        moving_kw = ["이동","moving","subway","지하철","walking","걷","bus","버스","train","이동 중"]
        static_kw = ["카페","cafe","사무실","office","자택","home","거실","회의실","meeting room"]
        if any(k in tl for k in moving_kw):
            act, stype = 0.80, "mobile"
        elif any(k in tl for k in static_kw):
            act, stype = 0.30, "static_indoor"
        else:
            gps = _re.search(r"\d+\.\d+\s*,\s*\d+\.\d+", tl)
            act = 0.60 if gps else 0.40
            stype = "gps_fixed" if gps else "spatial_general"

    elif ch == "CH4":  # Biometric - 생리적 각성
        hr_m = _re.search(r"(\d+)\s*bpm", tl)
        if hr_m:
            hr = int(hr_m.group(1))
            if hr < 65:   act, stype = 0.20, "bio_resting"
            elif hr < 75: act, stype = 0.45, "bio_calm"
            elif hr < 85: act, stype = 0.70, "bio_focused"
            else:         act, stype = 0.90, "bio_aroused"
        else:
            relax_kw = ["이완","relax","편안","comfortable","무거","heavy"]
            tense_kw = ["긴장","tense","활발","active","alert","응시"]
            if any(k in tl for k in relax_kw):   act, stype = 0.20, "bio_relaxed"
            elif any(k in tl for k in tense_kw): act, stype = 0.75, "bio_alert"
            else:                                 act, stype = 0.50, "bio_neutral"

    elif ch == "CH5":  # Text Input - 언어 의미 신호
        if not t or "(none)" in tl or "(없음)" in tl or "(입력 없음)" in tl:
            act, stype = 0.0, "text_absent"
        else:
            act = score_kw(t, HIGH_INTENT_KW, [], 0.5)
            stype = "text_task" if act > 0.6 else ("text_note" if len(t) > 10 else "text_brief")

    elif ch == "CH6":  # Device Interactions - 상호작용 강도
        min_m = _re.search(r"(\d+)\s*(분|min)", tl)
        sec_m = _re.search(r"(\d+)\s*(초|sec\b)", tl)
        if any(k in tl for k in ["없음","none","터치 없","no touch","idle"]):
            act, stype = 0.05, "device_idle"
        elif min_m:
            mins = int(min_m.group(1))
            act = min(0.3 + mins/20.0, 1.0)
            stype = "device_sustained"
        elif sec_m:
            secs = int(sec_m.group(1))
            act = min(0.2 + secs/60.0, 0.8)
            stype = "device_brief"
        else:
            act = min(len(t) / 40.0, 1.0) * 0.5 + 0.2
            stype = "device_active"

    elif ch == "CH7":  # User Mode / Context — 현재 사용자 상태·모드 (가장 직접적 신호)
        if any(k in tl for k in ["회복","recovery","휴식","rest","이완 모드","recovery mode","쉬는","쉬고","쉼"]):
            act, stype = 0.92, "mode_recovery"
        elif any(k in tl for k in ["학습","study","learn","공부","이해","지식","읽으며","정리 중"]):
            act, stype = 0.88, "mode_learning"
        elif any(k in tl for k in ["집중","focus","deep","깊은","몰입","완전 집중"]):
            act, stype = 0.88, "mode_focus"
        elif any(k in tl for k in ["회의","meeting","발표","presentation","토론","discussion","논의"]):
            act, stype = 0.85, "mode_social"
        elif any(k in tl for k in ["완수","달성","목표","goal","실행","execute","완료","complete","업무 완수","핵심"]):
            act, stype = 0.85, "mode_task"
        elif any(k in tl for k in ["출근","commute","이동","transit","준비","prepare","가는","향하는"]):
            act, stype = 0.72, "mode_transit"
        else:
            act = score_kw(t, HIGH_INTENT_KW + POSITIVE_KW, NEGATIVE_KW, 0.5)
            stype = "mode_general"

    elif ch == "CH8":  # Environmental Attributes - 환경 적합성
        lux_m  = _re.search(r"(\d+)\s*lux", tl)
        db_m   = _re.search(r"(\d+)\s*db", tl)
        temp_m = _re.search(r"(\d+)\s*[°c℃]", tl)
        score = 0.5
        if lux_m:
            lux = int(lux_m.group(1))
            score += 0.15 if 200 <= lux <= 600 else -0.10
        if db_m:
            db = int(db_m.group(1))
            score += 0.20 if db < 45 else (0.0 if db < 65 else -0.15)
        if temp_m:
            temp = int(temp_m.group(1))
            score += 0.10 if 18 <= temp <= 24 else -0.05
        act = round(max(0.1, min(score, 1.0)), 3)
        stype = "env_optimal" if act > 0.7 else ("env_moderate" if act > 0.4 else "env_suboptimal")
    else:
        act, stype = 0.50, "unknown"

    return {"activation": round(act, 3), "signal_type": stype, "raw": t}


def build_features_from_raw(raw: Dict[str, Any]) -> Dict[str, Any]:
    signal = extract_signal(raw["channel_id"], raw.get("raw_ref", ""))
    return {
        "feature_ref":   f"feature://{raw['channel_id']}/{raw['seu_id']}",
        "raw_ref":       raw["raw_ref"],
        "raw_hash":      raw["raw_hash"],
        "quality_flags": raw.get("quality_flags", []),
        "signal":        signal,
    }

def build_channel_meta(channel_id: str, features: Dict[str, Any]) -> Dict[str, Any]:
    sig  = features.get("signal", {})
    act  = sig.get("activation", 0.5)
    stype = sig.get("signal_type", "unknown")
    conf = round(act * 0.7 + 0.3 * (0.8 if stype != "unknown" else 0.4), 3)
    return {
        "channel_id":    channel_id,
        "confidence":    conf,
        "activation":    act,
        "signal_type":   stype,
        "summary":       f"{channel_id}:{stype}@{act:.2f}",
        "source_channels": [channel_id],
        "evidence_refs": [
            {"kind": "raw_ref",    "ref": features["raw_ref"]},
            {"kind": "raw_hash",   "ref": features["raw_hash"]},
            {"kind": "signal",     "ref": stype},
            {"kind": "activation", "ref": str(act)},
        ],
    }

def merge_evidence(metas: Dict, ch_list: List[str]) -> List[Dict]:
    out = []
    for ch in ch_list:
        out.extend(metas[ch].get("evidence_refs", []))
    return out


# ── 3단계: T·C·I·E 축 합성 ───────────────────
def syn_t(t_raw: Dict) -> Dict:
    return {
        "ts_start":    t_raw.get("ts_start", ""),
        "ts_end":      t_raw.get("ts_end", ""),
        "duration_ms": t_raw.get("extra", {}).get("duration_ms"),
        "value":       t_raw.get("ts_start", "")[:19],
    }

def syn_c(metas: Dict, raws: Dict) -> Dict:
    srcs = ["CH1","CH6","CH8"]
    v1   = raws.get("CH1","")[:15]
    m8   = metas["CH8"]["signal_type"]
    ctx  = []
    if v1:    ctx.append(v1)
    if "social"    in metas["CH6"]["signal_type"]: ctx.append("social")
    if "focus"     in m8: ctx.append("focus-context")
    elif "recovery" in m8: ctx.append("rest-context")
    elif "learning" in m8: ctx.append("learning-context")
    return {
        "value":           " | ".join(ctx) if ctx else "ambient-context",
        "confidence":      round(sum(metas[c]["confidence"] for c in srcs)/3, 3),
        "source_channels": srcs,
        "evidence_refs":   merge_evidence(metas, srcs),
    }

def syn_i(metas: Dict, raws: Dict) -> Dict:
    srcs    = ["CH3","CH7","CH2"]
    ia      = metas["CH7"]["activation"]
    la      = metas["CH3"]["activation"]
    combined = round(ia*0.6 + la*0.4, 3)
    level   = "high-intent" if combined > 0.7 else ("moderate-intent" if combined > 0.5 else "low-intent")
    raw7    = raws.get("CH7","")[:20]
    return {
        "value":           f"{level}: {raw7}" if raw7 else level,
        "intensity":       combined,
        "confidence":      round(sum(metas[c]["confidence"] for c in srcs)/3, 3),
        "source_channels": srcs,
        "evidence_refs":   merge_evidence(metas, srcs),
    }

def syn_e(metas: Dict, raws: Dict) -> Dict:
    srcs    = ["CH4","CH5"]
    valence = metas["CH4"]["activation"]
    body    = metas["CH5"]["signal_type"]
    if   valence > 0.7 and "relax" in body: label = "calm-positive"
    elif valence > 0.7:                      label = "energized-positive"
    elif valence > 0.5:                      label = "mild-positive"
    elif valence > 0.4:                      label = "neutral"
    elif "alert" in body:                    label = "tense-alert"
    else:                                    label = "mild-negative"
    raw4 = raws.get("CH4","")[:20]
    return {
        "value":           f"{label}: {raw4}" if raw4 else label,
        "valence":         round(valence, 3),
        "body_state":      body,
        "confidence":      round(sum(metas[c]["confidence"] for c in srcs)/2, 3),
        "source_channels": srcs,
        "evidence_refs":   merge_evidence(metas, srcs),
    }


# ── 4단계: M축 합성 (핵심) ───────────────────
MODES = {
    "deep_focus":     {"label": "Deep Focus",     "label_ko": "깊은 집중",   "color": "#00E5FF"},
    "active_social":  {"label": "Active Social",  "label_ko": "사회적 활성", "color": "#76FF03"},
    "learning":       {"label": "Learning",       "label_ko": "학습 모드",   "color": "#FFD740"},
    "rest_recovery":  {"label": "Rest & Recovery","label_ko": "휴식·회복",   "color": "#CE93D8"},
    "task_execution": {"label": "Task Execution", "label_ko": "과제 실행",   "color": "#FF6D00"},
    "alert_standby":  {"label": "Alert Standby",  "label_ko": "경계 대기",   "color": "#FF4444"},
    "ambient":        {"label": "Ambient",         "label_ko": "배경 모드",   "color": "#3A5060"},
}

def synthesize_m(t, c, i, e, metas, raws) -> Dict:
    act = {ch: metas[ch]["activation"]  for ch in CHANNELS}
    sig = {ch: metas[ch]["signal_type"] for ch in CHANNELS}

    intent  = i.get("intensity", 0.5)
    valence = e.get("valence",   0.5)
    m8      = sig["CH8"]
    audio   = sig["CH2"]
    # 환경 조용함 여부 (CH8 환경 + CH2 음성)
    db_quiet = act["CH8"] > 0.5 or "silent" in audio or "music" in audio

    # CH7 = User Mode (가장 직접적인 사용자 모드 신호)
    ch7 = sig["CH7"]
    is_recovery = "recovery" in ch7
    is_learning  = "learning" in ch7
    is_focus     = "focus"    in ch7
    is_social    = "social"   in ch7
    is_task      = "task"     in ch7
    is_transit   = "transit"  in ch7
    ch7_known    = any([is_recovery, is_learning, is_focus, is_social, is_task, is_transit])

    # 백서 #06 기준: CH7(사용자모드)=1차 결정자, 나머지 7채널=보조 신호
    # CH7이 명확할수록 해당 모드에 압도적 가중치
    scores: Dict[str, float] = {
        # 깊은 집중: CH7=focus(1차) + CH4생체각성 + CH6기기지속 + CH5텍스트 + CH3정적
        "deep_focus":     (0.92 if is_focus else 0.0 if is_recovery else 0.08) * 0.55
            + act["CH4"]*0.15 + act["CH6"]*0.15 + act["CH5"]*0.10 + (1-act["CH3"])*0.05,
        # 사회 활성: CH7=social(1차) + CH2음성 + CH6기기
        "active_social":  (0.92 if is_social else 0.0 if is_recovery else 0.08) * 0.55
            + (0.85 if "speech" in audio else 0.1)*0.25 + act["CH6"]*0.20,
        # 학습: CH7=learning(1차) + CH5텍스트 + CH1영상 + CH3정적
        "learning":       (0.92 if is_learning else 0.0 if is_recovery else 0.08) * 0.55
            + act["CH5"]*0.20 + act["CH1"]*0.15 + (1-act["CH3"])*0.10,
        # 휴식·회복: CH7=recovery(1차) + CH4이완 + CH2음악/무음 + CH6비활성
        "rest_recovery":  (0.92 if is_recovery else 0.0 if ch7_known else 0.08) * 0.55
            + (1-act["CH4"])*0.20 + (0.85 if "music" in audio or "silent" in audio else 0.1)*0.15 + (1-act["CH6"])*0.10,
        # 과제 실행: CH7=task(1차) + CH5텍스트 + CH6기기
        "task_execution": (0.92 if is_task else 0.0 if is_recovery else 0.08) * 0.55
            + act["CH5"]*0.25 + act["CH6"]*0.20,
        # 경계 대기: CH4고각성 + CH8환경불량 + CH3이동 (CH7 미지정 시)
        "alert_standby":  (0.0 if ch7_known else 1.0) * (
            act["CH4"]*0.40 + (1-act["CH8"])*0.35 + (0.8 if "mobile" in sig["CH3"] else 0.1)*0.25),
        # 배경: CH7 미지정 + 전체 활성 낮음
        "ambient":        (0.0 if ch7_known else 1.0) *
            max(0.0, 0.55 - sum(act.values())/len(act)) * 1.5,
    }

    best  = max(scores, key=lambda k: scores[k])
    info  = MODES[best]
    avg_a = sum(act.values()) / len(act)

    # 한/영 서술 생성
    narr  = _narrative(best, act, sig, intent, valence)

    return {
        "status":               "synthesized",
        "cognitive_mode":       best,
        "mode_label":           info["label"],
        "mode_label_ko":        info["label_ko"],
        "mode_color":           info["color"],
        "mode_score":           round(scores[best], 3),
        "mode_scores":          {k: round(v, 3) for k, v in scores.items()},
        "channel_activations":  {ch: {"activation": act[ch], "signal_type": sig[ch]} for ch in CHANNELS},
        "narrative":            narr,
        "source":               "all_8_channels",
        "synthesis_basis": {
            "intent_intensity": intent,
            "emotion_valence":  valence,
            "social_active":    act["CH6"] > 0.6,
            "body_state":       sig["CH5"],
            "audio_type":       audio,
            "meta_context":     m8,
            "avg_activation":   round(avg_a, 3),
        },
    }

def _narrative(mode, act, sig, intent, valence) -> Dict[str, str]:
    a = act
    s = sig
    T = {
        "deep_focus":     {
            "en": f"High intent (CH7={a['CH7']:.2f}) with suppressed social input (CH6={a['CH6']:.2f}) and {s['CH2']} auditory environment. Cognitive resources consolidated for sustained attention.",
            "ko": f"강한 의도 신호(CH7={a['CH7']:.2f})와 낮은 사회 입력(CH6={a['CH6']:.2f}). 청각={s['CH2']}. 인지 자원이 지속 주의에 집중됨."},
        "active_social":  {
            "en": f"Strong social activation (CH6={a['CH6']:.2f}) with {s['CH2']} audio. Positive valence ({valence:.2f}) supports interpersonal engagement.",
            "ko": f"사회 채널 강활성(CH6={a['CH6']:.2f}), 청각={s['CH2']}. 긍정 감정(valence={valence:.2f})이 대인 상호작용 지지."},
        "learning":       {
            "en": f"Meta-context signals {s['CH8']}. Language active (CH3={a['CH3']:.2f}), visual intake (CH1={a['CH1']:.2f}). Knowledge construction in progress.",
            "ko": f"메타맥락={s['CH8']}. 언어 활성(CH3={a['CH3']:.2f}), 시각 흡수(CH1={a['CH1']:.2f}). 지식 구성 진행 중."},
        "rest_recovery":  {
            "en": f"Recovery meta-signal ({s['CH8']}) with body state={s['CH5']}. Intent pressure low ({intent:.2f}). System in restoration mode.",
            "ko": f"회복 메타신호({s['CH8']}), 신체={s['CH5']}. 의도 압력 낮음({intent:.2f}). 시스템 복원 모드 진입."},
        "task_execution": {
            "en": f"High intent (CH7={a['CH7']:.2f}) with strong language output (CH3={a['CH3']:.2f}). Goal-directed behaviour sequence detected.",
            "ko": f"높은 의도(CH7={a['CH7']:.2f}), 언어 출력(CH3={a['CH3']:.2f}). 목표 지향 행동 시퀀스 감지."},
        "alert_standby":  {
            "en": f"Negative valence ({valence:.2f}) with body tension ({s['CH5']}). Low intent ({intent:.2f}) suggests unresolved state.",
            "ko": f"부정 감정(valence={valence:.2f}), 신체 긴장({s['CH5']}). 낮은 의도({intent:.2f}) — 미해결 상태."},
        "ambient":        {
            "en": f"All channels below threshold (avg={sum(act.values())/len(act):.2f}). No dominant mode. Background processing.",
            "ko": f"전채널 활성 임계 이하(avg={sum(act.values())/len(act):.2f}). 우세 모드 없음. 배경 처리 상태."},
    }
    return T.get(mode, {"en": "Unknown mode.", "ko": "알 수 없는 모드."})


# ── 5단계: 전체 큐브 합성 ────────────────────
def synthesize_cube(seu_id: str) -> Dict:
    metas = {}
    for ch in CHANNELS:
        k = key(seu_id, ch)
        if k not in META_STORE:
            raise HTTPException(400, detail=f"missing channel meta for {ch}")
        metas[ch] = META_STORE[k]

    raws = {ch: get_raw(seu_id, ch).get("raw_ref","") for ch in CHANNELS}
    t_raw = get_raw(seu_id, "CH4")

    t = syn_t(t_raw)
    c = syn_c(metas, raws)
    i = syn_i(metas, raws)
    e = syn_e(metas, raws)
    m = synthesize_m(t, c, i, e, metas, raws)

    return {
        "seu_id": seu_id,
        "t": t, "c": c, "i": i, "e": e, "m": m,
        "channel_metas": {
            ch: {
                "activation":  metas[ch]["activation"],
                "confidence":  metas[ch]["confidence"],
                "signal_type": metas[ch]["signal_type"],
            } for ch in CHANNELS
        },
        "pai": {
            "created_at":      now_iso(),
            "pipeline_status": "cube_written",
            "cognitive_mode":  m["cognitive_mode"],
            "mode_label":      m["mode_label"],
            "mode_label_ko":   m["mode_label_ko"],
        },
    }


def emit(event_type: str, payload: Dict) -> None:
    EVENT_BUS.append({"event_id": str(uuid.uuid4()), "event_type": event_type,
                      "emitted_at": now_iso(), "payload": payload})


# ── Models ───────────────────────────────────
class SEUTime(BaseModel):
    ts_start: str; ts_end: str; duration_ms: int

class SEUCreateRequest(BaseModel):
    seu_id: Optional[str] = None
    time: SEUTime; device_id: str; privacy_level: str = Field(default="raw_first")

class SEUCreateResponse(BaseModel):
    seu_id: str; status: str; expected_channels: List[str]

class ChannelRawRegisterRequest(BaseModel):
    seu_id: str; channel_id: str; ts_start: str; ts_end: str; raw_ref: str
    raw_hash: Optional[str] = None
    encryption_key_id: str = "key_default"; retention_policy_id: str = "retain_default"
    consent_policy_id: str = "consent_default"
    quality_flags: List[str] = Field(default_factory=list)
    extra: Dict[str, Any] = Field(default_factory=dict)

class ChannelRawRegisterResponse(BaseModel):
    raw_id: str; status: str


# ── Routes ───────────────────────────────────
@app.post("/seu", response_model=SEUCreateResponse)
def create_seu(req: SEUCreateRequest):
    seu_id = req.seu_id or f"seu_{now_iso()}_{uuid.uuid4().hex[:6]}"
    ensure_seu(seu_id)
    emit("seu.created", {"seu_id": seu_id, "time": req.time.model_dump(),
                         "device_id": req.device_id, "privacy_level": req.privacy_level})
    return SEUCreateResponse(seu_id=seu_id, status="created", expected_channels=CHANNELS)

@app.post("/channel/raw", response_model=ChannelRawRegisterResponse)
def register_raw(req: ChannelRawRegisterRequest):
    if req.channel_id not in CHANNELS:
        raise HTTPException(400, detail="invalid channel_id")
    ensure_seu(req.seu_id)
    raw_id   = f"raw_{uuid.uuid4().hex}"
    raw_hash = req.raw_hash or stable_hash(req.raw_ref)
    rec = {**req.model_dump(), "raw_id": raw_id, "raw_hash": raw_hash, "created_at": now_iso()}
    RAW_STORE[raw_id] = rec
    RAW_BY_SEU[req.seu_id][req.channel_id] = raw_id
    emit("channel.raw_registered", {"seu_id": req.seu_id, "channel_id": req.channel_id,
                                     "raw_id": raw_id, "raw_ref": req.raw_ref, "raw_hash": raw_hash})
    return ChannelRawRegisterResponse(raw_id=raw_id, status="registered")

@app.post("/channel/meta/{seu_id}/{channel_id}")
def compute_meta(seu_id: str, channel_id: str):
    if channel_id not in CHANNELS:
        raise HTTPException(400, detail="invalid channel_id")
    raw  = get_raw(seu_id, channel_id)
    k    = key(seu_id, channel_id)
    feat = build_features_from_raw(raw)
    FEATURE_STORE[k] = feat
    meta = build_channel_meta(channel_id, feat)
    META_STORE[k] = meta
    emit("channel.meta_created", {"seu_id": seu_id, "channel_id": channel_id, "meta_key": k})
    return {"seu_id": seu_id, "channel_id": channel_id, "meta": meta}

@app.post("/cube/build")
def build_cube(payload: Dict[str, Any]):
    seu_id = payload.get("seu_id")
    if not seu_id:
        raise HTTPException(400, detail="seu_id required")
    if not all_channels_present(seu_id):
        raise HTTPException(400, detail="not all channel raws present")
    for ch in CHANNELS:
        k = key(seu_id, ch)
        if k not in META_STORE:
            raw  = get_raw(seu_id, ch)
            feat = build_features_from_raw(raw)
            FEATURE_STORE[k] = feat
            META_STORE[k]    = build_channel_meta(ch, feat)
    cube = synthesize_cube(seu_id)
    CUBE_STORE[seu_id] = cube
    emit("cube.created", {"seu_id": seu_id, "cognitive_mode": cube["m"]["cognitive_mode"],
                          "mode_label": cube["m"]["mode_label"], "mode_score": cube["m"]["mode_score"]})
    return {"seu_id": seu_id, "status": "cube_written", "cube": cube}

@app.get("/cube/{seu_id}")
def get_cube(seu_id: str):
    if seu_id not in CUBE_STORE:
        raise HTTPException(404, detail="cube not found")
    return CUBE_STORE[seu_id]

@app.get("/events")
def events(limit: int = 50):
    return {"events": EVENT_BUS[-limit:]}

@app.get("/")
def root():
    return {"service": "PAI 8-Channel -> Meta Cube System (MVP)", "docs": "/docs", "health": "/health"}

@app.get("/health")
def health():
    return {"status": "ok"}
