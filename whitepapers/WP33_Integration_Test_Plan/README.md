# WP#33: Integration Test Plan

**Velsanet Architecture Group | Technical Design Document**

> Multi-Node Connectivity · Fault Recovery Integration · Performance · Cross-Document Acceptance

---

## 📋 Overview

System-level integration and acceptance test plan for Velsanet network equipment. Tests multiple assembled O8/D12/I20 nodes operating together — distinct from WP#30 §9 (single-node validation) and WP#28 Table 6-1 (single-EAI field validation).

- **Version**: v1.2 │ 2026
- **Classification**: Internal Draft — 7 open items (all Ready for Hardware)
- **Extends**: WP#29 §4/§10.7.2/§10.7.10, WP#26 §7/§9, WP#28 Table 6-1

---

## 📁 Structure

| Section | Content |
|---------|---------|
| 3 | Multi-node connectivity (hypercube topology, Mode A/B requirements) |
| 4 | Fault recovery / self-healing integration (alternate-path, Master-Standby, MAC fallback) |
| 5 | Performance / throughput test (800G end-to-end) |
| 6 | Cross-document acceptance (WP#26/30/31/32/34 consistency) |

---

## 🔑 Key Specs

### Node Combination & Mode Requirements (WP#29 R10)

| Node Combination | Connection Type | Mode Requirement |
|------------------|-----------------|------------------|
| O8 ↔ O8 | Same tier | Mode A permitted; Master/Standby → Mode B |
| O8 ↔ D12 | Upward | Master/Standby O8 → Mode B |
| D12 ↔ D12 | Same tier | Mode A permitted; Master/Standby → Mode B |
| D12 ↔ I20 | Upward | Master/Standby D12 → Mode B |
| I20 ↔ I20 | Same tier | Mode A permitted; Master/Standby → Mode B |

### Cross-Document Acceptance Checks (Table 6-1)

| Check | Documents | What It Confirms |
|-------|-----------|------------------|
| SEU1 RTL ↔ Matrix RTL | WP#26 §4 vs WP#30 §4 | Register mapping correctness |
| BOM ↔ PCB placement | WP#31 §8 vs WP#32 §3 | Parts placeable per board layout |
| Timing ↔ signal integrity | WP#30 §8 vs WP#32 §4 | 800G PAM4 traces meet timing budget |
| Single-unit ↔ multi-node | WP#28 Table 6-1 vs WP#33 §4 | Dual E2E isolation holds under multi-node faults |
| MAC verification | WP#34 §3.4.3 vs WP#33 §4 | MAC alignment meets targets; auto-control fallback reuses MONITOR_CH/NPU |

---

## 📊 Open Items (7 — All Ready for Hardware)

| ID | Section | Open Item |
|----|---------|-----------|
| OI-33-01 | 3 | Multi-node test bed configuration, node counts, pass criteria |
| OI-33-02 | 4 | Multi-node fault-injection method, recovery-time measurement, pass criteria |
| OI-33-03 | 5 | System-level throughput/latency test (blocked on WP#30 OI-30-16) |
| OI-33-04 | 6 | Specific test procedures for Cross-Document Acceptance checks |
| OI-33-05 | 4.1 | Mode B verification method for Master/Standby nodes |
| OI-33-06 | 6 | MAC verification test procedure (WP#34 §3.4.3) |
| OI-33-07 | 4.2 | MAC auto-control fallback fault-injection method + pass criteria |

---

## 📜 License

MIT License

---

**Republic of Korea | Velsanet Architecture Group**
