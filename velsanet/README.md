# Velsanet

Velsanet is a full-stack architecture for AI-native optical networks.  
It combines hardware design (CPO, hypercube fabric), AI cognition (PAI), governance/control (EAI), and distributed network intelligence (Network AI) into a single coherent system.

This repository contains:
- Official ITU-T FG-AINN submissions (read-only)
- Active design specifications (editable)
- Reference implementations for PAI, EAI, and Network AI
- Hardware design files (RTL/FPGA)
- Simulation and visualization tools
- Unit and integration tests

---

## Repository Content

### Documentation (`docs/`)

- `itu-t/` – Official submissions to ITU-T FG-AINN (do not modify)  
  - `hw_design.docx` – Hardware architecture (WP#29–34)  
  - `ai_design.docx` – Network AI design (Velsa v2.1)  

- `specs/` – Working specifications (actively edited)  
  - `hardware.md` – Slot/core allocation, CPO packaging, loopback design  
  - `pai.md` – Cognition Cube, SEU1/SEU2 engine  
  - `eai.md` – AAI/AsAI governance, Dual E2E, CH11 isolation  
  - `network-ai.md` – Distributed control, self-healing, fairness policy  

### Implementation (`src/`)

- `hw/` – RTL / FPGA code for optical fabric and Matrix control  
- `pai/` – Cognition Engine implementation (Python/Node.js)  
- `eai/` – Governance Controller (AAI/AsAI, Dual E2E, CH11)  
- `network-ai/` – Velsa v2.1 implementation (Node.js)  

### Tests (`tests/`)

- `unit/` – Unit tests for each module  
- `integration/` – End-to-end integration tests (PAI + EAI + Network AI + HW simulation)  

### Tools (`tools/`)

- `simulator/` – Software simulation of full Velsanet system (no CPO hardware required)  
- `viz/` – Dashboard for visualizing 128-node hypercube status and self-healing events  

---

## Key Design Principles

- **Distributed ownership** – Each node manages its own connection state (D1–D7)  
- **Role-based utilization** – 70% threshold applies only to **fabric** (inter-node) slots, not to **endpoint** (PAI/EAI) slots  
- **Group-based loopback** – Loopback is per core-group, not per slot, enabling faster and more flexible self-healing  
- **Self-healing fabric** – `SelfHealEngine` detects LOS/BER in µs and reroutes via LOOPBACK + CONNECT commands  
- **Mode-dependent fabric set** – Mode A: Slot 1 + Slots 6–8 are fabric; Mode B: Slots 1–8 are fabric  

---

## Development Quick Start

### Prerequisites
- Node.js (for Network AI)  
- Python 3.11+ (for PAI/EAI controllers)  
- Verilog/VHDL simulator (for hardware simulation)  

### Steps

```bash
# Clone the repository
git clone https://github.com/your-org/velsanet.git
cd velsanet

# Network AI
cd src/network-ai
npm install
npm test

# PAI
cd ../pai
pip install -r requirements.txt
pytest

# EAI
cd ../eai
pip install -r requirements.txt
pytest

# Hardware simulation
cd ../hw
make sim
