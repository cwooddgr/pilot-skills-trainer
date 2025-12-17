// Spatial orientation metrics calculation for Module D
// Based on TECHNICAL.md specifications

import type { SpatialMetrics } from '@/types'

export interface SpatialResponse {
  taskIndex: number
  selectedAnswer: number
  correctAnswer: number
  reactionTime: number // milliseconds
  isCorrect: boolean
}

/**
 * Calculate spatial orientation metrics from trial responses
 */
export function calculateSpatialMetrics(responses: SpatialResponse[]): SpatialMetrics {
  if (responses.length === 0) {
    return {
      accuracy: 0,
      reactionTime: 0,
      speedAccuracyTradeoff: 0,
    }
  }

  // Calculate accuracy (percentage correct)
  const correctCount = responses.filter((r) => r.isCorrect).length
  const accuracy = correctCount / responses.length

  // Calculate mean reaction time
  const reactionTime =
    responses.reduce((sum, r) => sum + r.reactionTime, 0) / responses.length

  // Calculate speed-accuracy tradeoff
  // Higher values = better (more accurate per unit time)
  // This rewards both speed and accuracy
  const speedAccuracyTradeoff = reactionTime > 0 ? accuracy / (reactionTime / 1000) : 0

  return {
    accuracy,
    reactionTime,
    speedAccuracyTradeoff,
  }
}

/**
 * Convert responses to event samples for storage
 */
export function responsesToEvents(responses: SpatialResponse[]) {
  return responses.map((response) => ({
    t: response.taskIndex * 1000, // Approximate timing
    type: 'response' as const,
    value: {
      taskIndex: response.taskIndex,
      selectedAnswer: response.selectedAnswer,
      correctAnswer: response.correctAnswer,
      reactionTime: response.reactionTime,
      isCorrect: response.isCorrect,
    },
  }))
}

/**
 * Determine if trial performance warrants difficulty increase
 */
export function shouldIncreaseDifficulty(
  metrics: SpatialMetrics,
  targetBand: [number, number] = [0.7, 0.85]
): boolean {
  return metrics.accuracy > targetBand[1]
}

/**
 * Determine if trial performance warrants difficulty decrease
 */
export function shouldDecreaseDifficulty(
  metrics: SpatialMetrics,
  targetBand: [number, number] = [0.7, 0.85]
): boolean {
  return metrics.accuracy < targetBand[0]
}
