# TECHNICAL.md

## 1. Architecture Overview

- Client-only SPA
- High-frequency task loops via `requestAnimationFrame`
- Input via Gamepad API + keyboard events
- Audio scheduled via Web Audio API
- Local persistence via IndexedDB

---

## 2. Timing Model

- Frame loop target: 60 Hz
- Timestamp source: `performance.now()`
- All events stored with monotonic timestamps
- Audio events scheduled ≥100 ms ahead to avoid jitter

---

## 3. Input Handling

### Axis Sampling
- Poll gamepads every frame
- Apply:
  - Deadzone
  - Sensitivity curve (linear default)
  - Optional low-pass filter

```pseudo
filtered = α * raw + (1 - α) * prev
```

---

## 4. Module Algorithms

### Module A — 1D Pursuit Tracking

#### Target Generation
Choose one per trial:
- Sum of sinusoids with slowly varying frequency
- Piecewise-constant acceleration (bounded jerk)
- Ornstein–Uhlenbeck process

```pseudo
dx = θ*(μ - x)*dt + σ*sqrt(dt)*noise()
x += dx
```

#### Metrics
```pseudo
error = targetX - cursorX
MAE = mean(|error|)
RMSE = sqrt(mean(error^2))
```

Smoothness:
```pseudo
jerk = d²(input)/dt²
smoothness = mean(jerk^2)
```

---

### Module B — 2D Pursuit Tracking

Target motion:
- Momentum-based random walk
- Curvilinear paths with bounded curvature

Reacquisition time:
```pseudo
if |error| > threshold:
  mark loss
when |error| < threshold:
  reacquisitionTime = now - lossTime
```

---

### Module C — Auditory Selective Attention

#### Go/No-Go Variant

- Stimulus stream with jittered ISI
- Target set changes per block

Metrics:
```pseudo
hitRate = hits / targets
falseAlarmRate = falseAlarms / nonTargets
dPrime = Z(hitRate) - Z(falseAlarmRate)
```

---

### Module D — Spatial Orientation Microtasks

Rules:
- Randomized scenes and iconography
- No standardized aviation instruments

Metrics:
- Accuracy
- Reaction time
- Speed–accuracy tradeoff

---

### Module E — Dual-Task Motor Control

Run Module A and B simultaneously.

Dual-task cost:
```pseudo
cost = (baselineRMSE - dualRMSE) / baselineRMSE
```

---

### Module F — Triple-Task

Module E + Module C.

Interference analysis:
- Correlate auditory response timestamps with tracking error spikes
- Compute mean error in ±500 ms window around auditory events

---

### Module G — Interrupt Handling

Interrupt generation:
- Poisson process with minimum spacing
- Randomized response rules

Metrics:
```pseudo
interruptRT = responseTime - promptTime
errorSpike = max(error during interrupt) - baselineError
recoveryTime = time to return to baselineError
```

---

## 5. Adaptive Difficulty Controller

Per-module controller:

```pseudo
if successRate > upperBound:
  difficulty += step
else if successRate < lowerBound:
  difficulty -= step
difficulty = clamp(difficulty, min, max)
```

Target success band: 70–85%.

---

## 6. Data Schemas

### UserProfile
```json
{
  "id": "uuid",
  "hardwareProfileId": "uuid",
  "settings": {}
}
```

### Session
```json
{
  "id": "uuid",
  "timestamp": 123456789,
  "moduleRuns": []
}
```

### Trial
```json
{
  "id": "uuid",
  "moduleId": "A",
  "difficulty": 0.6,
  "durationMs": 30000,
  "events": [],
  "metrics": {}
}
```

### EventSample
```json
{
  "t": 123.45,
  "type": "input|stimulus|response",
  "value": {}
}
```

---

## 7. Analytics

Required plots:
- Error vs time
- RT histograms
- Dual-task cost bars
- Recovery curves

Use downsampled data for rendering.

---

## 8. Validation Targets

- Same-day retest reliability for RMSE and d′
- Observable reduction in dual-task cost over sessions
- Faster recovery after interrupts with training

---

## 9. Explicit Anti-Goals

Do NOT:
- Implement fixed sequences
- Match any known exam flow
- Add “exam mode” or “simulation mode”
