// Target generation algorithms for Module B (2D Pursuit Tracking)
// Based on TECHNICAL.md specifications

export interface TargetGenerator2DConfig {
  type: 'momentum' | 'curvilinear'
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number }
  difficulty: number // 0-1 scale
}

export interface TargetGenerator2D {
  update(dt: number): { x: number; y: number }
  reset(): void
  getPosition(): { x: number; y: number }
}

/**
 * Momentum-based random walk in 2D
 * Target has velocity that changes randomly, creating smooth curved motion
 */
export class MomentumGenerator implements TargetGenerator2D {
  private x: number
  private y: number
  private vx: number
  private vy: number
  private readonly bounds: { xMin: number; xMax: number; yMin: number; yMax: number }
  private readonly maxSpeed: number
  private readonly acceleration: number
  private readonly damping: number

  constructor(config: TargetGenerator2DConfig) {
    this.bounds = config.bounds

    // Start at center
    this.x = (config.bounds.xMin + config.bounds.xMax) / 2
    this.y = (config.bounds.yMin + config.bounds.yMax) / 2
    this.vx = 0
    this.vy = 0

    // Difficulty affects speed and acceleration
    this.maxSpeed = 0.3 + config.difficulty * 0.7 // 0.3 to 1.0 units/sec
    this.acceleration = 0.5 + config.difficulty * 1.5 // 0.5 to 2.0 units/sec²
    this.damping = 0.95 // Velocity damping factor
  }

  update(dt: number): { x: number; y: number } {
    // Random acceleration in both directions
    const ax = (Math.random() - 0.5) * 2 * this.acceleration
    const ay = (Math.random() - 0.5) * 2 * this.acceleration

    // Update velocity with damping
    this.vx = (this.vx + ax * dt) * this.damping
    this.vy = (this.vy + ay * dt) * this.damping

    // Limit speed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
    if (speed > this.maxSpeed) {
      this.vx = (this.vx / speed) * this.maxSpeed
      this.vy = (this.vy / speed) * this.maxSpeed
    }

    // Update position
    this.x += this.vx * dt
    this.y += this.vy * dt

    // Bounce off walls with velocity reversal
    if (this.x < this.bounds.xMin) {
      this.x = this.bounds.xMin
      this.vx = Math.abs(this.vx) * 0.8
    } else if (this.x > this.bounds.xMax) {
      this.x = this.bounds.xMax
      this.vx = -Math.abs(this.vx) * 0.8
    }

    if (this.y < this.bounds.yMin) {
      this.y = this.bounds.yMin
      this.vy = Math.abs(this.vy) * 0.8
    } else if (this.y > this.bounds.yMax) {
      this.y = this.bounds.yMax
      this.vy = -Math.abs(this.vy) * 0.8
    }

    return { x: this.x, y: this.y }
  }

  reset(): void {
    this.x = (this.bounds.xMin + this.bounds.xMax) / 2
    this.y = (this.bounds.yMin + this.bounds.yMax) / 2
    this.vx = 0
    this.vy = 0
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y }
  }
}

/**
 * Curvilinear path generator with bounded curvature
 * Creates smooth curved paths by controlling angular velocity
 */
export class CurvilinearGenerator implements TargetGenerator2D {
  private x: number
  private y: number
  private angle: number // Direction of motion (radians)
  private angularVelocity: number // Rate of direction change
  private readonly bounds: { xMin: number; xMax: number; yMin: number; yMax: number }
  private readonly speed: number
  private readonly maxCurvature: number
  private timeSinceDirectionChange: number
  private directionChangePeriod: number

  constructor(config: TargetGenerator2DConfig) {
    this.bounds = config.bounds

    // Start at center
    this.x = (config.bounds.xMin + config.bounds.xMax) / 2
    this.y = (config.bounds.yMin + config.bounds.yMax) / 2
    this.angle = Math.random() * Math.PI * 2
    this.angularVelocity = 0

    // Difficulty affects speed and curvature
    this.speed = 0.3 + config.difficulty * 0.5 // 0.3 to 0.8 units/sec
    this.maxCurvature = 1.0 + config.difficulty * 2.0 // 1.0 to 3.0 rad/sec
    this.timeSinceDirectionChange = 0
    this.directionChangePeriod = 0.5 / (1 + config.difficulty) // 0.5s to 0.25s
  }

  update(dt: number): { x: number; y: number } {
    this.timeSinceDirectionChange += dt

    // Periodically change angular velocity (curvature)
    if (this.timeSinceDirectionChange >= this.directionChangePeriod) {
      this.angularVelocity = (Math.random() - 0.5) * 2 * this.maxCurvature
      this.timeSinceDirectionChange = 0
    }

    // Update direction
    this.angle += this.angularVelocity * dt

    // Update position based on current direction
    const dx = Math.cos(this.angle) * this.speed * dt
    const dy = Math.sin(this.angle) * this.speed * dt
    this.x += dx
    this.y += dy

    // Handle boundary collisions by reflecting angle
    let bounced = false
    if (this.x < this.bounds.xMin) {
      this.x = this.bounds.xMin
      this.angle = Math.PI - this.angle // Reflect horizontally
      bounced = true
    } else if (this.x > this.bounds.xMax) {
      this.x = this.bounds.xMax
      this.angle = Math.PI - this.angle
      bounced = true
    }

    if (this.y < this.bounds.yMin) {
      this.y = this.bounds.yMin
      this.angle = -this.angle // Reflect vertically
      bounced = true
    } else if (this.y > this.bounds.yMax) {
      this.y = this.bounds.yMax
      this.angle = -this.angle
      bounced = true
    }

    // If bounced, randomize angular velocity slightly
    if (bounced) {
      this.angularVelocity *= -0.7
    }

    return { x: this.x, y: this.y }
  }

  reset(): void {
    this.x = (this.bounds.xMin + this.bounds.xMax) / 2
    this.y = (this.bounds.yMin + this.bounds.yMax) / 2
    this.angle = Math.random() * Math.PI * 2
    this.angularVelocity = 0
    this.timeSinceDirectionChange = 0
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y }
  }
}

/**
 * Factory function to create 2D target generators
 */
export function createTargetGenerator2D(
  config: TargetGenerator2DConfig
): TargetGenerator2D {
  switch (config.type) {
    case 'momentum':
      return new MomentumGenerator(config)
    case 'curvilinear':
      return new CurvilinearGenerator(config)
    default:
      throw new Error(`Unknown 2D target generator type: ${config.type}`)
  }
}
