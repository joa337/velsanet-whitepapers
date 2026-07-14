# WP#27: PAI AI Data Center Deployment Guide

**Velsanet Architecture Group | Technical Design Document**

> Multi-Instance Parallel Operation · Rack Wiring · DC Power Specification

---

## 📋 Overview

Deployment guide for PAI (Personal AI) instances in an AI Data Center. Covers how the SEU1 engine (WP#26) is deployed at scale.

- **Version**: v1.1 (R2) │ 2026
- **Classification**: Public - Open Specification
- **Extends**: WP#24 §11.1, WP#25 R1 Table B-5, WP#26 §4

---

## 📁 Structure

| Section | Content |
|---------|---------|
| 3 | PAI vs EAI deployment differences (8ch vs 16ch, indoor vs outdoor) |
| 4 | Multi-instance parallel operation (384 lanes, non-collision guarantee) |
| 5 | Rack wiring (MOCT fixed ribbon, 1–3m, connector-free) |
| 6 | DC power (data center PDU standard — no CH11 safety path) |

---

## 🔑 Key Specs

| Parameter | PAI |
|-----------|-----|
| **Channel count** | 8-channel (SEU1 only) |
| **Optical cores** | 1 per instance (Layer 0 only) |
| **Instances per Node_8** | Up to 384 (bounded by lanes) |
| **Ribbon length** | 1–3m (intra-rack) |
| **Power** | Data center PDU standard (no independent UPS) |
| **Environment** | 20–25°C (indoor) |

---

## 📊 Open Items (R2)

| ID | Open Item |
|----|-----------|
| OI-27-01 | Max concurrent instances N (bounded by 384, workload-dependent) |
| OI-27-02 | Real rack density (EIA-310-D reference: 42U/rack; MOCT bend-radius TBD) |
| OI-27-03 | Per-instance power budget (depends on downstream compute) |

---

## 📜 License

MIT License

---

**Republic of Korea | Velsanet Architecture Group**
