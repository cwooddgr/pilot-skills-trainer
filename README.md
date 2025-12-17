# Pilot Skills Trainer

A web-based application for training aviation-relevant cognitive and psychomotor skills.

## Overview

This application trains transferable skills such as continuous motor control, divided attention, spatial reasoning, and interrupt handling. All tasks are randomized and adaptive to promote skill development rather than memorization.

## Project Structure

```
tbas/
├── src/
│   ├── components/         # React components
│   │   ├── pages/         # Page components (Home, Hardware, Training, etc.)
│   │   ├── AppRoutes.tsx  # Route definitions
│   │   └── Navigation.tsx # Main navigation bar
│   ├── modules/           # Training module implementations (A-G)
│   ├── stores/            # State management
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── lib/
│   │   └── db.ts         # IndexedDB wrapper for local storage
│   ├── App.tsx           # Main application component
│   ├── main.tsx          # Application entry point
│   └── index.css         # Global styles with Tailwind
├── public/               # Static assets
├── PROJECT.md            # Project requirements and constraints
├── TECHNICAL.md          # Technical specifications
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

## Training Modules

- **Module A** — 1D Pursuit Tracking
- **Module B** — 2D Pursuit Tracking
- **Module C** — Auditory Selective Attention
- **Module D** — Spatial Orientation Microtasks
- **Module E** — Dual-Task Motor Control
- **Module F** — Triple-Task (Motor + Auditory)
- **Module G** — Interrupt Handling Under Load

## Features

### Completed
- ✅ Project scaffolding with React + TypeScript
- ✅ Navigation and routing structure
- ✅ TypeScript type definitions for all data schemas
- ✅ IndexedDB wrapper for local storage
- ✅ UI layout with Tailwind CSS

### Next Steps (Recommended Build Order)
1. **Input Detection & Calibration** - Gamepad API integration, axis mapping, deadzone configuration
2. **Module A Implementation** - 1D pursuit tracking with metrics
3. **Module B Implementation** - 2D pursuit tracking
4. **Metrics & Analytics** - Visualization of performance data
5. **Remaining Modules** - C, E, G, F in sequence

## Data Privacy

- All data stored locally in browser (IndexedDB)
- No analytics, telemetry, or tracking
- No account or login required
- Full data export to JSON/CSV

## Development Notes

- Uses `requestAnimationFrame` for high-frequency task loops
- Gamepad API for hardware input (joystick, throttle, rudder)
- Web Audio API for auditory stimuli
- Adaptive difficulty targeting 70-85% success rate
- All events timestamped with `performance.now()`

## License

See project documentation for details.
