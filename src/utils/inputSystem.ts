// Input handling system for all modules
// Supports keyboard, mouse, and gamepad (architecture ready)

export interface InputState {
  x: number // -1 to 1
  y: number // -1 to 1
  buttons: Map<string, boolean>
}

export type InputCallback = (state: InputState) => void

export class InputSystem {
  private state: InputState
  private callbacks: Set<InputCallback>
  private keysPressed: Set<string>
  private mouseX: number
  private mouseY: number
  private canvasBounds: DOMRect | null
  private animationFrameId: number | null
  private canvas: HTMLCanvasElement | null
  private usePointerLock: boolean
  private mouseSensitivity: number

  // Keyboard configuration for 2D control
  // Support both arrow keys and WASD
  private readonly upKeys = ['ArrowUp', 'w', 'W']
  private readonly downKeys = ['ArrowDown', 's', 'S']
  private readonly leftKeys = ['ArrowLeft', 'a', 'A']
  private readonly rightKeys = ['ArrowRight', 'd', 'D']
  private readonly keyboardSpeed = 2.0 // Units per second

  constructor() {
    this.state = {
      x: 0,
      y: 0,
      buttons: new Map(),
    }
    this.callbacks = new Set()
    this.keysPressed = new Set()
    this.mouseX = 0
    this.mouseY = 0
    this.canvasBounds = null
    this.animationFrameId = null
    this.canvas = null
    this.usePointerLock = false
    this.mouseSensitivity = 0.003 // Adjust for relative mouse movement
  }

  /**
   * Initialize input listeners for a canvas element
   * @param canvas - The canvas element to attach listeners to
   * @param usePointerLock - Whether to use pointer lock for relative mouse movement (for 2D modules)
   */
  init(canvas: HTMLCanvasElement, usePointerLock: boolean = false): void {
    this.canvas = canvas
    this.usePointerLock = usePointerLock
    this.canvasBounds = canvas.getBoundingClientRect()

    // Keyboard listeners
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)

    // Mouse listeners
    canvas.addEventListener('mousemove', this.handleMouseMove)
    canvas.addEventListener('mousedown', this.handleMouseDown)
    canvas.addEventListener('mouseup', this.handleMouseUp)

    // Pointer lock listeners (for 2D modules)
    if (usePointerLock) {
      canvas.addEventListener('click', this.requestPointerLock)
      document.addEventListener('pointerlockchange', this.handlePointerLockChange)
    }

    // Start update loop
    this.startUpdateLoop()
  }

  /**
   * Clean up all listeners
   */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)

    if (this.canvas) {
      this.canvas.removeEventListener('click', this.requestPointerLock)
    }
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange)

    // Exit pointer lock if active
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock()
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.callbacks.clear()
  }

  /**
   * Subscribe to input updates
   */
  subscribe(callback: InputCallback): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  /**
   * Get current input state
   */
  getState(): InputState {
    return { ...this.state }
  }

  /**
   * Update canvas bounds (call when canvas resizes)
   */
  updateCanvasBounds(bounds: DOMRect): void {
    this.canvasBounds = bounds
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keysPressed.add(e.key)
  }

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysPressed.delete(e.key)
  }

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.usePointerLock && document.pointerLockElement === this.canvas) {
      // Pointer lock mode: use relative movement
      const dx = e.movementX * this.mouseSensitivity
      const dy = e.movementY * this.mouseSensitivity

      this.state.x += dx
      this.state.y += dy

      // Clamp to bounds
      this.state.x = Math.max(-1, Math.min(1, this.state.x))
      this.state.y = Math.max(-1, Math.min(1, this.state.y))
    } else {
      // Absolute positioning mode
      if (!this.canvasBounds) return

      this.mouseX = e.clientX - this.canvasBounds.left
      this.mouseY = e.clientY - this.canvasBounds.top

      // Convert to normalized coordinates (-1 to 1)
      this.state.x = (this.mouseX / this.canvasBounds.width) * 2 - 1
      this.state.y = (this.mouseY / this.canvasBounds.height) * 2 - 1

      // Clamp to bounds
      this.state.x = Math.max(-1, Math.min(1, this.state.x))
      this.state.y = Math.max(-1, Math.min(1, this.state.y))
    }
  }

  private requestPointerLock = (): void => {
    if (this.canvas) {
      this.canvas.requestPointerLock()
    }
  }

  private handlePointerLockChange = (): void => {
    if (document.pointerLockElement === this.canvas) {
      // Pointer lock activated
      console.log('Pointer lock activated')
    } else {
      // Pointer lock released (e.g., user pressed ESC)
      console.log('Pointer lock released')
    }
  }

  private handleMouseDown = (e: MouseEvent): void => {
    this.state.buttons.set(`mouse${e.button}`, true)
  }

  private handleMouseUp = (e: MouseEvent): void => {
    this.state.buttons.set(`mouse${e.button}`, false)
  }

  private lastUpdateTime = performance.now()

  private updateLoop = (): void => {
    const now = performance.now()
    const dt = (now - this.lastUpdateTime) / 1000 // Convert to seconds
    this.lastUpdateTime = now

    // Handle keyboard input for position (accumulative, 2D)
    // Vertical movement
    if (this.upKeys.some((key) => this.keysPressed.has(key))) {
      this.state.y -= this.keyboardSpeed * dt
    }
    if (this.downKeys.some((key) => this.keysPressed.has(key))) {
      this.state.y += this.keyboardSpeed * dt
    }

    // Horizontal movement
    if (this.leftKeys.some((key) => this.keysPressed.has(key))) {
      this.state.x -= this.keyboardSpeed * dt
    }
    if (this.rightKeys.some((key) => this.keysPressed.has(key))) {
      this.state.x += this.keyboardSpeed * dt
    }

    // Clamp keyboard input
    this.state.x = Math.max(-1, Math.min(1, this.state.x))
    this.state.y = Math.max(-1, Math.min(1, this.state.y))

    // TODO: Add gamepad polling here
    // const gamepads = navigator.getGamepads()
    // Process gamepad axes and buttons

    // Notify all callbacks
    this.callbacks.forEach((cb) => cb(this.state))

    this.animationFrameId = requestAnimationFrame(this.updateLoop)
  }

  private startUpdateLoop(): void {
    this.lastUpdateTime = performance.now()
    this.animationFrameId = requestAnimationFrame(this.updateLoop)
  }

  /**
   * Reset input state to neutral
   */
  reset(): void {
    this.state.x = 0
    this.state.y = 0
    this.state.buttons.clear()
    this.keysPressed.clear()
  }
}

/**
 * Apply deadzone, sensitivity, and other transformations to raw input
 */
export function processAxisInput(
  rawValue: number,
  deadzone: number,
  sensitivity: number,
  inverted: boolean
): number {
  let value = rawValue

  // Apply deadzone
  if (Math.abs(value) < deadzone) {
    return 0
  }

  // Remove deadzone and rescale
  const sign = Math.sign(value)
  value = sign * ((Math.abs(value) - deadzone) / (1 - deadzone))

  // Apply sensitivity curve (power curve)
  value = sign * Math.pow(Math.abs(value), 1 / sensitivity)

  // Apply inversion
  if (inverted) {
    value = -value
  }

  return value
}

/**
 * Apply min/max calibration to raw gamepad axis value
 * Maps physical range to normalized [-1, 1]
 */
export function applyCalibration(
  rawValue: number,
  calibrationMin: number,
  calibrationMax: number
): number {
  const range = calibrationMax - calibrationMin
  if (range === 0) return 0

  // Map to 0-1, then to -1 to 1
  const normalized = (rawValue - calibrationMin) / range
  return Math.max(-1, Math.min(1, normalized * 2 - 1))
}

/**
 * Sensitivity curve types for gamepad input
 */
export type SensitivityCurve = 'linear' | 'quadratic' | 'cubic'

/**
 * Apply sensitivity curve to input value
 * Input and output are in range [-1, 1]
 */
export function applySensitivityCurve(
  value: number,
  curve: SensitivityCurve
): number {
  const sign = Math.sign(value)
  const abs = Math.abs(value)

  switch (curve) {
    case 'linear':
      return value
    case 'quadratic':
      return sign * Math.pow(abs, 2)
    case 'cubic':
      return sign * Math.pow(abs, 3)
    default:
      return value
  }
}

/**
 * Low-pass filter for smoothing input
 */
export class InputFilter {
  private filteredValue: number
  private readonly alpha: number

  constructor(alpha: number = 0.3) {
    this.filteredValue = 0
    this.alpha = alpha
  }

  update(rawValue: number): number {
    this.filteredValue = this.alpha * rawValue + (1 - this.alpha) * this.filteredValue
    return this.filteredValue
  }

  reset(): void {
    this.filteredValue = 0
  }
}
