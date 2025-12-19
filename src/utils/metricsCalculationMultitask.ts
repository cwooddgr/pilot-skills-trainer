// Multitask metrics calculation for Module E (Dual-Task Motor Control)
// Based on TECHNICAL.md specifications

import type { TrackingMetrics, MultitaskMetrics } from '@/types'

export interface MultitaskMetricsInput {
  baseline1D: TrackingMetrics
  baseline2D: TrackingMetrics
  dual1D: TrackingMetrics
  dual2D: TrackingMetrics
}

/**
 * Calculate multitasking metrics by comparing dual-task performance to baseline
 *
 * Dual-task cost represents performance degradation when performing both tasks simultaneously
 * Positive cost = performance worsened, Negative cost = performance improved (rare)
 */
export function calculateMultitaskMetrics(
  input: MultitaskMetricsInput
): MultitaskMetrics {
  const { baseline1D, baseline2D, dual1D, dual2D } = input

  // Calculate dual-task cost for each task
  // cost = (dualRMSE - baselineRMSE) / baselineRMSE
  const cost1D = (dual1D.rmse - baseline1D.rmse) / baseline1D.rmse
  const cost2D = (dual2D.rmse - baseline2D.rmse) / baseline2D.rmse

  // Average cost across both tasks
  const dualTaskCost = (cost1D + cost2D) / 2

  // Average RMSEs
  const baselineRMSE = (baseline1D.rmse + baseline2D.rmse) / 2
  const dualRMSE = (dual1D.rmse + dual2D.rmse) / 2

  return {
    dualTaskCost,
    baselineRMSE,
    dualRMSE,
  }
}
