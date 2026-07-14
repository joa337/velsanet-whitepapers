# WP#25 R1: SEU1 / SEU2 Synchronization Specification

**Velsanet Architecture Group | Technical Design Document**

> SEU1 (Common Base) · SEU2 (EAI-Only Specialized Spec)

---

## 📋 Overview

Wire-level record format, PTP synchronization profile, and channel completeness algorithm for the SEU synchronization pipeline.

- **Version**: v1.1 (R1) │ 2026
- **Classification**: Public - Open Specification
- **Extends**: Att2 §5.3/§6.1, WP#24 §3.2/§5.3/§6.1

---

## 🔑 Key Changes in R1

| # | Change |
|---|--------|
| R1-1 | "Packet" → "SEU record" (HBM-resident, not transmitted) |
| R1-2 | SEU2 redefined as structurally distinct (not an extension) |
| R1-3 | 1 optical core = 1 SEU1; EAI requires second core for SEU2 |
| R1-4 | O8/D12/I20 placement out of scope |
| R1-5 | Core Stack activation via negotiation (not fixed table) |
| R1-6 | PAI/EAI as states, not fixed hardware |

---

## 📁 Structure

**Part A — SEU1 (Common Base: PAI + EAI)**
- 8-channel sensory structure (CH1–CH8)
- 1 optical core (fixed)
- PTP Domain 4
- Mandatory channels: CH1 (Video), CH3 (Spatial-Temporal)
- Adaptive window: 800/1000/1500ms

**Part B — SEU2 (EAI-Only Control)**
- 8-channel control structure (CH9–CH16)
- 1 core (Layer 1) + up to 2 cores (Layer 3, conditional)
- PTP Domain 5 (independent oscillator)
- Sub-types: SEU2-A (Actuation) · SEU2-B (Cognition Report)
- Mandatory channels: CH9 (Command), CH13 (Mission State)
- Excluded: CH11 (Safety), CH14–CH16

---

## 🔍 PTP Profile

| Parameter | SEU1 | SEU2 |
|-----------|------|------|
| Domain | 4 | 5 |
| Sync Interval | 16/s | 16/s |
| Accuracy Budget | < 100ns | < 100ns |

---

## 📊 EAI Core Stack

| Layer | Type | Cores | Condition |
|-------|------|-------|-----------|
| 0 — Base | SEU1 | 1 | Always present |
| 1 — Control | SEU2-A | 1 | Negotiated |
| 2 — Redundancy | SEU1 | +0–3 | Fault tolerance required |
| 3 — Reporting | SEU2-B | +0–2 | Layer 1 active + D12 exists |

**Total: PAI = 1 core · EAI baseline = 2 cores · EAI max = 7 cores**

---

## 📜 License

MIT License

---

**Republic of Korea | Velsanet Architecture Group**
