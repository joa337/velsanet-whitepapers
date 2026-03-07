# 6G RU

White Paper #23

6G RU: Multi-User Physical Mapping Design  
Structure-Native Physical Path Direct Mapping (No-Switching)

This document defines the hardware design specification of the Velsanet 6G RU.

The RU is designed as a structure-native wireless-to-optical transducer that maps multiple user signals directly to physical optical cores without software scheduling, switching, or buffering.

Key components include:

- 8-channel spatial multiplexing
- Time-Sensitive Gearbox (TSG)
- 48-core MOCT physical interface
- Optical Injection Locking (OIL)

The RU operates as a pure hardware signal path:

Antenna → MIMO → Time-Sensitive Gearbox → Coherent Optical Engine → MOCT Ribbon → H6
