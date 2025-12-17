// Attention metrics calculation for Module C
// Based on TECHNICAL.md specifications

import type { AttentionMetrics, EventSample } from '@/types'

export interface AttentionResponse {
  stimulusTimestamp: number
  responseTimestamp: number | null // null if no response
  isTarget: boolean
  responded: boolean
  reactionTime: number | null // null if no response or outside window
}

/**
 * Calculate attention metrics from responses
 * Implements hit rate, false alarm rate, and d-prime
 */
export function calculateAttentionMetrics(
  responses: AttentionResponse[]
): AttentionMetrics {
  if (responses.length === 0) {
    return {
      hitRate: 0,
      missRate: 0,
      falseAlarmRate: 0,
      dPrime: 0,
      reactionTimes: [],
      meanRT: 0,
      medianRT: 0,
    }
  }

  // Separate targets and non-targets
  const targetTrials = responses.filter((r) => r.isTarget)
  const nonTargetTrials = responses.filter((r) => !r.isTarget)

  // Count hits, misses, false alarms
  const hits = targetTrials.filter((r) => r.responded).length
  const misses = targetTrials.filter((r) => !r.responded).length
  const falseAlarms = nonTargetTrials.filter((r) => r.responded).length

  // Calculate rates
  const hitRate = targetTrials.length > 0 ? hits / targetTrials.length : 0
  const missRate = targetTrials.length > 0 ? misses / targetTrials.length : 0
  const falseAlarmRate = nonTargetTrials.length > 0 ? falseAlarms / nonTargetTrials.length : 0

  // Calculate d-prime (signal detection theory metric)
  const dPrime = calculateDPrime(hitRate, falseAlarmRate)

  // Collect reaction times (only for valid responses)
  const reactionTimes = responses
    .filter((r) => r.reactionTime !== null)
    .map((r) => r.reactionTime!)

  const meanRT = reactionTimes.length > 0
    ? reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length
    : 0

  const medianRT = reactionTimes.length > 0 ? calculateMedian(reactionTimes) : 0

  return {
    hitRate,
    missRate,
    falseAlarmRate,
    dPrime,
    reactionTimes,
    meanRT,
    medianRT,
  }
}

/**
 * Calculate d-prime using Z-score transformation
 * d' = Z(hit rate) - Z(false alarm rate)
 */
function calculateDPrime(hitRate: number, falseAlarmRate: number): number {
  // Apply correction for extreme values (0 or 1)
  // Use log-linear correction to avoid infinite values
  const correctedHitRate = correctRate(hitRate)
  const correctedFARate = correctRate(falseAlarmRate)

  // Calculate Z-scores
  const zHit = inverseNormalCDF(correctedHitRate)
  const zFA = inverseNormalCDF(correctedFARate)

  return zHit - zFA
}

/**
 * Correct extreme rates (0 or 1) to avoid infinite Z-scores
 */
function correctRate(rate: number): number {
  if (rate === 0) return 0.01 // Replace 0 with 1%
  if (rate === 1) return 0.99 // Replace 1 with 99%
  return rate
}

/**
 * Approximate inverse normal CDF (Z-score)
 * Uses rational approximation for speed
 */
function inverseNormalCDF(p: number): number {
  // Ensure p is in valid range
  if (p <= 0) return -6
  if (p >= 1) return 6

  // Use rational approximation (Beasley-Springer-Moro algorithm)
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.383577518672690e2,
    -3.066479806614716e1,
    2.506628277459239,
  ]

  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ]

  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ]

  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  let q: number
  let r: number

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= pHigh) {
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
}

/**
 * Calculate median of an array
 */
function calculateMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  } else {
    return sorted[mid]
  }
}

/**
 * Convert attention responses to event samples for storage
 */
export function responsesToEvents(responses: AttentionResponse[]): EventSample[] {
  return responses.map((response) => ({
    t: response.stimulusTimestamp,
    type: response.responded ? 'response' : 'stimulus',
    value: {
      isTarget: response.isTarget,
      responded: response.responded,
      responseTimestamp: response.responseTimestamp,
      reactionTime: response.reactionTime,
    },
  }))
}

/**
 * Convert event samples back to attention responses
 */
export function eventsToResponses(events: EventSample[]): AttentionResponse[] {
  return events
    .filter((e) => e.type === 'response' || e.type === 'stimulus')
    .map((e) => ({
      stimulusTimestamp: e.t,
      responseTimestamp: (e.value.responseTimestamp as number) ?? null,
      isTarget: (e.value.isTarget as boolean) ?? false,
      responded: (e.value.responded as boolean) ?? false,
      reactionTime: (e.value.reactionTime as number) ?? null,
    }))
}
