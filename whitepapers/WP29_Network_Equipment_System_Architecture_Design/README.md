# WP#29: Network Equipment System Architecture Design (SAD)

**Velsanet Architecture Group | Technical Design Document**

> O8 Connectivity & Placement Spec · Multi-Layer Multi-Plane Matrix · Node Operational Architecture

---

## 📋 Overview

System Architecture Design for Velsanet network equipment at the O8/D12/I20 node level. Fulfills WP#25 R1-4/R1-5 deferrals and applies the Multi-Layer Multi-Plane Matrix principle to node equipment.

- **Version**: v1.10 │ 2026
- **Classification**: Public - Open Specification
- **Absorbs**: WP#25 R1-4/R1-5, Pending Updates Log Table 1, Compendium §8

---

## 📁 Structure

| Section | Content |
|---------|---------|
| 3 | Multi-Layer Multi-Plane Matrix (photonic → node → intra-node) |
| 4 | O8/D12/I20 block architecture + hierarchical Schlegel projection + Velsa |
| 4.6 | **Hierarchical core scaling** (O8=1,536 / D12=9,216 / I20=61,440) |
| 5 | Geographic placement (D12 = f(density), I20 = national only) |
| 6 | Connectivity Plane (Face 1=hypercube, Face 2=cooperation) + NPU task model |
| 7 | Core Stack negotiation protocol (Attach/Release/Force_Release) |
| 10 | Node physical architecture + **O8 operational architecture** |

---

## 🔑 Key Specs

### Hierarchical Core Scaling (R8 — supersedes hardware uniformity)

| Node | Faces | Layers | Bundles | Cores/Face | Total Cores |
|------|-------|--------|---------|------------|-------------|
| **O8** | 8 | 4 | 4 | 192 | **1,536** |
| **D12** | 12 | 8 | 8 | 768 | **9,216** |
| **I20** | 20 | 16 | 16 | 3,072 | **61,440** |

### O8 Slot Allocation (8 slots × 192 cores = 1,536 total)

| Slot | Allocation |
|------|------------|
| **Slot 1** | 12 control (hypercube/NPU) + 180 Pass path to Slot 2 |
| **Slot 2** | 12 control (PAI/EAI signaling) + 180 Pass path to Slot 1 |
| **Slot 3–4** | Inbound data reserve |
| **Slot 5** | 12 outbound control + 180 Pass path |
| **Slot 6–8** | External expansion (D12/I20/H6/T4) |

### Operational Modes

| Mode | Description |
|------|-------------|
| **Mode A** | PAI/EAI attached (full cognitive mode) |
| **Mode B** | No PAI/EAI attached (pure hypercube switch) |
| **Master/Standby** | Must be in Mode B (no PAI/EAI) — R10 |

### Core Stack Negotiation (R9)

| Message | Direction | Purpose |
|---------|-----------|---------|
| Attach | PAI/EAI → O8 | Connection request |
| Release | PAI/EAI → O8 | Intentional disconnect |
| Release_Ack | O8 → PAI/EAI | Confirms release |
| Force_Release | O8 → PAI/EAI | Node-initiated forced disconnect |

---

## 📊 Open Items (22 total)

| Key Open Items | Section |
|----------------|---------|
| OI-29-01 | Node ↔ Dedicated Equipment interface (candidate WP#30) |
| OI-29-04 | Density threshold for D12 aggregation (qualitative only) |
| OI-29-07 | D12/I20 chassis height (depends on density) |
| OI-29-10 | H6↔O8 link core count (144 vs 120) + EAI attach path |
| OI-29-13/14 | Mode B timeout and transition latency |
| OI-29-16/17/18 | Master/Standby selection, trigger, reversibility |
| OI-29-20 | NPU–Matrix command interface |
| OI-29-22 | T4/H6 core-scaling figures (not confirmed) |
| OI-29-23 | D12/I20 slot-internal allocation (12+180 not yet scaled) |
| OI-29-24 | Mode A/B check for Master/Standby (static vs dynamic) |

---

## 📜 License

MIT License

---

**Republic of Korea | Velsanet Architecture Group**
