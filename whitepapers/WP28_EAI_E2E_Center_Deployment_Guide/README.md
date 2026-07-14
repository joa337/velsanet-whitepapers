# WP#28: EAI E2E Center Deployment Guide

**Velsanet Architecture Group | Technical Design Document**

> Outdoor Installation · CH11 Independent Power · Dual E2E Field Validation

---

## 📋 Overview

Deployment guide for EAI (Embodied AI) instances at the E2E Center. Companion to WP#27 (PAI AI DC Deployment).

- **Version**: v1.1 (R2) │ 2026
- **Classification**: Public - Open Specification
- **Extends**: WP#24 §11.1, WP#25 R1, WP#26 §5–6

---

## 📁 Structure

| Section | Content |
|---------|---------|
| 3 | EAI vs PAI deployment differences (16ch Dual E2E, outdoor, CH11) |
| 4 | Outdoor installation (IP54+, −10°C to +60°C, 5m+ MOCT cable) |
| 5 | CH11 independent power (EN 50205 force-guided relay, supercapacitor) |
| 6 | Dual E2E field validation (optical, power, clock, fault isolation) |
| 7 | EAI field power (PoE++ or independent DC + UPS) |

---

## 🔑 Key Specs

| Parameter | EAI |
|-----------|-----|
| **Channel count** | 16-channel Dual E2E (SEU1 + SEU2) |
| **Optical cores** | 2 (Layer 0 + Layer 1) |
| **Environmental** | IP54+ (floor), −10°C to +60°C |
| **Ribbon length** | 5m+ (outdoor pole) |
| **Power** | PoE++ or independent DC + UPS (no facility UPS) |
| **Safety** | CH11 independent power + force-guided relay (EN 50205) |

---

## 🔍 Dual E2E Field Validation

| Item | Pass Criterion |
|------|----------------|
| Optical core allocation | Zero cross-talk between E2E #1 (Cores #1–24) and E2E #2 (#25–48) |
| Power domain isolation | E2E #2 continues on backup UPS when Main PSU disconnected |
| Clock source isolation | PTP master fault does not affect E2E #2's independent OSC |
| Fault propagation | SEU1 ABORTED does not affect SEU2 COMPLETE (and vice versa) |
| CH11 override | Relay opens load path via independent power alone |

---

## 📊 Open Items (R2)

| ID | Open Item |
|----|-----------|
| OI-28-01 | Exact IP rating (IP54+ floor; IP65/66 likely for fully exposed) |
| OI-28-02 | Pole/mounting mechanical hardware (out of architecture scope) |
| OI-28-03 | Actual CH11 controller + relay-hold current draw (unmeasured) |
| OI-28-04 | Field test equipment / fault-injection method (runbook candidate) |
| OI-28-05 | Final EN 50205 relay part selection (shortlist provided) |

---

## 📜 License

MIT License

---

**Republic of Korea | Velsanet Architecture Group**
