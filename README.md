# Pilot Skills Trainer

A web-based application for training aviation-relevant cognitive and psychomotor skills.

## Overview

This application trains transferable skills such as continuous motor control, divided attention, spatial reasoning, and interrupt handling. All tasks are randomized and adaptive to promote skill development rather than memorization.

**Design Philosophy**: Train transferable capacity, not test-specific form. See `DESIGN_RATIONALE.md` for details on clean-room constraints and assessment vs. training modes.

## Project Structure

```
tbas/
├── src/
│   ├── components/         # React components
│   │   ├── pages/         # Page components (Home, Hardware, Training, Analytics)
│   │   ├── AppRoutes.tsx  # Route definitions
│   │   └── Navigation.tsx # Main navigation bar
│   ├── modules/           # Training module implementations (A-G)
│   │   ├── ModuleA.tsx   # 1D Pursuit Tracking
│   │   ├── ModuleB.tsx   # 2D Pursuit Tracking
│   │   ├── ModuleC.tsx   # Auditory Selective Attention
│   │   └── ModuleD.tsx   # Mental Rotation (in progress)
│   ├── stores/            # State management
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   │   ├── targetGeneration.ts  # Target movement algorithms
│   │   ├── trackingMetrics.ts   # Tracking performance calculations
│   │   ├── spatialTasks.ts      # Mental rotation task generation
│   │   └── spatialMetrics.ts    # Spatial performance calculations
│   ├── lib/
│   │   └── db.ts         # IndexedDB wrapper for local storage
│   ├── App.tsx           # Main application component
│   ├── main.tsx          # Application entry point
│   └── index.css         # Global styles with Tailwind
├── public/               # Static assets
├── PROJECT.md            # Project requirements and constraints
├── TECHNICAL.md          # Technical specifications
├── DESIGN_RATIONALE.md   # Design decisions and clean-room boundaries
└── package.json          # Dependencies and scripts
```

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **IndexedDB (via idb)** - Local data persistence
- **Web Audio API** - Auditory stimulus generation
- **Pointer Lock API** - Unlimited 2D mouse tracking

## Training Modules

### Implemented

- **Module A** — 1D Pursuit Tracking ✅
  - Momentum and curvilinear target generation
  - Arrow key or WASD control
  - MAE, RMSE, time on target metrics
  - Adaptive difficulty based on tracking performance

- **Module B** — 2D Pursuit Tracking ✅
  - Full 2D target movement (momentum + curvilinear algorithms)
  - Mouse + keyboard control (WASD)
  - Pointer Lock API for unlimited mouse movement
  - 2D metrics: MAE, RMSE, time on target, reacquisition time

- **Module C** — Auditory Selective Attention ✅
  - Go/No-Go task with three tone frequencies (440Hz, 587Hz, 880Hz)
  - Jittered inter-stimulus intervals
  - Signal detection metrics: d-prime, hit rate, false alarm rate
  - Reaction time analysis
  - Fixed React closure bug in keyboard handler

- **Module D** — Mental Rotation ✅
  - 2D shape mental rotation tasks with Tetris pieces (J, F, Z)
  - Asymmetric shapes guarantee visually distinct rotations and mirrors
  - Correct answer always requires mental rotation (90°, 180°, or 270° from reference)
  - Difficulty scaling: low (1 mirror) → high (3 mirrors)
  - Accurate reaction time measurement (timer starts after render)
  - Metrics: accuracy, reaction time, speed-accuracy tradeoff

- **Module E** — Dual-Task Motor Control ✅
  - Split canvas: Left = 1D horizontal tracking, Right = 2D tracking
  - Baseline trials required (1D alone, then 2D alone)
  - Dual-task trial runs both tasks simultaneously
  - Keyboard (A/D) controls 1D task, Mouse controls 2D task
  - Calculates dual-task cost metric: performance degradation when multitasking
  - Metrics: dual-task cost, baseline RMSE, dual RMSE

- **Module F** — Triple-Task (Motor + Auditory) ✅
  - Combines Module E (dual motor) with Module C (auditory Go/No-Go)
  - Baseline trials: 1D alone (30s), 2D alone (30s), Audio alone (60s)
  - Triple-task trial runs all three tasks simultaneously (60s)
  - Independent input channels: A/D keys (1D), mouse (2D), spacebar (auditory)
  - Dual game loop architecture: motor (requestAnimationFrame) + auditory (setTimeout)
  - Interference metrics: tracking error spikes in ±500ms windows around auditory events
  - Metrics: tracking (1D + 2D), attention (d-prime), dual-motor cost, auditory cost, interference

- **Module G** — Interrupt Handling Under Load ✅
  - 2D pursuit tracking with time-critical visual interrupts
  - Baseline period (5-8s) establishes tracking performance
  - Visual interrupts require immediate color classification (1-4 keys)
  - Difficulty scaling: interrupt frequency (2-7s), response window (800-1500ms), classification complexity (2-4 options)
  - Measures task-switching performance and interrupt recovery
  - Metrics: tracking (baseline, interrupt, overall RMSE), interrupt performance (accuracy, hit rate, reaction time), interference cost, recovery time

## Implementation Status

### Completed Features
- ✅ Project scaffolding with React + TypeScript + Vite
- ✅ Navigation and routing structure
- ✅ TypeScript type definitions for all data schemas
- ✅ IndexedDB wrapper for local storage (sessions, trials, profiles)
- ✅ UI layout with Tailwind CSS
- ✅ User profile and hardware profile management
- ✅ Session and module run tracking
- ✅ Module A: 1D pursuit tracking (arrow keys, momentum/curvilinear targets)
- ✅ Module B: 2D pursuit tracking (mouse + WASD, Pointer Lock API)
- ✅ Module C: Auditory selective attention (Web Audio API, Go/No-Go task)
- ✅ Module D: Mental rotation (Tetris pieces, forced rotation, accurate timing)
- ✅ Module E: Dual-task motor control (split canvas, baseline + dual-task trials, multitasking metrics)
- ✅ Module F: Triple-task motor + auditory (dual game loop, interference metrics, cognitive load measurement)
- ✅ Module G: Interrupt handling under load (visual interrupts, task switching, recovery metrics)
- ✅ Adaptive difficulty system (targets 70-85% success band)
- ✅ Analytics page with performance visualization:
  - Overview statistics (sessions, trials, modules trained)
  - Module-specific performance cards with recent metrics
  - Performance over time charts (custom SVG-based)
  - Recent sessions list with completion details

### Next Steps
1. Add gamepad/joystick support

## Input Systems

### Keyboard
- **Arrow keys** or **WASD** for directional control
- **A/D keys** for 1D horizontal control (Modules E, F)
- **Space bar** for response triggers (Modules C, F)
- Configurable sensitivity

### Mouse
- **Pointer Lock API** for unlimited 2D tracking (Module B)
- **Direct pixel positioning** for 2D control (Modules E, F)
- Relative movement capture
- Configurable sensitivity

### Gamepad (Future)
- Gamepad API integration planned
- Axis mapping and deadzone configuration
- Support for joystick, throttle, rudder pedals

## Metrics & Adaptive Difficulty

### Tracking Metrics (Modules A & B)
- **MAE** (Mean Absolute Error) - Average distance from target
- **RMSE** (Root Mean Square Error) - Emphasizes larger errors
- **Time on Target** - Percentage within tolerance threshold
- **Reacquisition Time** - Time to return to target after loss

### Attention Metrics (Module C)
- **d-prime** (d') - Sensitivity index from signal detection theory
- **Hit Rate** - Proportion of correct responses to target stimuli
- **False Alarm Rate** - Proportion of incorrect responses to non-target stimuli
- **Reaction Time** - Mean and distribution of response latencies

### Spatial Metrics (Module D)
- **Accuracy** - Percentage of correct answers
- **Reaction Time** - Mean time per task
- **Speed-Accuracy Tradeoff** - Combined performance metric

### Multitask Metrics (Module E)
- **Dual-Task Cost** - Performance degradation when multitasking: `(dualRMSE - baselineRMSE) / baselineRMSE`
- **Baseline RMSE** - Average tracking error across both tasks when performed individually
- **Dual RMSE** - Average tracking error across both tasks when performed simultaneously

### Triple-Task Metrics (Module F)
- **Dual-Motor Cost** - Motor performance degradation during triple-task vs baselines
- **Auditory Cost** - Auditory d-prime degradation during triple-task vs baseline
- **Motor Interference Cost** - Overall RMSE degradation from motor baselines
- **Interference Metrics** - Tracking error spikes in ±500ms windows around auditory events
  - Error spikes around responses (when user pressed spacebar)
  - Error spikes around stimuli (all auditory tones)
  - Mean error spike magnitudes

### Interrupt Handling Metrics (Module G)
- **Tracking Performance**
  - Baseline RMSE (no interrupts nearby)
  - Interrupt RMSE (±1000ms around interrupts)
  - Interference Cost (tracking degradation during interrupts)
- **Interrupt Task Performance**
  - Accuracy (% correct classifications)
  - Hit Rate (% responded in time)
  - Miss Rate (% not responded in time)
  - Mean Reaction Time
- **Recovery Metrics**
  - Mean Recovery Time (time to return to baseline tracking quality)

### Adaptive System
- Targets 70-85% success rate across all modules
- Adjusts difficulty incrementally (+/- 0.05 per trial)
- Module-specific difficulty scaling:
  - Tracking: Target speed and complexity
  - Attention: Tone similarity and ISI jitter
  - Spatial: Rotation granularity (90° vs 45° steps) and mirror distractors

## Data Privacy

- All data stored locally in browser (IndexedDB)
- No analytics, telemetry, or tracking
- No account or login required
- No network requests (fully offline capable)

## Design Constraints

This project follows clean-room design principles:

### Explicitly Avoided
- Fixed task ordering that mirrors selection tests
- Canonical timing envelopes
- "Practice test" or "exam simulation" modes
- Proprietary task structures

### Explicitly Allowed
- Training the same latent abilities (motor control, attention, spatial reasoning)
- Aviation-relevant metaphors (in training-only modes)
- Standard aviation instruments (with clear labeling as training aids)

See `DESIGN_RATIONALE.md` for full rationale.

## Development Notes

- Uses `requestAnimationFrame` for high-frequency task loops (60+ fps)
- `performance.now()` for high-precision timestamps
- Web Audio API for pure tone generation (Module C)
- Pointer Lock API for unlimited mouse tracking (Module B)
- All stimuli randomized to prevent memorization
- Adaptive difficulty maintains engagement without frustration

## Known Issues

None currently. All core training modules (A-G) are implemented and functional.

## License

MIT License - see [LICENSE](LICENSE) file for details.
