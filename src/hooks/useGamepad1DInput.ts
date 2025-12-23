import { useHardware } from '@/context/HardwareContext'

export interface UseGamepad1DInputOptions {
  /**
   * Orientation of the 1D axis
   * - 'vertical': Maps to Y axis (Module A)
   * - 'horizontal': Maps to X axis (Modules E, F)
   */
  orientation: 'vertical' | 'horizontal'

  /**
   * Whether gamepad input is enabled
   * Set to false to disable gamepad and use keyboard/mouse
   */
  enabled: boolean
}

export interface UseGamepad1DInputResult {
  /**
   * Processed value in range [-1, 1]
   * Includes calibration, deadzone, sensitivity, and smoothing
   */
  value: number

  /**
   * Whether gamepad is actively providing input
   * True when gamepad is connected, enabled, and in gamepad mode
   */
  isActive: boolean

  /**
   * Raw unprocessed value from gamepad
   */
  rawValue: number
}

/**
 * Hook for consuming gamepad input for 1D tracking tasks
 *
 * @example
 * ```tsx
 * const { value, isActive } = useGamepad1DInput({
 *   orientation: 'vertical',
 *   enabled: inputMode === 'gamepad'
 * })
 *
 * if (isActive) {
 *   cursorPosition.current = value
 * } else {
 *   // Use mouse/keyboard input
 * }
 * ```
 */
export function useGamepad1DInput(
  options: UseGamepad1DInputOptions
): UseGamepad1DInputResult {
  const { enabled } = options
  // orientation is reserved for future use when different axes map to different orientations
  const {
    isGamepadConnected,
    inputMode,
    processedAxisValue,
    rawAxisValue,
    rudderAxisConfig,
  } = useHardware()

  // Determine if we should be active
  const isActive =
    enabled && isGamepadConnected && inputMode === 'gamepad' && rudderAxisConfig !== null

  // For horizontal orientation, we might need to swap the value
  // but since rudder pedals are typically mapped to a single axis,
  // we use the processed value directly regardless of orientation
  // The orientation is more for documentation/future use
  const value = isActive ? processedAxisValue : 0

  return {
    value,
    isActive,
    rawValue: isActive ? rawAxisValue : 0,
  }
}
