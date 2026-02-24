# PAI 8-Channel → Meta Cube System (MVP)

This repository implements a structural prototype of:

• Independent 8-channel raw data storage  
• Channel-based meta extraction  
• Meta cube synthesis (T, C, I, E)  
• Event-based forwarding to next AI layers  

Raw data is preserved by default (no compression unless user-defined).

---

## Architecture

Device → SEU Segmenter → 8 Channel Raw Stores  
→ Channel Meta Workers → Cube Builder → Event Bus → Next AI Layer

Each cube axis keeps:

- value  
- confidence  
- evidence references  
- source channels  

This preserves structural traceability.

---

## Channels

CH1 Video  
CH2 Audio  
CH3 Text  
CH4 Location & Time  
CH5 Bio & Gesture  
CH6 Device Context  
CH7 User Actions & Consent  
CH8 External Signals  

---

## Run

```bash
pip install -r requirements.txt
uvicorn app:app --reload
