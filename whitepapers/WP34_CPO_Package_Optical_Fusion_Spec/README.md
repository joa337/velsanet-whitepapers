# WP#34: CPO Package & Optical Fusion Process Specification

**Velsanet Architecture Group | Technical Design Document**

> Chip-Level MOCT–Matrix Bonding · MEMS Alignment Process · Optical Fusion Process · Supersedes Board-Edge Assumption

---

## 📋 Overview

Translates WP#03's MOCT definition into a physical package specification. Defines Co-Packaged Optics (CPO) structure where MOCT bonds directly to the Matrix switch fabric's semiconductor package — not via board-edge connectors.

- **Version**: v0.8 │ 2026
- **Classification**: Internal Draft — 20 open items remain
- **Extends**: WP#03 §6/§8, WP#29 §4.6 Table 4-4
- **Supersedes**: WP#31 OI-31-11, WP#32 OI-32-08 (board-edge QSFP-DD is bring-up only)

---

## 📁 Structure

| Section | Content |
|---------|---------|
| 3 | CPO package definition (core-to-matrix mapping, tier-specific ribbons, DWDM interface, MAC) |
| 4 | MEMS alignment process (static MEMS, DWDM-internal alignment) |
| 5 | Optical fusion process (pure ribbon, smart-ribbon variants) |
| 6 | Relationship to WP#31/WP#32 + DWDM vendor qualification requirements |

---

## 🔑 Key Specs

### Tier-Specific Ribbon Variants (Table 3-3a)

| Parameter | O8 | D12 | I20 |
|-----------|-----|-----|-----|
| Reach | ≤10 km | tens–hundreds km | hundreds–thousands km |
| Faces | 8 | 12 | 20 |
| Cores/face | 192 | 768 | 3,072 |
| Total cores | 1,536 | 9,216 | 61,440 |
| Total bandwidth | 1.2 Pbps | 7.4 Pbps | 49.2 Pbps |
| Ribbon composition | Pure MOCT | MOCT + DWDM + EDFA | MOCT + DWDM + high-power EDFA + DCF |

### MOCT Alignment Coupler (MAC) — D12/I20 Only

| Parameter | Target |
|-----------|--------|
| Alignment method | V-groove / pin-hole / MEMS stage |
| Locking method | Clamp / screw / magnetic latch |
| Insertion loss | ≤0.1–0.2 dB (approaching fusion-splice) |
| vs. fusion | ≤0.05 dB |
| vs. conventional MPO | ≤0.5 dB |

### MAC Auto-Monitoring & Control (D12/I20)

- Real-time or periodic measurement per slot (face)
- Measured: insertion loss, optical power, X/Y/Z alignment error
- Closed-loop MEMS actuator correction
- D12: 12 independent slots; I20: 20 independent slots

### DWDM Vendor Qualification Requirements (Vendor-Agnostic)

| Requirement | Description |
|-------------|-------------|
| Direct ribbon fusion | Factory-fuses to MOCT ribbon, not LC/SC |
| Integrated MEMS alignment | Same MAI structure inside DWDM unit |
| Silicon photonics PDK | Same SiPho PDK class as MOCT |
| Tier-scale support | D12 (9,216) and I20 (61,440) configurations |
| Channel 1 integration | NPU control path integration |
| MAC design/manufacturing | V-groove/pin-hole/MEMS alignment + locking |
| Slot-level auto-control | Per-slot alignment monitoring + MEMS correction |
| MAC durability/thermal | Cycle rating, loss drift, CTE-matched or compensated |

---

## 📊 Open Items (20)

| Key Open Items | Section | Status |
|----------------|---------|--------|
| OI-34-01 | 3.2 | O8 core-count basis (192 vs 1,536) not resolved across series |
| OI-34-02 | 3.2 | CPO package pinout/pad grid/interconnect — depends on foundry |
| OI-34-03 | 4 | MEMS alignment tolerance budget, bonding process, test method |
| OI-34-04 | 5 | Fusion process method, temp/time, yield criteria (all tiers) |
| OI-34-05 | 6 | WP#31 §7.2 / WP#32 Zone D need revision to reference CPO |
| OI-34-06 | 3.3 | Reach targets qualitative — formal link-budget analysis needed |
| OI-34-07 | 3.4/3.5 | ≈128 Tbps conventional-DWDM baseline not independently verified |
| OI-34-08 | 3.3/3.4 | Amplifier/DWDM technology choice (EDFA vs SOA, C/L-band, DCF vs electronic) |
| OI-34-09 | 3.3 | WP#03 §9.6 passive-medium exception for D12/I20 not amended |
| OI-34-10 | 3.4.2 | Core-to-wavelength mapping (DWDM channel plan) undefined |
| OI-34-11 | 6.1 | No specific DWDM vendor identified (vendor-agnostic only) |
| OI-34-12 | 5.4 | Fusion pass counts (1/2–3/3–4) are placeholders |
| OI-34-13 | 3.4.3.3 | MAC mechanical specs + insertion loss target not verified |
| OI-34-14 | 3.4.3.4 | MAC long-term reliability (thermal cycling, vibration) undefined |
| OI-34-15 | 3.4.3.5 | Slot-level auto-control mechanism (sensor, algorithm, actuator) undefined |
| OI-34-16 | 3.4.3.5 | MAC failure → MONITOR_EVENT_REG mapping undefined (pipeline exists) |
| OI-34-17 | 3.4.3.3 | MAC durability target (cycles, loss drift, replacement interval) not set |
| OI-34-18 | 3.4.3.4 | MAC CTE matching + operating temp range + compensation undefined |
| OI-34-19 | 6.1 | MAC replaceable module vs full DWDM replacement — undecided |
| OI-34-20 | 6.2 | WP#33 cross-document checks don't cover MAC scenarios (WP#33's scope) |

---

## 📜 License

MIT License

---

**Republic of Korea | Velsanet Architecture Group**
