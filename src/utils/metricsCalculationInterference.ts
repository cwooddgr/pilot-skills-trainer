import type { TrackingSample, TrackingSample2D, AttentionResponse } from '@/types'

export interface InterferenceMetrics {
  errorSpikesAroundResponses: number[] // RMSE in ±500ms per response
  meanErrorSpikeResponse: number
  errorSpikesAroundStimuli: number[] // RMSE in ±500ms per stimulus
  meanErrorSpikeStimulus: number
}

/**
 * Calculate interference metrics: tracking error spikes around auditory events
 *
 * Measures how much tracking performance degrades in ±500ms window around
 * auditory stimuli and responses. This quantifies the cognitive interference
 * between motor and auditory tasks.
 */
export function calculateInterferenceMetrics(
  samples1D: TrackingSample[],
  samples2D: TrackingSample2D[],
  auditoryResponses: AttentionResponse[]
): InterferenceMetrics {
  const windowMs = 500 // ±500ms window

  // Error spikes around responses (when user pressed spacebar)
  const errorSpikesAroundResponses: number[] = []

  auditoryResponses.forEach((response) => {
    if (!response.responded || !response.responseTimestamp) return

    const responseTime = response.responseTimestamp

    // Get 1D samples in ±500ms window
    const samples1DWindow = samples1D.filter(
      (s) =>
        s.timestamp >= responseTime - windowMs && s.timestamp <= responseTime + windowMs
    )

    // Get 2D samples in ±500ms window
    const samples2DWindow = samples2D.filter(
      (s) =>
        s.timestamp >= responseTime - windowMs && s.timestamp <= responseTime + windowMs
    )

    if (samples1DWindow.length === 0 && samples2DWindow.length === 0) return

    // Calculate RMSE in window for 1D task
    const errors1D = samples1DWindow.map((s) => s.targetPosition - s.cursorPosition)
    const rmse1D =
      errors1D.length > 0
        ? Math.sqrt(errors1D.reduce((sum, e) => sum + e * e, 0) / errors1D.length)
        : 0

    // Calculate RMSE in window for 2D task
    const errors2D = samples2DWindow.map((s) => {
      const dx = s.targetPosition.x - s.cursorPosition.x
      const dy = s.targetPosition.y - s.cursorPosition.y
      return Math.sqrt(dx * dx + dy * dy)
    })
    const rmse2D =
      errors2D.length > 0
        ? Math.sqrt(errors2D.reduce((sum, e) => sum + e * e, 0) / errors2D.length)
        : 0

    // Combined RMSE (average of both tasks)
    const combinedRMSE = (rmse1D + rmse2D) / 2
    errorSpikesAroundResponses.push(combinedRMSE)
  })

  // Error spikes around all stimuli (including non-responses)
  const errorSpikesAroundStimuli: number[] = []

  auditoryResponses.forEach((response) => {
    const stimTime = response.stimulusTimestamp

    // Get 1D samples in ±500ms window
    const samples1DWindow = samples1D.filter(
      (s) => s.timestamp >= stimTime - windowMs && s.timestamp <= stimTime + windowMs
    )

    // Get 2D samples in ±500ms window
    const samples2DWindow = samples2D.filter(
      (s) => s.timestamp >= stimTime - windowMs && s.timestamp <= stimTime + windowMs
    )

    if (samples1DWindow.length === 0 && samples2DWindow.length === 0) return

    // Calculate RMSE in window for 1D task
    const errors1D = samples1DWindow.map((s) => s.targetPosition - s.cursorPosition)
    const rmse1D =
      errors1D.length > 0
        ? Math.sqrt(errors1D.reduce((sum, e) => sum + e * e, 0) / errors1D.length)
        : 0

    // Calculate RMSE in window for 2D task
    const errors2D = samples2DWindow.map((s) => {
      const dx = s.targetPosition.x - s.cursorPosition.x
      const dy = s.targetPosition.y - s.cursorPosition.y
      return Math.sqrt(dx * dx + dy * dy)
    })
    const rmse2D =
      errors2D.length > 0
        ? Math.sqrt(errors2D.reduce((sum, e) => sum + e * e, 0) / errors2D.length)
        : 0

    // Combined RMSE (average of both tasks)
    const combinedRMSE = (rmse1D + rmse2D) / 2
    errorSpikesAroundStimuli.push(combinedRMSE)
  })

  return {
    errorSpikesAroundResponses,
    meanErrorSpikeResponse:
      errorSpikesAroundResponses.length > 0
        ? errorSpikesAroundResponses.reduce((a, b) => a + b, 0) /
          errorSpikesAroundResponses.length
        : 0,
    errorSpikesAroundStimuli,
    meanErrorSpikeStimulus:
      errorSpikesAroundStimuli.length > 0
        ? errorSpikesAroundStimuli.reduce((a, b) => a + b, 0) / errorSpikesAroundStimuli.length
        : 0,
  }
}
