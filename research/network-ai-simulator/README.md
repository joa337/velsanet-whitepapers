# Velsanet Network AI Simulator

This directory contains experimental simulation tools for studying the behavior of **VELSA (Velsanet Network AI)** under failure conditions.

The simulator visualizes how the Velsanet architecture detects failures, propagates structural information through the hypercube layers, and converges toward autonomous recovery.

---

## Simulator

**VELSA Dual Fault Simulator (v3.0)**

This simulator models two primary fault types defined in the Velsanet architecture:

### 1. Node Down
Hardware or power failure of a network node.

Effects:
- All connected links are immediately terminated
- Path formation is interrupted
- Upper layers detect degradation

VELSA response:
- E2E path reconstruction
- structural recovery through upper-layer convergence

---

### 2. Link Cut
Physical optical link failure.

Effects:
- Nodes remain alive
- Only the link is disconnected

VELSA response:

- Hypercube links → **Q-axis reroute**
- Vertical / mesh links → **Core substitution within the same plane**

---

## Network Layers

The simulator follows the Velsanet layered structure.

| Layer | Role |
|-----|-----|
| T4 | Edge rhizome cluster |
| H6 | Proximity mesh layer |
| O8 | E2E path recognition (PAI) |
| D12 | Regional convergence (AAI) |
| I20 | Global structural intelligence (AsAI / VELSA) |

---

## Structural Principles

The simulator demonstrates several key ideas of the Velsanet architecture:

- Hypercube-based horizontal propagation
- End-to-end path recognition
- distributed structural intelligence
- autonomous network recovery

---

## File
