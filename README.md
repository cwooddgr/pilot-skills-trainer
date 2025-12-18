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

### Planned

- **Module E** — Dual-Task Motor Control
- **Module F** — Triple-Task (Motor + Auditory)
- **Module G** — Interrupt Handling Under Load

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
- ✅ Adaptive difficulty system (targets 70-85% success band)

### In Progress
- 📋 Analytics page with performance visualization

### Next Steps
1. Implement Analytics page with charts and trend analysis
2. Build Module E (Dual-Task Motor Control)
3. Build Module F (Triple-Task)
4. Build Module G (Interrupt Handling)
6. Add data export (JSON/CSV)

## Input Systems

### Keyboard
- **Arrow keys** or **WASD** for directional control
- **Space bar** for response triggers (Module C)
- Configurable sensitivity

### Mouse
- **Pointer Lock API** for unlimited 2D tracking (Module B)
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
- Full data export to JSON/CSV (planned)

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

1. **Analytics Page**: Not yet implemented
2. **Data Export**: JSON/CSV export not yet implemented
3. **Gamepad Support**: Planned but not implemented

## License

See project documentation for details.
