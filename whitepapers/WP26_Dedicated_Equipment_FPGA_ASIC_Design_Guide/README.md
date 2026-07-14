# WP#26: Dedicated Equipment FPGA/ASIC Design Guide

**Velsanet Architecture Group | Technical Design Document**

> Two RTL Engine Templates — SEU1 (Common) · SEU2 (EAI-Only) — FPGA → ASIC

---

## 📋 Overview

Implementation guide for SEU1 and SEU2 as separate RTL templates, from FPGA prototyping to ASIC production.

- **Version**: v1.7 (R8) │ 2026
- **Classification**: Public - Open Specification
- **Extends**: WP#24, WP#25 R1

---

## 📁 Structure

| Section | Content |
|---------|---------|
| 4 | **SEU1 Engine** — DEMUX → Assembly → WORM Write Gate → Timestamp |
| 5 | **SEU2 Engine** — MUX → Write-Back → CH11 Safety → Independent Clock |
| 6 | Cross-engine timing (no functional CDC between SEU1/SEU2) |
| 7 | 800G optical interface (SerDes/PHY, lane grouping) |
| 8 | FPGA→ASIC migration (volume/cost, implementation style, process node) |
| 9 | Verification plan (MVP → RTL sim → FPGA → isolation → ASIC) |
| 10 | **Open Items Register** (17 items, with dependencies & status) |

---

## 🔑 Key Specs

| Engine | Deployment | Cores | Clock | PTP Domain |
|--------|------------|-------|-------|------------|
| **SEU1** | Every PAI + EAI | 1 | PTP master | 4 |
| **SEU2** | EAI only | 1–3 | Independent OSC | 5 |

**FPGA Target**: Xilinx UltraScale+ (prototype)  
**ASIC Target**: Mature cost-optimized node (not yet selected — OI-04)

---

## 📊 Open Items Status (R8)

| Status | Items |
|--------|-------|
| **Closed** | OI-03 (PTP jitter), OI-09 (CDC 2-flop), OI-14 (terminology) |
| **Drafted RTL** | OI-05 (WORM gate), OI-06a (Layer Lock arbiter) — compiled & simulated |
| **Narrowed** | OI-01 (window value fixed; cycle count awaits clock) |
| **Still Open** | OI-02, OI-04, OI-06b, OI-07, OI-08, OI-10, OI-11, OI-12, OI-13, OI-15, OI-16 |

**Critical Path**: OI-04 → OI-07 → OI-08 = 5–10 weeks (after OI-04 clears)

---

## 📈 Readiness Score

| Dimension | Rating | Blocked By |
|-----------|--------|------------|
| RTL Coding | ★☆☆☆☆ | OI-04 (process node) + OI-01 (clock freq) |
| ASIC Design | ★☆☆☆☆ | OI-04 (process node) |

---

## 📁 Contingent Addenda

- **WP#26.1** — RTL FSM details (until OI-05/06/09/10/11)
- **WP#26.2** — Verification & DFT (until OI-08/13/15/16)
- **WP#26.3** — 800G PHY integration (until OI-07)

---

## 📜 License

MIT License

---

**Republic of Korea | Velsanet Architecture Group**
