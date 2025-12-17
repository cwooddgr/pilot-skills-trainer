# DESIGN_RATIONALE.md

## Purpose of This Document

This document explains *why* the Pilot Skills Trainer is designed the way it is.  
It exists to preserve intent over time, guide future changes, and make the clean‑room and training boundaries explicit for both humans and coding agents.

This document is explanatory, not prescriptive.  
`PROJECT.md` remains the authoritative source of requirements.

---

## Core Design Principle

**Train transferable capacity, not test‑specific form.**

The application is designed to improve underlying cognitive and psychomotor abilities that matter for aviation training outcomes, while avoiding reproduction of any proprietary selection instrument’s structure, flow, or scoring.

---

## Clean‑Room Boundary Clarified

The clean‑room constraint is defined by **structure**, not **representation**.

### The project explicitly avoids:
- Fixed task ordering that mirrors known selection batteries
- Deterministic multi‑task combinations
- Canonical timing envelopes
- Exam‑like “this is what you’ll see” experiences

### The project explicitly allows:
- Training the same latent abilities as real‑world selection tests
- Using aviation‑relevant metaphors and instruments
- Improving performance via indirect skill transfer

The Air Force (or any other institution) does not own:
- Continuous motor control
- Divided attention
- Auditory filtering
- Spatial reasoning
- Interrupt handling

They *do* rely on specific task structures to measure them.  
This project trains the former while avoiding the latter.

---

## Why Aviation Instruments Are Allowed (With Guardrails)

Standard aviation instruments:
- Pre‑date any modern selection test
- Are used broadly in civilian and military contexts
- Are not proprietary to any exam

However, they introduce **learned schema** that can contaminate pure aptitude measurement.

### Design compromise adopted:
- Abstract representations are used for baseline and adaptive assessment
- Aviation‑context representations are allowed **only** as labeled training modes
- Training‑only metrics are kept separate from aptitude metrics

This allows:
- Realistic skill reinforcement
- Ethical transparency
- No false claims of predictive validity

---

## Assessment vs Training Distinction

The system intentionally separates two concepts:

### Assessment‑safe activities
- Abstract representations
- Adaptive difficulty
- Baseline measurements
- Aggregate metrics

These estimate *current capacity*.

### Training‑only activities
- Aviation‑context visuals
- Instrument‑based metaphors
- Fixed or laddered difficulty

These improve *performance through practice*.

The system never conflates the two.

---

## Why Randomization Is Non‑Negotiable

Randomization prevents:
- Memorization
- Surface‑level rehearsal
- Strategy overfitting

Randomized:
- Stimuli
- Layouts
- Task combinations
- Timing jitter

ensure the app trains **capacity**, not pattern recognition.

---

## Why No “Practice Test” or “Exam Mode” Exists

Selection tests are designed to resist rehearsal of form.

Providing:
- “Exam simulations”
- “Practice versions”
- Canonical flows

would undermine both:
- Ethical positioning
- Actual training effectiveness

The project explicitly rejects these modes.

---

## Why Metrics Focus on Degradation and Recovery

Aviation failure is rarely binary.

The most predictive signals are:
- How performance degrades under load
- How quickly stability is regained
- How gracefully attention is reallocated

Accordingly, the system emphasizes:
- Dual‑task cost
- Error spikes
- Recovery curves

over raw accuracy alone.

---

## Web Platform Considerations

Because the app runs in a browser:
- Latency varies
- Input devices differ
- Frame pacing is imperfect

Abstracted and simplified representations:
- Reduce negative transfer
- Improve robustness
- Avoid misleading fidelity

This reinforces the choice to avoid full cockpit simulation.

---

## Intended Review Outcome

If reviewed by:
- A pilot
- A human‑factors researcher
- A selection‑system designer

the correct reaction should be:

> “This clearly trains relevant skills without pretending to be the test.”

That reaction is the design target.

---

## Future Change Guidance

When modifying or extending the system, ask:

1. Does this introduce a fixed or canonical flow?
2. Does this create an experience that substitutes for an exam?
3. Are we measuring capacity, or rehearsing representation?
4. Are training and assessment still clearly separated?

If the answer to (1) or (2) is “yes”, redesign.  
If (3) or (4) is unclear, add labeling or separation.

---

## Bottom Line

This project is conservative where it matters:
- Structure
- Flow
- Claims

and flexible where it helps:
- Representation
- Context
- Skill transfer

That balance is intentional.
