# WP#32: PCB Layout Design

**Velsanet Architecture Group | Technical Design Document**

> Board-Level Component Placement · High-Speed Trace Routing · Thermal Design

---

## 📋 Overview

PCB-level design for Velsanet network equipment (O8/D12/I20 nodes). Realizes WP#31's schematic as actual board layout. Distinct from WP#30's die-level layout and WP#24's Dedicated Equipment card layout.

- **Version**: v0.7 │ 2026
- **Classification**: Internal Draft — 8 open items remain
- **Extends**: WP#24 §7, WP#31, WP#29 §10.3

---

## 📁 Structure

| Section | Content |
|---------|---------|
| 3 | Board component placement (Option A — shared FPGA/ASIC footprint) |
| 4 | High-speed trace routing (800G PAM4, controlled impedance, length matching) |
| 5 | Data Path / Control Path physical separation (isolation slot) |
| 6 | Thermal design (power dissipation, Θ_JA, cooling candidates) |
| 7 | Layer stack-up (16-layer, stripline, Megtron 6-7) |

---

## 🔑 Key Specs

### Option A — Shared Footprint (New Decision)

| Device | Stage | Key Parameters |
|--------|-------|----------------|
| VU19P FPGA | Prototype | GTM 58Gbps SerDes, ≈225W |
| 16nm-class ASIC | Production | Pin-compatible footprint, 110–155W (est.) |

**Note**: Pin compatibility is assumed, not verified against any real ASIC pinout (OI-32-06).

### Placement Zones

| Zone | Components |
|------|------------|
| **A** | FPGA/ASIC (central) |
| **B** | PMIC (adjacent to core) |
| **C** | DDR4 SO-DIMM ×4 (near FPGA) |
| **D** | QSFP-DD (board edge — bring-up only) |
| **E** | PCIe edge connector (opposite edge) |

### Power Dissipation Summary

| Stage | Total Power |
|-------|-------------|
| FPGA (VU19P) | ≈250–265W |
| ASIC (16nm) | ≈135–195W |

**Θ_JA requirement**: ≤0.20°C/W (FPGA) / ≤0.29°C/W (ASIC) at T_ambient=40°C, T_junction≤85°C

### Cooling Candidates

| Approach | Θ_JA Achievable |
|----------|-----------------|
| Heat-sink + forced convection | ≈2–5°C/W |
| Heat-sink + axial fan | ≈0.5–1.5°C/W |
| Vapor chamber + fan | ≈0.3–0.8°C/W |
| Liquid cooling | ≈0.1–0.3°C/W (overkill) |

### Data/Control Path Separation

| Technique | Precedent |
|-----------|-----------|
| Isolation slot (keep-out gap) | WP#24 CH11 Relay Island |
| Layer separation | Proposed (standard practice) |
| Guard traces / ground stitching | Proposed (standard practice) |

### Layer Stack-Up (Proposed)

| Parameter | Value |
|-----------|-------|
| Layer count | 16-layer (starting point) |
| Signal structure | Stripline (embedded between ground planes) |
| Dielectric | Megtron 6 or 7 |
| Copper weight | 1–2 oz (power/ground layers) |

---

## 📊 Open Items (8)

| ID | Section | Open Item |
|----|---------|-----------|
| OI-32-01 | 3.1.2 | Exact coordinates/keep-out zones (depends on chassis design) |
| OI-32-02 | 4 | Impedance/length-matching values not confirmed as Velsanet-specific |
| OI-32-03 | 5 | Layer separation/guard traces proposed but unconfirmed |
| OI-32-04 | 6.3/6.5 | Final cooling part selection (depends on ASIC power + chassis) |
| OI-32-05 | 7 | Layer assignment/insertion loss/IR drop verification pending |
| OI-32-06 | 3.1.1 | VU19P–ASIC pin compatibility not verified (foundry TBD) |
| OI-32-07 | 1 | Master/Standby PCB variant mechanism (tied to WP#31 OI-31-10) |
| OI-32-08 | 2, 6.3 | QSFP-DD is bring-up only — production MOCT-native interface not defined |

---

## 📜 License

MIT License

---

**Republic of Korea | Velsanet Architecture Group**
