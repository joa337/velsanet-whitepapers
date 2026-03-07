# Velsanet Deployment Architecture

This directory contains deployment design documents for the physical implementation of the Velsanet network architecture.

Unlike the conceptual white papers, the documents in this folder focus on practical infrastructure planning, including node density, optical infrastructure scale, and capital expenditure estimation for real-world urban environments.

The purpose of these documents is to translate the architectural principles of Velsanet into a deployable city-scale network model.

---

## Contents

**Velsanet_DEPLOY_SEO_01**

Deployment planning model for the Seoul metropolitan area.

The document includes:

* RU (Radio Unit) density estimation based on urban pole infrastructure
* H6 node aggregation design
* O8 aggregation layer sizing
* Optical cable segmentation and length estimation
* City-scale CAPEX estimation for the full infrastructure

The Seoul deployment model serves as a reference framework for evaluating how the Velsanet architecture could be implemented in large metropolitan environments.

---

## Architectural Context

In the Velsanet architecture, deployment planning is based on a hierarchical node structure:

* **T4** – Subscriber endpoint node (wired access)
* **H6** – Access aggregation node for both wired and wireless infrastructure
* **RU** – Radio access unit connected to H6 nodes
* **O8** – Urban aggregation and distributed intelligence layer
* **D12** – Regional backbone aggregation layer

This structure allows both wired and wireless traffic to converge at the H6 layer before entering the higher aggregation layers of the network.

---

## Purpose of the Deployment Studies

The deployment studies aim to examine three key aspects:

1. **Physical feasibility**
   Evaluation of node density and optical infrastructure requirements.

2. **Urban scalability**
   Assessment of how the architecture scales to megacity environments.

3. **Infrastructure economics**
   Preliminary estimation of capital expenditure for large-scale network deployment.

These documents should be interpreted as **conceptual deployment studies**, not as final construction engineering plans.

---

## Related Directories

Additional materials related to the Velsanet architecture can be found in other directories of this repository:

* `whitepapers/` – Architectural and conceptual documents
* `standards/` – Standardization proposals and technical framework materials
* `research-institute/` – Research institute vision and operational model
* `industry/` – Industry mapping and ecosystem integration studies

---

## Project

**Velsanet — Next-Generation Structure-Native Network Architecture**

An architectural research project exploring topology-first network design for AI-native communication infrastructures.
