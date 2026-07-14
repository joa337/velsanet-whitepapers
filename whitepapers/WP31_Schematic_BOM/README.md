# WP#31: Schematic & BOM

**Velsanet Architecture Group | Technical Design Document**

> System Block Diagram · Component Selection · Power/Clock Distribution · 800G Optical Interface · Bill of Materials

---

## 📋 Overview

Schematic-level design and Bill of Materials for Velsanet network equipment (O8/D12/I20 nodes). Realizes WP#30's Matrix switching/routing RTL as actual component-level circuit.

- **Version**: v1.2 │ 2026
- **Classification**: Internal Draft — 12 open items remain
- **Extends**: WP#24 §4/§7, WP#26 §4.4/§7, WP#30 (16nm-class ASIC)

---

## 📁 Structure

| Section | Content |
|---------|---------|
| 3 | System block diagram (Dedicated Equipment blocks + node-level additions) |
| 4 | Component selection (FPGA, PMIC, memory, QSFP-DD, PCIe) |
| 5 | Power distribution (VU19P rails, PMBus domain split) |
| 6 | Clock distribution (OIL input → PTP internal distribution) |
| 7 | 800G optical interface (lane grouping, transceiver-to-FPGA) |
| 8 | Bill of Materials (12 line items, BOM variant for Master/Standby) |

---

## 🔑 Key Specs

### Component Selection (Confirmed)

| Subsystem | Candidate | Key Parameter |
|-----------|-----------|---------------|
| FPGA | Xilinx/AMD VU19P (or newer) | GTM-class 58Gbps SerDes |
| PMIC (VCCINT) | MPM3695-100 ×2 (MPS) | 0.85V, 100–200A, PMBus |
| PMIC (VCCBRAM) | MPM3695-25 | 0.85V, 12A, PMBus |
| PMIC (VCCAUX/MGTYAVCC) | MPM3695-10 ×2 | 1.8V/0.9V, 7A, PMBus |
| PMIC (MGTYAVAUX) | MPM3632C | 1.8V, 0.6A |
| PMIC (MGTYAVTT) | MPM3695-25 | 1.2V, 16A, PMBus |
| PMIC (VCCO I/O) | MPM3650 | 1.1–3.3V, 3A |
| DDR termination | MP20075 | VDD/2, 3A |
| Memory | DDR4 SO-DIMM | TBD |
| 800G (bring-up only) | QSFP-DD | Verifies against real VU19P boards |
| Host/control | PCIe Gen3/Gen4 | UltraScale+ hard IP |
| ASIC (production) | 16nm-class (Phase 1) | Foundry TBD (WP#30 OI-30-17) |

### Power Rails (VU19P, MPS module-based)

| Rail | Voltage / Current | MPS Part |
|------|-------------------|----------|
| VCCINT | 0.85V, 100–200A | MPM3695-100 ×2 |
| VCCBRAM, VCCINT_IO | 0.85V, 12A | MPM3695-25 |
| VCCAUX, VCCAUX_IO, VCCADC | 1.8V, 7A | MPM3695-10 |
| MGTYAVCC | 0.9V, 7A | MPM3695-10 |
| MGTYAVAUX | 1.8V, 0.6A | MPM3632C |
| MGTYAVTT | 1.2V, 16A | MPM3695-25 |
| VCCO (I/O) | 1.1–3.3V, 3A | MPM3650 |
| DDR_VTT | VDD/2, 3A | MP20075 |

### PMBus Domain Split

| Domain | Rails | Purpose |
|--------|-------|---------|
| **Domain A — Data Path** | VCCINT, MGTYAVCC, MGTYAVTT | Highest-current, feeds SerDes + Matrix |
| **Domain B — Control Path** | VCCBRAM, VCCAUX, VCCO, DDR_VTT | Lower-current, feeds NPU/MONITOR_CH/I/O |

---

## 📊 Open Items (12)

| ID | Section | Open Item |
|----|---------|-----------|
| OI-31-01 | 3 | Signal-flow/connection topology not drawn (depends on WP#30 OI-30-04) |
| OI-31-02 | 4 | Memory capacity/ECC config + ASIC-stage parts (depends on WP#30 OI-30-17) |
| OI-31-03 | 5 | Board-level PSU topology (depends on WP#29 OI-29-05) |
| OI-31-04 | 6 | PLL/buffer selection, fan-out topology, skew budgets |
| OI-31-05 | 7 | Transceiver part selection + PCS/FEC placement (depends on WP#26 OI-07) |
| OI-31-06 | 8 | Memory config, QSFP-DD lane count, ASIC-stage part |
| OI-31-07 | 3.3 | Control-bus topology, pin assignments, voltage levels |
| OI-31-08 | 5.2 | PMBus addressing, bus speed, master controller assignment |
| OI-31-09 | 5.1a | PMIC headroom vs. ASIC estimate (order-of-magnitude only) |
| OI-31-10 | 1 | Master/Standby BOM variant mechanism (per WP#29 R10) |
| OI-31-11 | 4, 8 | QSFP-DD is bring-up only — production MOCT-native interface not specified |
| OI-31-12 | 3 | Table 3-1 cites "WP#24 Figure 7-1" — figure does not exist in current WP#24 |

---

## 📜 License

MIT License

---

**Republic of Korea | Velsanet Architecture Group**
