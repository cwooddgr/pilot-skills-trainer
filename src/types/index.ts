// Canonical data objects as specified in PROJECT.md

export type ModuleId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export interface UserProfile {
  id: string
  hardwareProfileId: string
  settings: {
    preferredModules?: ModuleId[]
    targetSuccessBand?: [number, number]
    [key: string]: unknown
  }
  createdAt: number
  lastActive: number
}

export interface HardwareProfile {
  id: string
  devices: GamepadConfig[]
  lastCalibrated: number
}

export interface GamepadConfig {
  deviceId: string
  deviceName: string
  axes: AxisConfig[]
  buttons: ButtonConfig[]
}

export interface AxisConfig {
  index: number
  label: string
  mapping: 'pitch' | 'roll' | 'yaw' | 'throttle' | 'x' | 'y' | 'none'
  deadzone: number
  sensitivity: number
  inverted: boolean
  filterAlpha?: number
  calibrationMin?: number
  calibrationMax?: number
}

export interface ButtonConfig {
  index: number
  label: string
  mapping: string
}

export interface Session {
  id: string
  userProfileId: string
  timestamp: number
  moduleRuns: ModuleRun[]
  endTimestamp?: number
}

export interface ModuleRun {
  id: string
  sessionId: string
  moduleId: ModuleId
  variant: string
  startTimestamp: number
  endTimestamp?: number
  trials: Trial[]
  baselineMetrics?: MetricsSummary
}

export interface Trial {
  id: string
  moduleRunId: string
  moduleId: ModuleId
  difficulty: number
  durationMs: number
  startTimestamp: number
  events: EventSample[]
  metrics: TrialMetrics
}

export interface EventSample {
  t: number // Timestamp relative to trial start (ms)
  type: 'input' | 'stimulus' | 'response' | 'target'
  value: Record<string, unknown>
}

// Metrics interfaces

export interface TrialMetrics {
  // Tracking metrics (Modules A, B, E)
  tracking?: TrackingMetrics

  // Attention metrics (Module C)
  attention?: AttentionMetrics

  // Multitasking metrics (Modules E, F)
  multitask?: MultitaskMetrics

  // Interrupt metrics (Module G)
  interrupt?: InterruptMetrics

  // Spatial metrics (Module D)
  spatial?: SpatialMetrics
}

export interface TrackingMetrics {
  mae: number // Mean absolute error
  rmse: number // Root mean squared error
  timeOnTarget: number // Percentage
  overshootCount: number
  overshootMagnitude: number
  smoothness: number // Jerk-based
  reacquisitionTimes?: number[] // Module B
}

export interface AttentionMetrics {
  hitRate: number
  missRate: number
  falseAlarmRate: number
  dPrime: number // Signal detection metric
  reactionTimes: number[]
  meanRT: number
  medianRT: number
}

export interface MultitaskMetrics {
  dualTaskCost: number
  baselineRMSE: number
  dualRMSE: number
  interferenceSpikes?: InterferenceEvent[]
}

export interface InterferenceEvent {
  timestamp: number
  errorSpike: number
  interruptType: string
}

export interface InterruptMetrics {
  interruptRT: number[]
  meanInterruptRT: number
  errorSpikes: number[]
  recoveryTimes: number[]
  meanRecoveryTime: number
}

export interface SpatialMetrics {
  accuracy: number
  reactionTime: number
  speedAccuracyTradeoff: number
}

export interface MetricsSummary {
  tracking?: Partial<TrackingMetrics>
  attention?: Partial<AttentionMetrics>
  multitask?: Partial<MultitaskMetrics>
  interrupt?: Partial<InterruptMetrics>
  spatial?: Partial<SpatialMetrics>
}

// Module configuration

export interface ModuleConfig {
  id: ModuleId
  name: string
  description: string
  variants: string[]
  requiresHardware: ('joystick' | 'throttle' | 'rudder')[]
  defaultDifficulty: number
  minDifficulty: number
  maxDifficulty: number
  difficultyStep: number
  targetSuccessBand: [number, number]
}

// Difficulty controller state

export interface DifficultyState {
  moduleId: ModuleId
  currentDifficulty: number
  successRate: number
  trialHistory: boolean[] // Recent success/failure
}
