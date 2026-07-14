# WP#30: Network Equipment RTL & Physical Design (Switching/Routing)

**Velsanet Architecture Group | Technical Design Document**

> Matrix Switching/Routing RTL · Register Interfaces · Semiconductor Physical Implementation

---

## 📋 Overview

RTL and physical-design counterpart to WP#26 for node-level (inter-node) switching and routing. Resolves WP#29 OI-29-01, OI-29-03, OI-29-20.

- **Version**: v1.5 │ 2026
- **Classification**: Internal Draft — 18 open items remain
- **Extends**: WP#29 §3, §10.7.11; follows WP#26 RTL/FPGA-ASIC pattern

---

## 📁 Structure

| Section | Content |
|---------|---------|
| 3 | Matrix RTL architecture + **MONITOR_CH** (always-on link monitoring) |
| 4 | Node ↔ Dedicated Equipment register interface (WP#24 §3 mapping) |
| 5 | Core Stack negotiation message encoding (128-bit, 7 types) |
| 6 | NPU–Matrix command interface (reuses MONITOR_CH registers) |
| 7 | Matrix physical implementation (FPGA→ASIC, die-level) |
| 8 | Timing analysis (latency budgets) |
| 9 | Hardware validation strategy |

---

## 🔑 Key Specs

### MONITOR_CH Register Set (3 × 32-bit)

| Register | Function |
|----------|----------|
| **MONITOR_EVENT_REG** | LOS/BER events, FACE_ID, ACTION (0=no action, 1=alternate path, 2=Master-Standby, 3=negotiated config) |
| **MONITOR_STATUS_REG** | EVENT_COUNT, LAST_EVENT_TYPE, LINK_UP |
| **MONITOR_CONFIG_REG** | SCALE_UP/DOWN thresholds, BER level, EVENT_REPORT_EN, MONITOR_EN |

### Core Stack Negotiation Messages (128-bit)

| MSG_TYPE | Name | Direction |
|----------|------|-----------|
| 0x1 | Attach | PAI/EAI → O8 |
| 0x2 | Handshake | Bidirectional |
| 0x3 | Activation | Bidirectional |
| 0x4 | Renegotiation | O8 → PAI/EAI |
| 0x5 | Release | PAI/EAI → O8 |
| 0x6 | Release_Ack | O8 → PAI/EAI |
| 0x7 | Force_Release | O8 → PAI/EAI |

### Node ↔ Dedicated Equipment Register Mapping

| WP#24 Register | Direction | Use |
|----------------|-----------|-----|
| DEMUX_LANE_CFG | Node → DE | PAI/EAI mode |
| SEU_WINDOW_CTRL | Node → DE | SEU window |
| SEU_CHANNEL_COMPLETE | DE → Node | Completeness bitmap |
| MUX_CH_MAP | Node → DE | Bundle mapping |
| DEMUX_FAULT_EXCLUDE | DE → Node | Faulty cores bitmap |

---

## 📊 Open Items (18)

| Key Open Items | Section | Status |
|----------------|---------|--------|
| OI-30-01 | 4 | Slot 2 wire format + handshake/timing open |
| OI-30-14 | 5.3 | Payload sub-field widths (CAPABILITY_FLAGS, LAYER_ID) |
| OI-30-04 | 3 | Matrix RTL module breakdown not yet drafted |
| OI-30-05 | 7.1 | FPGA device narrowed to VU19P/newer (GTM-class); specific part open |
| OI-30-06 | 7.3/7.4 | Die-level floorplan + power/thermal budget open |
| OI-30-07 | 8 | Target clock frequency / timing budgets open |
| OI-30-16 | 6.4 | NPU→Matrix command latency budget open |
| OI-30-17 | 7.2 | **RESOLVED** — 16nm-class Phase 1; vendor-agnostic qualification (§7.2.1) |
| OI-30-20 | 9.4 | Self-healing field validation pass criteria open |

---

## 📜 License

MIT License

---

**Republic of Korea | Velsanet Architecture Group**
