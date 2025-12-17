// Audio stimulus generation for Module C (Auditory Selective Attention)
// Uses Web Audio API

export type StimulusType = 'high' | 'low' | 'medium'

export interface AudioStimulusConfig {
  targetTypes: StimulusType[] // Which stimulus types are targets
  difficulty: number // 0-1 scale, affects timing
}

export interface StimulusEvent {
  timestamp: number
  type: StimulusType
  isTarget: boolean
}

/**
 * Audio stimulus generator using Web Audio API
 */
export class AudioStimulus {
  private audioContext: AudioContext
  private readonly frequencies: Record<StimulusType, number>
  private readonly toneDuration: number = 0.15 // 150ms tone duration

  constructor() {
    this.audioContext = new AudioContext()

    // Frequency mapping for different stimulus types
    this.frequencies = {
      low: 440, // A4
      medium: 587, // D5
      high: 880, // A5
    }
  }

  /**
   * Play a tone at the specified frequency
   */
  async playTone(type: StimulusType, scheduledTime?: number): Promise<void> {
    const frequency = this.frequencies[type]
    const startTime = scheduledTime ?? this.audioContext.currentTime

    // Create oscillator for tone
    const oscillator = this.audioContext.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency

    // Create gain node for envelope (attack/decay)
    const gainNode = this.audioContext.createGain()
    gainNode.gain.value = 0

    // Connect nodes
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Envelope: quick attack, sustain, quick release
    const attackTime = 0.01
    const releaseTime = 0.05
    const sustainLevel = 0.3

    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(sustainLevel, startTime + attackTime)
    gainNode.gain.setValueAtTime(
      sustainLevel,
      startTime + this.toneDuration - releaseTime
    )
    gainNode.gain.linearRampToValueAtTime(0, startTime + this.toneDuration)

    // Start and stop
    oscillator.start(startTime)
    oscillator.stop(startTime + this.toneDuration)

    return new Promise((resolve) => {
      oscillator.onended = () => resolve()
    })
  }

  /**
   * Get current audio context time (for scheduling)
   */
  getCurrentTime(): number {
    return this.audioContext.currentTime
  }

  /**
   * Resume audio context (required after user interaction in some browsers)
   */
  async resume(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  /**
   * Close audio context
   */
  destroy(): void {
    this.audioContext.close()
  }
}

/**
 * Generate a stimulus sequence with jittered ISI
 */
export function generateStimulusSequence(
  config: AudioStimulusConfig,
  durationMs: number
): StimulusEvent[] {
  const sequence: StimulusEvent[] = []
  const allTypes: StimulusType[] = ['high', 'low', 'medium']

  // Base ISI (inter-stimulus interval) affected by difficulty
  // Higher difficulty = faster presentation
  const baseISI = 1500 - config.difficulty * 800 // 1500ms to 700ms
  const jitterRange = 300 // ±150ms jitter

  // Target probability (30-40% of stimuli should be targets)
  const targetProbability = 0.35

  let currentTime = 500 // Start 500ms into the trial

  while (currentTime < durationMs) {
    // Decide if this is a target trial
    const isTarget = Math.random() < targetProbability

    // Select stimulus type
    let type: StimulusType
    if (isTarget) {
      // Choose from target types
      type = config.targetTypes[Math.floor(Math.random() * config.targetTypes.length)]
    } else {
      // Choose from non-target types
      const nonTargets = allTypes.filter((t) => !config.targetTypes.includes(t))
      type = nonTargets[Math.floor(Math.random() * nonTargets.length)]
    }

    sequence.push({
      timestamp: currentTime,
      type,
      isTarget,
    })

    // Add jittered ISI
    const jitter = (Math.random() - 0.5) * jitterRange
    currentTime += baseISI + jitter
  }

  return sequence
}

/**
 * Calculate response window bounds
 */
export function getResponseWindow(difficulty: number): { min: number; max: number } {
  // Response window: user must respond within this time after stimulus
  // Higher difficulty = shorter window
  const maxResponseTime = 1200 - difficulty * 400 // 1200ms to 800ms
  return {
    min: 100, // Minimum 100ms to avoid anticipation
    max: maxResponseTime,
  }
}
