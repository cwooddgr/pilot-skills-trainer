// 2D Tracking metrics calculation for Module B
// Based on TECHNICAL.md specifications

import type { TrackingMetrics, EventSample } from '@/types'

export interface TrackingSample2D {
  timestamp: number
  targetPosition: { x: number; y: number }
  cursorPosition: { x: number; y: number }
  inputValue: { x: number; y: number }
}

/**
 * Calculate 2D tracking metrics including reacquisition time
 */
export function calculateTrackingMetrics2D(
  samples: TrackingSample2D[],
  targetThreshold: number = 0.1 // Euclidean distance threshold for "on target"
): TrackingMetrics {
  if (samples.length === 0) {
    return {
      mae: 0,
      rmse: 0,
      timeOnTarget: 0,
      overshootCount: 0,
      overshootMagnitude: 0,
      smoothness: 0,
      reacquisitionTimes: [],
    }
  }

  const errors: number[] = []
  const squaredErrors: number[] = []
  const absErrors: number[] = []
  let timeOnTarget = 0
  const reacquisitionTimes: number[] = []
  let isOffTarget = false
  let lossTime = 0

  // Calculate Euclidean distance errors
  for (const sample of samples) {
    const dx = sample.targetPosition.x - sample.cursorPosition.x
    const dy = sample.targetPosition.y - sample.cursorPosition.y
    const error = Math.sqrt(dx * dx + dy * dy)

    errors.push(error)
    absErrors.push(error)
    squaredErrors.push(error * error)

    // Track time on target and reacquisition
    if (error <= targetThreshold) {
      timeOnTarget++

      // If we were off target and now we're back on, record reacquisition time
      if (isOffTarget) {
        const reacqTime = sample.timestamp - lossTime
        reacquisitionTimes.push(reacqTime)
        isOffTarget = false
      }
    } else {
      // We're off target
      if (!isOffTarget) {
        // Just lost the target
        lossTime = sample.timestamp
        isOffTarget = true
      }
    }
  }

  // MAE and RMSE
  const mae = absErrors.reduce((sum, e) => sum + e, 0) / absErrors.length
  const rmse = Math.sqrt(squaredErrors.reduce((sum, e) => sum + e, 0) / squaredErrors.length)

  // Overshoot detection in 2D is more complex
  // Count significant direction changes when far from target
  let overshootCount = 0
  let totalOvershootMagnitude = 0

  for (let i = 2; i < samples.length; i++) {
    const prev = samples[i - 2]
    const next = samples[i]

    // Calculate vectors from cursor to target
    const vec1x = prev.targetPosition.x - prev.cursorPosition.x
    const vec1y = prev.targetPosition.y - prev.cursorPosition.y
    const vec2x = next.targetPosition.x - next.cursorPosition.x
    const vec2y = next.targetPosition.y - next.cursorPosition.y

    // Calculate dot product to detect direction reversal
    const dot = vec1x * vec2x + vec1y * vec2y
    const mag1 = Math.sqrt(vec1x * vec1x + vec1y * vec1y)
    const mag2 = Math.sqrt(vec2x * vec2x + vec2y * vec2y)

    // If dot product is negative and we're off target, it's an overshoot
    if (dot < 0 && mag1 > targetThreshold && mag2 > targetThreshold) {
      overshootCount++
      totalOvershootMagnitude += (mag1 + mag2) / 2
    }
  }

  // Smoothness based on total path variation
  const smoothness = calculateSmoothness2D(samples)

  // Time on target as percentage
  const timeOnTargetPercent = (timeOnTarget / samples.length) * 100

  return {
    mae,
    rmse,
    timeOnTarget: timeOnTargetPercent,
    overshootCount,
    overshootMagnitude: overshootCount > 0 ? totalOvershootMagnitude / overshootCount : 0,
    smoothness,
    reacquisitionTimes,
  }
}

/**
 * Calculate smoothness for 2D input (total path variation)
 */
function calculateSmoothness2D(samples: TrackingSample2D[]): number {
  if (samples.length < 2) return 0

  let totalVariation = 0
  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].inputValue.x - samples[i - 1].inputValue.x
    const dy = samples[i].inputValue.y - samples[i - 1].inputValue.y
    const change = Math.sqrt(dx * dx + dy * dy)
    totalVariation += change
  }

  return totalVariation / (samples.length - 1)
}

/**
 * Convert 2D tracking samples to event samples for storage
 */
export function samplesToEvents2D(samples: TrackingSample2D[]): EventSample[] {
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
 * Convert event samples back to 2D tracking samples
 */
export function eventsToSamples2D(events: EventSample[]): TrackingSample2D[] {
  return events
    .filter((e) => e.type === 'input')
    .map((e) => ({
      timestamp: e.t,
      targetPosition: (e.value.targetPosition as { x: number; y: number }) || { x: 0, y: 0 },
      cursorPosition: (e.value.cursorPosition as { x: number; y: number }) || { x: 0, y: 0 },
      inputValue: (e.value.inputValue as { x: number; y: number }) || { x: 0, y: 0 },
    }))
}
