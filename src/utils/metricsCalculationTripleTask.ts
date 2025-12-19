import type {
  TrackingMetrics,
  AttentionMetrics,
  TrackingSample,
  TrackingSample2D,
  AttentionResponse,
} from '@/types'
import { calculateInterferenceMetrics, InterferenceMetrics } from './metricsCalculationInterference'

export interface TripleTaskMetrics {
  tracking1D: TrackingMetrics
  tracking2D: TrackingMetrics
  attention: AttentionMetrics

  dualMotorCost: number // (tripleRMSE - dualBaselineRMSE) / dualBaselineRMSE
  auditoryCost: number // (tripleDPrime - baselineDPrime) / baselineDPrime
  motorInterferenceCost: number // Overall RMSE degradation from motor baselines

  interference: InterferenceMetrics
}

export interface TripleTaskMetricsInput {
  // Triple-task metrics
  metrics1D: TrackingMetrics
  metrics2D: TrackingMetrics
  metricsAudio: AttentionMetrics

  // Baseline metrics
  baseline1D: TrackingMetrics
  baseline2D: TrackingMetrics
  baselineAudio: AttentionMetrics

  // Sample data for interference calculation
  samples1D: TrackingSample[]
  samples2D: TrackingSample2D[]
  auditoryResponses: AttentionResponse[]
}

/**
 * Calculate triple-task metrics: combines tracking, attention, and interference
 *
 * Compares triple-task performance against baselines to measure:
 * - Dual-motor cost: degradation in motor tasks when combined
 * - Auditory cost: degradation in auditory task when combined with motor
 * - Motor interference cost: overall motor degradation from adding auditory task
 * - Interference: error spikes around auditory events
 */
export function calculateTripleTaskMetrics(input: TripleTaskMetricsInput): TripleTaskMetrics {
  const {
    metrics1D,
    metrics2D,
    metricsAudio,
    baseline1D,
    baseline2D,
    baselineAudio,
    samples1D,
    samples2D,
    auditoryResponses,
  } = input

  // Calculate dual-motor baseline RMSE (average of 1D and 2D baselines)
  const dualBaselineRMSE = (baseline1D.rmse + baseline2D.rmse) / 2

  // Calculate triple-task motor RMSE (average of 1D and 2D in triple-task)
  const tripleMotorRMSE = (metrics1D.rmse + metrics2D.rmse) / 2

  // Dual-motor cost: degradation in motor tasks during triple-task vs baselines
  const dualMotorCost = (tripleMotorRMSE - dualBaselineRMSE) / dualBaselineRMSE

  // Auditory cost: degradation in d-prime during triple-task vs baseline
  // Handle case where baseline d-prime is 0 (perfect or no performance)
  const auditoryCost =
    baselineAudio.dPrime !== 0
      ? (metricsAudio.dPrime - baselineAudio.dPrime) / Math.abs(baselineAudio.dPrime)
      : 0

  // Motor interference cost: same as dual-motor cost (overall motor degradation)
  const motorInterferenceCost = dualMotorCost

  // Calculate interference metrics (error spikes around auditory events)
  const interference = calculateInterferenceMetrics(samples1D, samples2D, auditoryResponses)

  return {
    tracking1D: metrics1D,
    tracking2D: metrics2D,
    attention: metricsAudio,
    dualMotorCost,
    auditoryCost,
    motorInterferenceCost,
    interference,
  }
}
