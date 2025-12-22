/**
 * Metrics calculation for Module G (Interrupt Handling Under Load)
 */

import type { TrackingSample2D } from './metricsCalculation2D'
import type { InterruptResponse, Interrupt } from './interruptTasks'

export interface InterruptMetrics {
  // Tracking performance
  baselineRMSE: number // RMSE during baseline periods (no interrupts nearby)
  interruptRMSE: number // RMSE during interrupt windows (±1000ms)
  overallRMSE: number // RMSE across entire trial
  interferenceCost: number // (interruptRMSE - baselineRMSE) / baselineRMSE

  // Interrupt task performance
  interruptAccuracy: number // % correct responses
  interruptHitRate: number // % responded in time (correct or not)
  interruptMissRate: number // % not responded in time
  interruptErrorRate: number // % responded incorrectly
  meanReactionTime: number // Mean RT for correct responses (ms)

  // Recovery metrics
  meanRecoveryTime: number // Time to return to baseline tracking after interrupt (ms)

  // Raw counts
  totalInterrupts: number
  correctResponses: number
  incorrectResponses: number
  missedResponses: number
}


/**
 * Calculate metrics for interrupt handling trial
 */
export function calculateInterruptMetrics(
  samples: TrackingSample2D[],
  interrupts: Interrupt[],
  responses: InterruptResponse[],
  baselineDuration: number
): InterruptMetrics {
  if (samples.length === 0) {
    return createEmptyMetrics()
  }

  // Define interrupt windows (±1000ms around each interrupt)
  const interruptWindows = interrupts.map((interrupt) => ({
    startTime: interrupt.appearTime - 1000,
    endTime: interrupt.appearTime + 1000,
  }))

  // Classify samples
  const baselineSamples: TrackingSample2D[] = []
  const interruptSamples: TrackingSample2D[] = []

  for (const sample of samples) {
    const isInInterruptWindow = interruptWindows.some(
      (window) => sample.timestamp >= window.startTime && sample.timestamp <= window.endTime
    )

    if (isInInterruptWindow) {
      interruptSamples.push(sample)
    } else if (sample.timestamp < baselineDuration) {
      // Only count as baseline if before first interrupt
      baselineSamples.push(sample)
    }
  }

  // Calculate RMSEs
  const baselineRMSE = calculateRMSE(baselineSamples)
  const interruptRMSE = calculateRMSE(interruptSamples)
  const overallRMSE = calculateRMSE(samples)
  const interferenceCost = baselineRMSE > 0 ? (interruptRMSE - baselineRMSE) / baselineRMSE : 0

  // Calculate interrupt task metrics
  const correctResponses = responses.filter((r) => r.correct && !r.missed).length
  const incorrectResponses = responses.filter((r) => !r.correct && !r.missed).length
  const missedResponses = responses.filter((r) => r.missed).length
  const totalInterrupts = interrupts.length

  const interruptAccuracy = totalInterrupts > 0 ? correctResponses / totalInterrupts : 0
  const interruptHitRate =
    totalInterrupts > 0 ? (correctResponses + incorrectResponses) / totalInterrupts : 0
  const interruptMissRate = totalInterrupts > 0 ? missedResponses / totalInterrupts : 0
  const interruptErrorRate = totalInterrupts > 0 ? incorrectResponses / totalInterrupts : 0

  // Mean reaction time (only for correct responses)
  const correctResponseTimes = responses.filter((r) => r.correct && !r.missed).map((r) => r.responseTime)
  const meanReactionTime =
    correctResponseTimes.length > 0
      ? correctResponseTimes.reduce((sum, rt) => sum + rt, 0) / correctResponseTimes.length
      : 0

  // Calculate recovery times
  const meanRecoveryTime = calculateMeanRecoveryTime(samples, interrupts, responses, baselineRMSE)

  return {
    baselineRMSE,
    interruptRMSE,
    overallRMSE,
    interferenceCost,
    interruptAccuracy,
    interruptHitRate,
    interruptMissRate,
    interruptErrorRate,
    meanReactionTime,
    meanRecoveryTime,
    totalInterrupts,
    correctResponses,
    incorrectResponses,
    missedResponses,
  }
}

/**
 * Calculate RMSE from samples
 */
function calculateRMSE(samples: TrackingSample2D[]): number {
  if (samples.length === 0) return 0

  const sumSquaredErrors = samples.reduce((sum, sample) => {
    const dx = sample.targetPosition.x - sample.cursorPosition.x
    const dy = sample.targetPosition.y - sample.cursorPosition.y
    const error = Math.sqrt(dx * dx + dy * dy)
    return sum + error * error
  }, 0)

  return Math.sqrt(sumSquaredErrors / samples.length)
}

/**
 * Calculate mean recovery time across all interrupts
 * Recovery time = time to return to baseline tracking quality after interrupt
 */
function calculateMeanRecoveryTime(
  samples: TrackingSample2D[],
  interrupts: Interrupt[],
  responses: InterruptResponse[],
  baselineRMSE: number
): number {
  const recoveryTimes: number[] = []
  const recoveryThreshold = baselineRMSE * 1.2 // Within 120% of baseline = recovered

  for (const interrupt of interrupts) {
    // Find corresponding response
    const response = responses.find((r) => r.interruptId === interrupt.id)
    if (!response || response.missed) continue

    // Start looking for recovery after response
    const searchStartTime = interrupt.appearTime + response.responseTime

    // Find samples after response
    const postResponseSamples = samples.filter((s) => s.timestamp > searchStartTime)

    // Calculate rolling average error over windows
    let recoveryTime: number | null = null

    for (let i = 0; i < postResponseSamples.length - 10; i++) {
      const windowSamples = postResponseSamples.slice(i, i + 10)
      const windowRMSE = calculateRMSE(windowSamples)

      if (windowRMSE <= recoveryThreshold) {
        // Found recovery point
        recoveryTime = windowSamples[0].timestamp - searchStartTime
        break
      }
    }

    // If we found a recovery time, add it
    if (recoveryTime !== null) {
      recoveryTimes.push(recoveryTime)
    }
  }

  // Return mean recovery time
  return recoveryTimes.length > 0
    ? recoveryTimes.reduce((sum, rt) => sum + rt, 0) / recoveryTimes.length
    : 0
}

/**
 * Create empty metrics object
 */
function createEmptyMetrics(): InterruptMetrics {
  return {
    baselineRMSE: 0,
    interruptRMSE: 0,
    overallRMSE: 0,
    interferenceCost: 0,
    interruptAccuracy: 0,
    interruptHitRate: 0,
    interruptMissRate: 0,
    interruptErrorRate: 0,
    meanReactionTime: 0,
    meanRecoveryTime: 0,
    totalInterrupts: 0,
    correctResponses: 0,
    incorrectResponses: 0,
    missedResponses: 0,
  }
}
