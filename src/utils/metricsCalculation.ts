// Metrics calculation utilities for tracking performance
// Based on TECHNICAL.md specifications

import type { TrackingMetrics, EventSample } from '@/types'

export interface TrackingSample {
  timestamp: number
  targetPosition: number
  cursorPosition: number
  inputValue: number
}

/**
 * Calculate tracking metrics from trial data
 * Implements MAE, RMSE, time-on-target, overshoot, and smoothness
 */
export function calculateTrackingMetrics(
  samples: TrackingSample[],
  targetThreshold: number = 0.05 // 5% of range for time-on-target
): TrackingMetrics {
  if (samples.length === 0) {
    return {
      mae: 0,
      rmse: 0,
      timeOnTarget: 0,
      overshootCount: 0,
      overshootMagnitude: 0,
      smoothness: 0,
    }
  }

  const errors: number[] = []
  const squaredErrors: number[] = []
  const absErrors: number[] = []
  let timeOnTarget = 0
  let overshootCount = 0
  let totalOvershootMagnitude = 0

  // Calculate basic errors
  for (const sample of samples) {
    const error = sample.targetPosition - sample.cursorPosition
    errors.push(error)
    absErrors.push(Math.abs(error))
    squaredErrors.push(error * error)

    // Time on target
    if (Math.abs(error) <= targetThreshold) {
      timeOnTarget++
    }
  }

  // MAE and RMSE
  const mae = absErrors.reduce((sum, e) => sum + e, 0) / absErrors.length
  const rmse = Math.sqrt(squaredErrors.reduce((sum, e) => sum + e, 0) / squaredErrors.length)

  // Overshoot detection
  // Overshoot occurs when cursor crosses target and error changes sign
  for (let i = 1; i < errors.length; i++) {
    if (Math.sign(errors[i]) !== Math.sign(errors[i - 1]) && Math.abs(errors[i]) > targetThreshold) {
      overshootCount++
      totalOvershootMagnitude += Math.abs(errors[i])
    }
  }

  // Smoothness (jerk-based)
  // Jerk = d²(input)/dt²
  const smoothness = calculateSmoothness(samples)

  // Time on target as percentage
  const timeOnTargetPercent = (timeOnTarget / samples.length) * 100

  return {
    mae,
    rmse,
    timeOnTarget: timeOnTargetPercent,
    overshootCount,
    overshootMagnitude: overshootCount > 0 ? totalOvershootMagnitude / overshootCount : 0,
    smoothness,
  }
}

/**
 * Calculate smoothness using input variation
 * Measures the total variation in input changes (roughness)
 * Lower values indicate smoother control (0 = perfectly smooth)
 */
function calculateSmoothness(samples: TrackingSample[]): number {
  if (samples.length < 2) return 0

  // Calculate absolute changes in input between samples
  let totalVariation = 0
  for (let i = 1; i < samples.length; i++) {
    const change = Math.abs(samples[i].inputValue - samples[i - 1].inputValue)
    totalVariation += change
  }

  // Normalize by number of samples to get average variation per sample
  // This gives a value typically between 0 (no movement) and ~0.1 (very jerky)
  return totalVariation / (samples.length - 1)
}

/**
 * Convert tracking samples to event samples for storage
 */
export function samplesToEvents(samples: TrackingSample[]): EventSample[] {
  return samples.map((sample) => ({
    t: sample.timestamp,
    type: 'input' as const,
    value: {
      targetPosition: sample.targetPosition,
      cursorPosition: sample.cursorPosition,
      inputValue: sample.inputValue,
    },
  }))
}

/**
 * Convert event samples back to tracking samples
 */
export function eventsToSamples(events: EventSample[]): TrackingSample[] {
  return events
    .filter((e) => e.type === 'input')
    .map((e) => ({
      timestamp: e.t,
      targetPosition: (e.value.targetPosition as number) || 0,
      cursorPosition: (e.value.cursorPosition as number) || 0,
      inputValue: (e.value.inputValue as number) || 0,
    }))
}

/**
 * Calculate running average of recent metrics for adaptive difficulty
 */
export class MetricsTracker {
  private recentRMSE: number[] = []
  private readonly windowSize: number

  constructor(windowSize: number = 10) {
    this.windowSize = windowSize
  }

  addMetrics(metrics: TrackingMetrics): void {
    this.recentRMSE.push(metrics.rmse)
    if (this.recentRMSE.length > this.windowSize) {
      this.recentRMSE.shift()
    }
  }

  getAverageRMSE(): number {
    if (this.recentRMSE.length === 0) return 0
    return this.recentRMSE.reduce((sum, v) => sum + v, 0) / this.recentRMSE.length
  }

  /**
   * Calculate success rate based on RMSE threshold
   * Returns value between 0 and 1
   */
  getSuccessRate(threshold: number): number {
    if (this.recentRMSE.length === 0) return 0
    const successCount = this.recentRMSE.filter((rmse) => rmse < threshold).length
    return successCount / this.recentRMSE.length
  }

  reset(): void {
    this.recentRMSE = []
  }
}
