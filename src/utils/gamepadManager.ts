// Centralized gamepad detection and polling
// Handles browser Gamepad API for rudder pedals and other HID devices

export type GamepadConnectionCallback = (gamepad: Gamepad | null, connected: boolean) => void

class GamepadManager {
  private static instance: GamepadManager
  private connectedGamepads: Map<string, Gamepad> = new Map()
  private connectionListeners: Set<GamepadConnectionCallback> = new Set()
  private initialized = false

  private constructor() {}

  static getInstance(): GamepadManager {
    if (!GamepadManager.instance) {
      GamepadManager.instance = new GamepadManager()
    }
    return GamepadManager.instance
  }

  /**
   * Initialize gamepad event listeners
   * Call once at app startup
   */
  init(): void {
    if (this.initialized) return
    this.initialized = true

    window.addEventListener('gamepadconnected', this.handleGamepadConnected)
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected)

    // Check for already-connected gamepads (some browsers require polling first)
    this.poll()
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected)
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected)
    this.connectionListeners.clear()
    this.connectedGamepads.clear()
    this.initialized = false
  }

  /**
   * Subscribe to gamepad connection/disconnection events
   */
  onConnectionChange(callback: GamepadConnectionCallback): () => void {
    this.connectionListeners.add(callback)
    return () => this.connectionListeners.delete(callback)
  }

  /**
   * Poll for gamepad state updates
   * Must be called in animation frame loop to get fresh axis values
   * Also detects newly connected gamepads that weren't caught by events
   */
  poll(): Map<string, Gamepad> {
    const gamepads = navigator.getGamepads()
    for (const gamepad of gamepads) {
      if (gamepad) {
        const wasConnected = this.connectedGamepads.has(gamepad.id)
        this.connectedGamepads.set(gamepad.id, gamepad)

        // If this is a new gamepad, notify listeners
        if (!wasConnected) {
          this.notifyListeners(gamepad, true)
        }
      }
    }
    return this.connectedGamepads
  }

  /**
   * Get all connected gamepads
   */
  getConnectedGamepads(): Map<string, Gamepad> {
    return this.connectedGamepads
  }

  /**
   * Get a specific gamepad by ID
   */
  getGamepad(gamepadId: string): Gamepad | null {
    // Re-poll to get fresh state
    const gamepads = navigator.getGamepads()
    for (const gamepad of gamepads) {
      if (gamepad?.id === gamepadId) {
        return gamepad
      }
    }
    return null
  }

  /**
   * Get axis value for a specific gamepad and axis index
   * Returns 0 if gamepad or axis not found
   */
  getAxisValue(gamepadId: string, axisIndex: number): number {
    const gamepad = this.getGamepad(gamepadId)
    if (!gamepad || axisIndex >= gamepad.axes.length) {
      return 0
    }
    return gamepad.axes[axisIndex]
  }

  /**
   * Get all axis values for a gamepad
   */
  getAllAxes(gamepadId: string): number[] {
    const gamepad = this.getGamepad(gamepadId)
    if (!gamepad) {
      return []
    }
    return Array.from(gamepad.axes)
  }

  /**
   * Check if any gamepad is connected
   */
  hasConnectedGamepad(): boolean {
    this.poll()
    return this.connectedGamepads.size > 0
  }

  /**
   * Get the first connected gamepad (convenience method)
   */
  getFirstGamepad(): Gamepad | null {
    this.poll()
    const first = this.connectedGamepads.values().next()
    return first.done ? null : first.value
  }

  private handleGamepadConnected = (e: GamepadEvent): void => {
    const gamepad = e.gamepad
    this.connectedGamepads.set(gamepad.id, gamepad)
    this.notifyListeners(gamepad, true)
  }

  private handleGamepadDisconnected = (e: GamepadEvent): void => {
    const gamepad = e.gamepad
    this.connectedGamepads.delete(gamepad.id)
    this.notifyListeners(gamepad, false)
  }

  private notifyListeners(gamepad: Gamepad, connected: boolean): void {
    this.connectionListeners.forEach((callback) => {
      callback(gamepad, connected)
    })
  }
}

// Export singleton instance
export const gamepadManager = GamepadManager.getInstance()
