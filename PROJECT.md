# PROJECT.md

## Project Name
**Pilot Skills Trainer (Web)**

## 1. Project Purpose

Build a web-based application that trains aviation-relevant cognitive and psychomotor skills, including continuous motor control, divided attention, spatial reasoning, and interrupt handling.

This project is a **clean-room skills trainer**. It is not affiliated with, derived from, or intended to replicate any proprietary military or civilian selection or screening exam. It focuses on training underlying capacity, not rehearsing any specific test format.

---

## 2. Hard Constraints (Authoritative)

These constraints override all other instructions.

### The system MUST:
- Run entirely in a modern desktop web browser
- Support keyboard, mouse, joystick, throttle, and rudder pedals via the Gamepad API
- Provide explicit hardware detection, axis mapping, and calibration
- Use randomized task generation (no fixed sequences, layouts, or timing envelopes)
- Store all user data locally by default

### The system MUST NOT:
- Replicate or simulate the structure of any proprietary selection exam
- Use fixed task ordering or deterministic multi-task combinations
- Include language implying exam rehearsal or score guarantees
- Require cloud services, accounts, or telemetry

---

## 3. Target Users

- Aviation training candidates (e.g., UPT hopefuls)
- Users with flight-simulator hardware
- Users seeking ethical, non-circumventive skill training

---

## 4. Supported Inputs & Hardware

### Required
- Keyboard
- Mouse

### Optional (auto-detected)
- Joystick / HOTAS
- Throttle axis
- Rudder pedals

### Requirements
- User-visible axis assignment
- Deadzone, sensitivity, and inversion controls
- Per-device calibration persisted in profile

---

## 5. Canonical Module List (Fixed)

Claude must not invent additional modules without instruction.

- **Module A** — 1D Pursuit Tracking ✅
- **Module B** — 2D Pursuit Tracking ✅
- **Module C** — Auditory Selective Attention ✅
- **Module D** — Spatial Orientation Tasks ✅
- **Module E** — Dual-Task Motor Control ✅
- **Module F** — Triple-Task (Motor + Auditory) ✅
- **Module G** — Interrupt Handling Under Load ✅  

Each module MUST:
- Have ≥2 internal variants
- Support adaptive difficulty
- Emit per-trial and per-block metrics

---

## 6. Spatial Orientation Representation Policy

Spatial-orientation modules MAY use:

- Abstract representations (geometric shapes, symbolic landmarks)
- Aviation-context representations (e.g., attitude indicators, compass metaphors)

If aviation-context representations are used:

- They MUST be clearly labeled as **training context**, not neutral aptitude measurement
- They MUST NOT be used for baseline assessment
- They MUST NOT participate in any aggregate "aptitude" or "overall score"
- They MUST NOT appear in fixed or canonical task sequences

Abstract representations SHOULD be used for baseline and adaptive assessment loops.

---

## 7. Metrics (Non-Negotiable)

### Tracking metrics MUST include:
- Mean absolute error (MAE)
- Root mean squared error (RMSE)
- Time-on-target
- Overshoot count and magnitude
- Control smoothness (derivative-based)

### Attention metrics MUST include:
- Reaction time distributions
- Hit, miss, and false-alarm rates
- Signal detection metric (d′)

### Multitasking metrics MUST include:
- Dual-task cost (relative to baseline)
- Interrupt recovery time
- Interference signatures (error spikes)

---

## 8. Difficulty Adaptation Rules

- Adaptive difficulty is REQUIRED
- Target success band: **70–85%**
- Adjustments must be gradual and bounded
- Manual override MUST be available

---

## 9. Mandatory UX Flow

1. Hardware detection & calibration
2. Optional baseline assessment (abstract representations only)
3. Training session (single or mixed modules)
4. Post-session analytics  

---

## 10. Canonical Data Objects

These names are authoritative and must be reused:

- `UserProfile`
- `HardwareProfile`
- `Session`
- `ModuleRun`
- `Trial`
- `EventSample`

---

## 11. Data Storage & Privacy

- Local-only storage by default (IndexedDB)
- No analytics, telemetry, or tracking
- No login required

---

## 12. Implementation Guidance (Advisory)

- SPA framework of choice
- `requestAnimationFrame` for high-frequency loops
- Web Audio API for auditory stimuli
- Minimize DOM updates during active trials

Claude MAY deviate here if constraints are preserved.

---

## 13. Recommended Build Order

1. Input detection & calibration  
2. Module A  
3. Module B  
4. Metrics + analytics view  
5. Module C  
6. Module E  
7. Module G  
8. Module F  
9. Optional aviation-context variants for Module D  

---

## 14. User-Facing Language Rules

All copy MUST:
- Avoid naming any specific exam
- Emphasize transferable skill development
- Avoid promises about selection outcomes

---

## 15. Positioning Copy (Approved)

> “This application trains aviation-relevant cognitive and motor skills such as continuous control, divided attention, and rapid task switching. Tasks are randomized and adaptive to promote transferable ability rather than memorization.”
