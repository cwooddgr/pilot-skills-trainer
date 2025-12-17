// Target generation algorithms for Module A (1D Pursuit Tracking)
// Based on TECHNICAL.md specifications

export interface TargetGeneratorConfig {
  type: 'ornstein-uhlenbeck' | 'sinusoid' | 'piecewise'
  bounds: [number, number] // Min and max position
  difficulty: number // 0-1 scale
}

export interface TargetGenerator {
  update(dt: number): number
  reset(): void
  getPosition(): number
}

/**
 * Ornstein-Uhlenbeck process for smooth, mean-reverting random motion
 * dx = θ*(μ - x)*dt + σ*sqrt(dt)*noise()
 */
export class OrnsteinUhlenbeckGenerator implements TargetGenerator {
  private x: number
  private readonly mu: number // Mean
  private readonly theta: number // Mean reversion rate
  private readonly sigma: number // Volatility
  private readonly bounds: [number, number]

  constructor(config: TargetGeneratorConfig) {
    this.bounds = config.bounds
    this.mu = (config.bounds[0] + config.bounds[1]) / 2

    // Difficulty affects volatility and mean reversion
    // Higher difficulty = more volatile, faster changes
    this.theta = 0.5 + config.difficulty * 1.5 // 0.5 to 2.0
    this.sigma = 0.3 + config.difficulty * 0.7 // 0.3 to 1.0

    this.x = this.mu
  }

  update(dt: number): number {
    // Ornstein-Uhlenbeck equation
    const noise = (Math.random() - 0.5) * 2 // -1 to 1
    const dx = this.theta * (this.mu - this.x) * dt + this.sigma * Math.sqrt(dt) * noise

    this.x += dx

    // Apply bounds with soft clamping
    if (this.x < this.bounds[0]) {
      this.x = this.bounds[0]
    } else if (this.x > this.bounds[1]) {
      this.x = this.bounds[1]
    }

    return this.x
  }

  reset(): void {
    this.x = this.mu
  }

  getPosition(): number {
    return this.x
  }
}

/**
 * Sum of sinusoids with slowly varying frequency
 */
export class SinusoidGenerator implements TargetGenerator {
  private t: number
  private readonly bounds: [number, number]
  private readonly amplitude: number
  private readonly center: number
  private readonly frequencies: number[]
  private readonly phases: number[]

  constructor(config: TargetGeneratorConfig) {
    this.bounds = config.bounds
    this.t = 0

    const range = config.bounds[1] - config.bounds[0]
    this.amplitude = range * 0.4
    this.center = (config.bounds[0] + config.bounds[1]) / 2

    // Multiple frequencies based on difficulty
    const baseFreq = 0.3 + config.difficulty * 0.7 // 0.3 to 1.0 Hz
    this.frequencies = [
      baseFreq,
      baseFreq * 1.618, // Golden ratio
      baseFreq * 0.5,
    ]

    this.phases = this.frequencies.map(() => Math.random() * Math.PI * 2)
  }

  update(dt: number): number {
    this.t += dt

    let sum = 0
    for (let i = 0; i < this.frequencies.length; i++) {
      const weight = 1 / (i + 1) // Decreasing weights
      sum += weight * Math.sin(2 * Math.PI * this.frequencies[i] * this.t + this.phases[i])
    }

    const normalizedSum = sum / this.frequencies.reduce((acc, _, i) => acc + 1 / (i + 1), 0)
    const position = this.center + this.amplitude * normalizedSum

    return Math.max(this.bounds[0], Math.min(this.bounds[1], position))
  }

  reset(): void {
    this.t = 0
    for (let i = 0; i < this.phases.length; i++) {
      this.phases[i] = Math.random() * Math.PI * 2
    }
  }

  getPosition(): number {
    // Calculate current position without updating time
    let sum = 0
    for (let i = 0; i < this.frequencies.length; i++) {
      const weight = 1 / (i + 1)
      sum += weight * Math.sin(2 * Math.PI * this.frequencies[i] * this.t + this.phases[i])
    }

    const normalizedSum = sum / this.frequencies.reduce((acc, _, i) => acc + 1 / (i + 1), 0)
    return this.center + this.amplitude * normalizedSum
  }
}

/**
 * Piecewise-constant acceleration with bounded jerk
 */
export class PiecewiseGenerator implements TargetGenerator {
  private x: number
  private v: number
  private a: number
  private readonly bounds: [number, number]
  private readonly maxAccel: number
  private readonly maxJerk: number
  private timeSinceAccelChange: number
  private accelChangePeriod: number

  constructor(config: TargetGeneratorConfig) {
    this.bounds = config.bounds
    this.x = (config.bounds[0] + config.bounds[1]) / 2
    this.v = 0
    this.a = 0
    this.timeSinceAccelChange = 0

    // Difficulty affects acceleration magnitude and change frequency
    this.maxAccel = 0.5 + config.difficulty * 1.5 // 0.5 to 2.0
    this.maxJerk = 2.0 + config.difficulty * 4.0 // 2.0 to 6.0
    this.accelChangePeriod = 0.5 / (1 + config.difficulty) // 0.5s to 0.25s
  }

  update(dt: number): number {
    this.timeSinceAccelChange += dt

    // Periodically change acceleration
    if (this.timeSinceAccelChange >= this.accelChangePeriod) {
      const targetAccel = (Math.random() - 0.5) * 2 * this.maxAccel
      const jerk = Math.sign(targetAccel - this.a) * this.maxJerk
      this.a += jerk * dt
      this.a = Math.max(-this.maxAccel, Math.min(this.maxAccel, this.a))
      this.timeSinceAccelChange = 0
    }

    // Update velocity and position
    this.v += this.a * dt
    this.x += this.v * dt

    // Bounce off walls
    if (this.x < this.bounds[0]) {
      this.x = this.bounds[0]
      this.v = Math.abs(this.v) * 0.8
    } else if (this.x > this.bounds[1]) {
      this.x = this.bounds[1]
      this.v = -Math.abs(this.v) * 0.8
    }

    return this.x
  }

  reset(): void {
    this.x = (this.bounds[0] + this.bounds[1]) / 2
    this.v = 0
    this.a = 0
    this.timeSinceAccelChange = 0
  }

  getPosition(): number {
    return this.x
  }
}

/**
 * Factory function to create target generators
 */
export function createTargetGenerator(config: TargetGeneratorConfig): TargetGenerator {
  switch (config.type) {
    case 'ornstein-uhlenbeck':
      return new OrnsteinUhlenbeckGenerator(config)
    case 'sinusoid':
      return new SinusoidGenerator(config)
    case 'piecewise':
      return new PiecewiseGenerator(config)
    default:
      throw new Error(`Unknown target generator type: ${config.type}`)
  }
}
