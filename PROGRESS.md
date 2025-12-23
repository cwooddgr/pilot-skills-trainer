# Development Progress

**Last Updated:** 2025-12-23
**Status:** All 7 modules (A-G) complete. Analytics page complete. Rudder pedal support complete.

---

## ✅ Completed

### Project Scaffolding
- ✅ React 18 + TypeScript + Vite setup
- ✅ Tailwind CSS for styling
- ✅ React Router with navigation
- ✅ Complete directory structure (`components/`, `modules/`, `types/`, `utils/`, `lib/`)
- ✅ Build system working with no errors
- ✅ DESIGN_RATIONALE.md added to document clean-room constraints

### Data Layer
- ✅ TypeScript type definitions for all canonical data objects:
  - `UserProfile`, `HardwareProfile`, `Session`, `ModuleRun`, `Trial`, `EventSample`
  - All metrics interfaces: `TrackingMetrics`, `AttentionMetrics`, `SpatialMetrics`, `MultitaskMetrics`
- ✅ IndexedDB wrapper (`src/lib/db.ts`) with full CRUD operations
- ✅ Data export functionality built into DB layer

### Module A: 1D Pursuit Tracking ✅
- ✅ Three target generation algorithms implemented:
  - Ornstein-Uhlenbeck process (mean-reverting random walk)
  - Sum of sinusoids with varying frequencies
  - Piecewise-constant acceleration with bounded jerk
- ✅ Input system (`src/utils/inputSystem.ts`):
  - Keyboard control (Arrow keys or WASD)
  - Mouse control (vertical axis)
  - Architecture ready for gamepad integration
  - `requestAnimationFrame` based update loop
- ✅ Canvas rendering at 60 FPS with visual feedback
- ✅ Metrics calculation (`src/utils/trackingMetrics.ts`):
  - MAE (Mean Absolute Error)
  - RMSE (Root Mean Squared Error)
  - Time on target (percentage)
  - Reacquisition time
- ✅ Trial management with automatic IndexedDB persistence
- ✅ Adaptive difficulty based on RMSE thresholds

### Module B: 2D Pursuit Tracking ✅
- ✅ Full 2D target generation:
  - Momentum-based algorithm with inertia and friction
  - Curvilinear algorithm with smooth curved paths
- ✅ 2D input system:
  - Mouse (horizontal) + WASD (vertical) control
  - Pointer Lock API for unlimited mouse movement
  - Configurable sensitivity
- ✅ 800x600 canvas with real-time visual feedback
- ✅ 2D metrics calculation:
  - MAE, RMSE (2D distance)
  - Time on target (circular tolerance)
  - Reacquisition time after target loss
- ✅ Extended input system to support full 2D control

### Module C: Auditory Selective Attention ✅
- ✅ Web Audio API integration for pure tone generation
- ✅ Three tone frequencies: 440Hz, 587Hz, 880Hz
- ✅ Go/No-Go task implementation:
  - Preparation phase with target tone preview
  - 30 stimuli per trial with jittered ISI (1.0-2.0s)
  - Space bar response mechanism
- ✅ Signal detection metrics:
  - d-prime (d') calculation
  - Hit rate and false alarm rate
  - Reaction time analysis (mean, median, distribution)
- ✅ Fixed critical bugs:
  - React closure bug in keyboard event handler (used ref instead of state)
  - Visual design flaw where colored circles revealed tone type
  - Final stimulus timing issue (response window)

### Module D: Mental Rotation ✅
- ✅ 2D shape rendering with SVG paths
- ✅ Three asymmetric Tetris pieces (J, F, Z)
- ✅ Proper rotation and mirror transformations
- ✅ Spatial metrics (accuracy, reaction time, speed-accuracy tradeoff)
- ✅ Correct answer always requires mental rotation (90°, 180°, or 270° from reference)
- ✅ Difficulty scaling: low (1 mirror) → high (3 mirrors)
- ✅ Accurate reaction time measurement (timer starts after render using useEffect + requestAnimationFrame)
- ✅ Fixed all distractor generation bugs (removed L/S pieces to avoid duplicate mirrors)

### Module E: Dual-Task Motor Control ✅
- ✅ Split canvas architecture (1200x400 canvas):
  - Left panel (600px): 1D horizontal tracking
  - Right panel (600px): 2D tracking
- ✅ Separate input systems:
  - 1D task: Keyboard accumulator (A/D keys) independent of InputSystem
  - 2D task: Mouse position from InputSystem
  - Full input separation prevents cross-task interference
- ✅ Baseline trial system:
  - Sequential baseline trials (1D alone → 2D alone)
  - Auto-advance after 1D baseline completes
  - Baseline metrics stored in component state
- ✅ Dual-task trial:
  - Unified game loop updating both tasks simultaneously
  - Separate sample recording for each task
  - Combined event tagging for database storage
- ✅ Multitask metrics calculation:
  - Dual-task cost: `(dualRMSE - baselineRMSE) / baselineRMSE`
  - Separate tracking metrics for each task
  - Reuses existing `calculateTrackingMetrics()` functions
- ✅ Trial management and data persistence
- ✅ Real-time visual feedback with split rendering
- ✅ Complete TypeScript type safety

### Module F: Triple-Task (Motor + Auditory) ✅
- ✅ Split canvas architecture (900x400 canvas):
  - Left panel (450px): 1D horizontal tracking
  - Right panel (450px): 2D tracking
  - Auditory feedback area below canvas
- ✅ Three independent input channels:
  - A/D keys: 1D horizontal tracking
  - Mouse position: 2D tracking
  - Spacebar: Auditory Go/No-Go responses (gated by trial state)
- ✅ Dual game loop architecture:
  - Motor loop: requestAnimationFrame (60 FPS) for tracking tasks
  - Auditory loop: setTimeout scheduled for stimulus presentation
  - Both loops controlled by trialModeRef to avoid closure bugs
- ✅ Baseline trial sequence:
  - 1D baseline (30s) → auto-advance
  - 2D baseline (30s, click-to-start) → auto-advance
  - Audio baseline (60s, 5s countdown showing target tones) → idle
- ✅ Triple-task trial:
  - 5s countdown showing target tones
  - Click-to-start ready state
  - All three tasks run simultaneously for 60s
- ✅ Interference metrics calculation:
  - Tracking error spikes in ±500ms windows around auditory events
  - Separate analysis for responses and stimuli
  - Mean error spike magnitudes
- ✅ Triple-task metrics:
  - Dual-motor cost: motor degradation vs baselines
  - Auditory cost: d-prime degradation vs baseline
  - Motor interference cost: overall RMSE impact
  - Full tracking metrics for both 1D and 2D
  - Full attention metrics (d-prime, hit rate, false alarms)
- ✅ UI refinements:
  - Target tones displayed with yellow borders during preparation
  - Neutral music note icon during stimulus (no type labels)
  - Proper cursor positioning in right panel for ready state
  - Canvas width optimized for page layout (900px)
- ✅ Complete data persistence with merged event streams

### UI/UX
- ✅ Home page with project overview
- ✅ Navigation between all main sections
- ✅ Training page with module selection (A, B, C, D, E, F)
- ✅ Analytics page with performance visualization
- ✅ Placeholder pages for Hardware, Export
- ✅ Session status display with trial counts
- ✅ All modules fully interactive with real-time feedback

### Adaptive Difficulty System
- ✅ Targets 70-85% success rate across modules
- ✅ Incremental adjustment (±0.05 per trial)
- ✅ Module-specific difficulty scaling:
  - **Module A/B**: Target speed and motion complexity
  - **Module C**: Tone similarity and ISI jitter (not yet implemented)
  - **Module D**: Rotation granularity (90° vs 45°) and mirror distractors

### Analytics Page ✅
- ✅ Overview statistics (total sessions, trials, modules trained)
- ✅ Module performance cards with recent metrics
- ✅ Performance over time charts for each module:
  - **Tracking (A/B)**: RMSE and Time on Target progression
  - **Attention (C)**: d-prime and Hit Rate progression
  - **Spatial (D)**: Accuracy and Reaction Time progression
  - **All modules**: Difficulty progression
- ✅ Recent sessions list with module completion details
- ✅ Custom SVG-based LineChart component (no external dependencies)
- ✅ Data fetching from IndexedDB with proper relationship reconstruction
- ✅ Module-specific metric visualization based on metric type

### Gamepad/Rudder Pedal Support ✅
- ✅ Gamepad API integration with centralized `gamepadManager` singleton
- ✅ Auto-detection with connection/disconnection events
- ✅ Full calibration UI in Hardware page:
  - Axis selection with live value monitoring
  - Min/max calibration wizard (3-step process)
  - Deadzone adjustment slider
  - Sensitivity curves (linear, quadratic, cubic)
  - Axis inversion toggle
  - Test area with mini 1D tracking canvas
- ✅ `HardwareContext` React context for global hardware state
- ✅ `useGamepad1DInput` custom hook for module consumption
- ✅ Exclusive input mode for 1D tracking:
  - When gamepad detected, disables keyboard/mouse for 1D axis
  - Applies to Modules A, E, F
- ✅ IndexedDB persistence of hardware profiles
- ✅ Sensitivity curve functions: linear, quadratic, cubic
- ✅ Low-pass filter for input smoothing
- ✅ Safari compatibility warning (limited Gamepad API support)

---

## 🐛 Bugs Fixed

### Module A/B
1. **Input axis mismatch** - Module A was rendering vertically but reading horizontal mouse input
   - Fixed: Changed from `inputState.x` to `inputState.y`
   - Changed keyboard from ArrowLeft/Right to ArrowUp/Down

2. **Smoothness metric explosion** - Jerk-based calculation produced values in millions
   - Fixed: Replaced with total variation metric (average absolute change in input)
   - New range: 0.00-0.10 instead of millions

3. **TypeScript readonly property error** - Couldn't reassign phases array in SinusoidGenerator
   - Fixed: Use loop to modify array elements instead of reassignment

4. **Missing foreign keys** - ModuleRun and Trial lacked sessionId/moduleRunId
   - Fixed: Added proper relational IDs to type definitions

### Module C
5. **Keyboard handler closure bug** - Space bar not registering during trials
   - Root cause: Event listener captured stale `trialState` value
   - Fixed: Used `isTrialRunning` ref instead of checking state in event handler

6. **Visual design revealing answers** - Colored circles showed which tone was playing
   - Fixed: Made all stimulus indicators neutral gray
   - Removed color coding from preparation phase

7. **Final stimulus timing** - Trial ended immediately without response window
   - Fixed: Added setTimeout with response window duration after last tone

### Module D
8. **Answers all incorrect** - 3D rotation visualization was oversimplified
   - Fixed: Complete rewrite using 2D shapes with proper SVG path rendering
   - Added mathematical rotation/mirror transformation functions

9. **Relative direction angle calculation** - Sign was inverted (left/right swapped)
   - Fixed: Changed from `queryAngle - forwardAngle` to `forwardAngle - queryAngle`
   - (Later removed entire relative direction variant per user feedback)

10. **Unused import warnings** - Various cleanup across modules
    - Fixed: Removed unused imports and functions

11. **Duplicate correct answers** - Adding L and S pieces created mirror-image pairs
    - Root cause: L is mirrored J, S is mirrored Z - treated as separate shapes caused duplicates
    - Fixed: Removed L and S from shape array, let mirroring transformation create them

12. **T-piece symmetry** - T-piece symmetric about X axis, mirrors looked identical
    - Fixed: Replaced with asymmetric F-piece
    - Final shape set: J, F, Z (all asymmetric about both axes)

13. **Correct answer at 0° rotation** - Too easy, no mental rotation required
    - Fixed: Correct answer rotated 90°, 180°, or 270° RELATIVE to reference
    - Now always requires mental rotation

14. **Reaction time 10x too large** - Measured ~3000ms when actual was <1000ms
    - Root cause: Timer started before React rendered task, included 1000ms feedback delay
    - Fixed: Use useEffect + requestAnimationFrame to start timer AFTER task visible on screen
    - Now measures accurate user reaction time only

### Analytics Page
15. **Analytics page showing 0 for all stats** - Total trials and modules trained both showed 0
    - Root cause: Sessions stored in IndexedDB didn't include nested moduleRuns and trials
    - Fixed: Added getAllTrials() and getAllModuleRuns() functions, reconstructed relationships in memory
    - Now fetches all data separately and joins using Maps

16. **Time on Target showing >100% values** - Displayed 3187.1% and 6646.3% instead of 31.87% and 66.46%
    - Root cause: timeOnTarget already stored as percentage (0-100) but display multiplied by 100 again
    - Fixed: Removed `* 100` multiplication in both stat card and chart displays

17. **Chart content extending past container** - Grid lines, data points, and lines extended beyond dark background
    - Root cause: SVG had overflow-visible class and insufficient padding
    - Fixed: Removed overflow-visible, increased padding (left: 60px, right: 80px, top: 20px, bottom: 40px)

18. **Y-axis label overlapping tick values** - "Difficulty (%)" text overwrote numeric labels
    - Root cause: Y-axis label positioned too close to tick values
    - Fixed: Increased left padding and positioned label at x=16 instead of x=12

### Rudder Pedals / Gamepad
19. **Module A target speed too fast** - Horizontal axis much wider than vertical, target too fast
    - Fixed: Reduced all target generator speeds by 50% (theta, sigma, frequency, acceleration)

20. **Module E canvas too wide** - 1200px width was too large
    - Fixed: Reduced to 1000px (500px per panel)

21. **Module E click-to-start not working** - Click detection using hardcoded panel widths
    - Fixed: Changed to use `leftPanelWidth` and `rightPanelWidth` variables

22. **Module E 2D target movement restricted** - Target moving in small area
    - Fixed: Increased margin from 0.8 to 0.9 (90% of panel used vs 80%)

---

## 📊 Performance Tested

### Module A (1D Tracking)
- MAE: ~0.05-0.15 (working well)
- RMSE: ~0.07-0.15 (working well)
- Time on Target: ~20-30% at difficulty 0.3
- Reacquisition: Fast recovery after overshoots

### Module B (2D Tracking)
- User tested with mouse + WASD controls
- Pointer Lock API working correctly
- 2D distance calculations accurate
- Motion feels smooth and responsive

### Module C (Auditory Attention)
- User results: 94.7% hit rate, 0% false alarm rate
- d-prime: 3.95 (excellent discrimination)
- Reaction times: Reasonable distribution
- No false visual cues remaining

### Module D (Mental Rotation) ✅
- All bugs fixed, fully functional
- Tetris pieces (J, F, Z) render correctly with proper perimeters
- Rotation/mirror transformations accurate
- Only one correct answer per task (guaranteed)
- Reaction times accurate (<1 second for quick responses)
- Difficulty scaling works correctly (mirrors increase challenge)
- Mental rotation forced on every task (no 0° correct answers)

---

## 🎯 Next Steps

### High Priority
1. **Analytics Page Enhancements**
   - Add Module E visualization (dual-task cost)
   - Add Module F visualization (interference metrics)
   - Add Module G visualization (interrupt handling metrics)
   - Charts for all module types

### Medium Priority
2. **Additional Calibration Features**
   - 2D gamepad support (joysticks for Module B)
   - Multiple device profiles
   - Per-module sensitivity overrides

3. **Training Improvements**
   - Session notes and metadata
   - Configurable trial parameters
   - Baseline assessment mode

---

## 🔧 Technical Decisions & Patterns

### Architecture Patterns
- **Refs for game state**: Using `useRef` for high-frequency state (cursor position, samples) to avoid re-renders during `requestAnimationFrame` loop
- **State for UI**: Using `useState` only for UI-relevant state (trial status, metrics display)
- **Timestamp source**: `performance.now()` for all event timestamps (monotonic, high-resolution)
- **Data persistence**: All trial data automatically saved to IndexedDB on completion
- **Refs for event handlers**: Use refs when event listeners need access to current state to avoid closure bugs

### Code Organization
- **Utilities are pure functions** where possible (target generators, metrics calculation)
- **Input system is a class** to manage complex stateful event listeners
- **Module components** are responsible for their own rendering and trial management
- **Page components** handle session/run management and coordinate between modules
- **Separate files for task generation**: `targetGeneration.ts`, `spatialTasks.ts`, etc.

### Styling Conventions
- Dark theme: `bg-slate-900` base, `bg-slate-800` cards
- Accent color: `text-blue-400` / `bg-blue-600`
- Status colors: green (active), red (stop), slate (inactive)
- Monospace font for numeric values and codes
- Consistent card layout with rounded corners and padding

---

## 📝 Technical Notes

### Input System
- **Module A**: Keyboard (Arrow/WASD) or Mouse (vertical only)
- **Module B**: Mouse (horizontal) + WASD (vertical) + Pointer Lock API
- **Module C**: Space bar for Go/No-Go responses
- All inputs normalized to appropriate ranges
- Configurable sensitivity via settings (not yet exposed in UI)

### Target Generation
- **Module A**: Three algorithms (Ornstein-Uhlenbeck, sinusoids, piecewise acceleration)
- **Module B**: Two algorithms (momentum-based, curvilinear paths)
- All generators implement standard interface
- Difficulty parameter (0-1) scales motion characteristics
- Bounds are enforced to keep targets within canvas

### Audio System (Module C)
- Web Audio API with OscillatorNode for pure tones
- Three frequencies: 440Hz (A4), 587Hz (D5), 880Hz (A5)
- Gain ramping to prevent clicks (10ms attack/release)
- Jittered ISI: 1.0-2.0s uniform distribution
- User selects target tone during preparation phase

### Spatial Tasks (Module D)
- Pre-defined 2D shapes as Point2D arrays
- Transform functions: `rotatePoint()`, `mirrorPoint()`, `transformShape()`
- SVG path rendering with automatic bounds calculation and centering
- 90° rotation steps at low difficulty, 45° at high difficulty
- Distractor generation prioritizes mirrors at high difficulty

### Metrics Calculation
- **Tracking**: MAE, RMSE, time on target, reacquisition time
- **Attention**: d-prime, hit rate, false alarm rate, reaction time stats
- **Spatial**: Accuracy, mean reaction time, speed-accuracy tradeoff
- All metrics stored with full sample data for later analysis
- Downsampling will be needed for analytics visualization

### Adaptive Difficulty
- Current implementation: threshold-based per module
- **Module A/B**: RMSE threshold inversely proportional to difficulty
- **Module D**: Accuracy bands (70-85% target), adjust ±0.05
- Bounded: 0.1 to 1.0
- Could be improved with success rate windowing

---

## 🚧 Known Limitations & Technical Debt

1. **Mouse tracking needs fixing in Module A and Module B** - Issue to be addressed

2. **No data export UI** - Backend functions exist but no user interface

3. **Adaptive difficulty for Module C not implemented** - Difficulty parameter exists but doesn't affect tone similarity or ISI jitter

4. **Hard-coded trial parameters** - Duration, number of stimuli, etc. should be configurable

5. **No baseline assessment** - PROJECT.md specifies optional baseline, not implemented

6. **Session management is simple** - No session naming, notes, or metadata

7. **Pointer Lock exit not handled gracefully** - User can exit pointer lock without app knowing

---

## 💾 Database Schema

All data stored locally in IndexedDB:

**Object Stores:**
- `userProfiles` (key: id)
- `hardwareProfiles` (key: id)
- `sessions` (key: id, indexes: timestamp, userProfileId)
- `moduleRuns` (key: id, indexes: sessionId, moduleId)
- `trials` (key: id, indexes: moduleRunId, startTimestamp)

**Relationships:**
- UserProfile → HardwareProfile (1:1)
- Session → UserProfile (many:1)
- ModuleRun → Session (many:1)
- Trial → ModuleRun (many:1)

**Data Flow:**
1. User starts module → Create Session (if needed)
2. Create ModuleRun linked to Session
3. User completes trial → Create Trial with full EventSample data
4. Calculate metrics and store in Trial
5. Update adaptive difficulty for next trial

---

## 🎮 Current User Flow

1. Navigate to Training page
2. System auto-creates UserProfile and HardwareProfile on first visit
3. Click module card (A, B, C, or D) to start session
4. System creates Session and ModuleRun
5. Click "Start Trial" to begin
6. Complete trial (30s for tracking, 30 stimuli for attention, 15 tasks for spatial)
7. View metrics in results card
8. Difficulty adapts automatically
9. Run more trials or return to module selection
10. Click "End Session" when done

---

## 🔍 Testing Checklist

### Module A ✅
- [x] Test with keyboard (Up/Down arrows)
- [x] Test with keyboard (WASD)
- [x] Test with mouse (vertical axis)
- [x] Verify metrics display correctly
- [x] Verify data persists in IndexedDB
- [x] Test adaptive difficulty increase/decrease

### Module B ✅
- [x] Test mouse + WASD controls
- [x] Verify Pointer Lock API works
- [x] Test 2D distance calculations
- [x] Verify metrics display correctly
- [x] Test reacquisition time tracking

### Module C ✅
- [x] Verify all three tone frequencies are distinct
- [x] Test Go/No-Go response (Space bar)
- [x] Verify d-prime calculation
- [x] Test preparation phase (tone preview)
- [x] Verify no visual cues reveal answers
- [x] Test final stimulus response window

### Module D ✅
- [x] Verify all 4 options are visually distinct
- [x] Test rotation transformations
- [x] Test mirror transformations
- [x] Verify metrics calculation
- [x] Test across multiple difficulty levels
- [x] Verify reaction time accuracy
- [x] Verify correct answer always requires mental rotation

---

## 📚 Resources

- **PROJECT.md**: Authoritative requirements and constraints
- **TECHNICAL.md**: Implementation specifications and algorithms
- **DESIGN_RATIONALE.md**: Clean-room design decisions and ethical boundaries
- **README.md**: Setup and project structure documentation

---

## 🤝 Working with Claude Code

This project is being built with Claude Code CLI. Best practices:
- Keep PROGRESS.md updated after major milestones
- Document bugs and fixes as they occur
- Note any deviations from PROJECT.md/TECHNICAL.md specifications
- Use clear commit messages when code is working

**Current Session Context:**
- Modules A, B, C, D, E, F fully complete and tested
- Analytics page fully implemented with charts and performance visualization
- Added MIT License to project
- Next: Build Module G (Interrupt Handling Under Load)

---

## 🎓 Lessons Learned

1. **React closure bugs are subtle** - Event listeners that capture state values can cause hard-to-debug issues. Solution: use refs for values that change frequently and are accessed in event handlers.

2. **Visual design affects validity** - Module C's colored circles inadvertently provided visual cues that defeated the auditory discrimination test. Always consider what information is being leaked through UI.

3. **Spatial tasks are harder than expected** - Generating visually distinct rotation/mirror combinations requires careful consideration of shape symmetries. Simple geometric shapes can have unexpected symmetries.

4. **Start simple, then add complexity** - Module D attempted both mental rotation and relative direction tasks. User feedback led to focusing on just mental rotation, which was more cognitively demanding.

5. **Test early, test often** - User testing revealed bugs that weren't apparent during development (symmetry issues, timing problems).

6. **Document design decisions** - DESIGN_RATIONALE.md added to explicitly document clean-room constraints and prevent scope creep toward exam simulation.

7. **Mirror-image shapes create subtle bugs** - Adding L-piece (mirrored J) and S-piece (mirrored Z) as separate shapes caused duplicate correct answers when algorithm selected one as reference and the other as distractor. Solution: Keep shape array minimal, use mirroring transformation to create variants.

8. **Timing measurements require careful thought** - React state updates are asynchronous. Timer must start AFTER browser paints new content, not when state is set. Use `useEffect` + `requestAnimationFrame` to ensure timer starts after render.

---

## 📈 Project Statistics

- **Total Modules Planned**: 7 (A-G)
- **Modules Complete**: 6 (A, B, C, D, E, F)
- **Modules In Progress**: 0
- **Modules Remaining**: 1 (G)
- **Analytics Page**: ✅ Complete
- **Known Bugs**: 0
- **Build Status**: ✅ Passing
- **Bundle Size**: ~278 KB (gzipped: ~79 KB)
