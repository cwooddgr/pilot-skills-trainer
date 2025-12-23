import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { gamepadManager } from '@/utils/gamepadManager'
import {
  processAxisInput,
  applyCalibration,
  applySensitivityCurve,
  InputFilter,
} from '@/utils/inputSystem'
import type { HardwareProfile, AxisConfig } from '@/types'
import {
  getHardwareProfile,
  createHardwareProfile,
  updateHardwareProfile,
} from '@/lib/db'

// Default hardware profile ID (single-user for now)
const DEFAULT_PROFILE_ID = 'default'

// Threshold for detecting gamepad activity (switch to gamepad mode)
const GAMEPAD_ACTIVITY_THRESHOLD = 0.1

export type InputMode = 'keyboard-mouse' | 'gamepad'

export interface HardwareContextValue {
  // Connection state
  isGamepadConnected: boolean
  connectedGamepad: Gamepad | null
  connectedGamepadId: string | null

  // Configuration
  hardwareProfile: HardwareProfile | null
  rudderAxisConfig: AxisConfig | null

  // Input mode (exclusive: gamepad OR keyboard-mouse)
  inputMode: InputMode

  // Live values (for calibration UI and modules)
  rawAxisValue: number
  processedAxisValue: number

  // Axis values array (for calibration UI)
  allAxesValues: number[]

  // Profile management
  saveHardwareProfile: (profile: HardwareProfile) => Promise<void>
  updateAxisConfig: (axisConfig: AxisConfig) => Promise<void>
  setSelectedAxisIndex: (index: number) => void

  // Calibration state
  isCalibrating: boolean
  setIsCalibrating: (value: boolean) => void
}

const HardwareContext = createContext<HardwareContextValue | null>(null)

export function useHardware(): HardwareContextValue {
  const context = useContext(HardwareContext)
  if (!context) {
    throw new Error('useHardware must be used within a HardwareProvider')
  }
  return context
}

interface HardwareProviderProps {
  children: ReactNode
}

export function HardwareProvider({ children }: HardwareProviderProps) {
  // Gamepad connection state
  const [isGamepadConnected, setIsGamepadConnected] = useState(false)
  const [connectedGamepad, setConnectedGamepad] = useState<Gamepad | null>(null)
  const [connectedGamepadId, setConnectedGamepadId] = useState<string | null>(null)

  // Hardware profile from IndexedDB
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile | null>(null)

  // Input mode
  const [inputMode, setInputMode] = useState<InputMode>('keyboard-mouse')

  // Live axis values
  const [rawAxisValue, setRawAxisValue] = useState(0)
  const [processedAxisValue, setProcessedAxisValue] = useState(0)
  const [allAxesValues, setAllAxesValues] = useState<number[]>([])

  // Calibration state
  const [isCalibrating, setIsCalibrating] = useState(false)

  // Input filter for smoothing
  const inputFilterRef = useRef(new InputFilter(0.3))

  // Get the configured rudder axis config
  const rudderAxisConfig = hardwareProfile?.devices?.[0]?.axes?.find(
    (a) => a.mapping === 'yaw' || a.mapping === 'x' || a.mapping === 'y'
  ) ?? null

  // Load hardware profile on mount
  useEffect(() => {
    async function loadProfile() {
      const profile = await getHardwareProfile(DEFAULT_PROFILE_ID)
      if (profile) {
        setHardwareProfile(profile)
      }
    }
    loadProfile()
  }, [])

  // Initialize gamepad manager
  useEffect(() => {
    gamepadManager.init()

    const unsubscribe = gamepadManager.onConnectionChange((gamepad, connected) => {
      if (connected && gamepad) {
        setIsGamepadConnected(true)
        setConnectedGamepad(gamepad)
        setConnectedGamepadId(gamepad.id)
      } else {
        // Check if any gamepads still connected
        const remaining = gamepadManager.getConnectedGamepads()
        if (remaining.size === 0) {
          setIsGamepadConnected(false)
          setConnectedGamepad(null)
          setConnectedGamepadId(null)
          setInputMode('keyboard-mouse')
        }
      }
    })

    // Check for already-connected gamepads
    const existing = gamepadManager.getFirstGamepad()
    if (existing) {
      setIsGamepadConnected(true)
      setConnectedGamepad(existing)
      setConnectedGamepadId(existing.id)
    }

    return () => {
      unsubscribe()
    }
  }, [])

  // Poll gamepad at 60Hz when connected
  useEffect(() => {
    if (!isGamepadConnected || !connectedGamepadId) return

    let frameId: number
    let lastActivityTime = 0

    const poll = () => {
      const gamepad = gamepadManager.getGamepad(connectedGamepadId)
      if (!gamepad) {
        frameId = requestAnimationFrame(poll)
        return
      }

      // Update all axes values for UI
      setAllAxesValues(Array.from(gamepad.axes))

      // Get configured axis or default to first axis
      const axisIndex = rudderAxisConfig?.index ?? 0
      const rawValue = gamepad.axes[axisIndex] ?? 0

      setRawAxisValue(rawValue)

      // Process the value if we have config
      let processed = rawValue
      if (rudderAxisConfig) {
        // Apply calibration if configured
        if (
          rudderAxisConfig.calibrationMin !== undefined &&
          rudderAxisConfig.calibrationMax !== undefined
        ) {
          processed = applyCalibration(
            processed,
            rudderAxisConfig.calibrationMin,
            rudderAxisConfig.calibrationMax
          )
        }

        // Apply deadzone, sensitivity, and inversion
        processed = processAxisInput(
          processed,
          rudderAxisConfig.deadzone,
          rudderAxisConfig.sensitivity,
          rudderAxisConfig.inverted
        )

        // Apply sensitivity curve
        if (rudderAxisConfig.sensitivityCurve) {
          processed = applySensitivityCurve(processed, rudderAxisConfig.sensitivityCurve)
        }
      }

      // Apply smoothing
      const smoothed = inputFilterRef.current.update(processed)
      setProcessedAxisValue(smoothed)

      // Detect gamepad activity to switch input mode
      if (Math.abs(rawValue) > GAMEPAD_ACTIVITY_THRESHOLD) {
        lastActivityTime = performance.now()
        if (inputMode !== 'gamepad') {
          setInputMode('gamepad')
        }
      } else if (inputMode === 'gamepad') {
        // Switch back to keyboard-mouse after 2 seconds of inactivity
        if (performance.now() - lastActivityTime > 2000) {
          // Keep in gamepad mode if we're calibrating
          if (!isCalibrating) {
            // Actually, let's stay in gamepad mode while connected
            // Only switch back when user uses keyboard/mouse
          }
        }
      }

      frameId = requestAnimationFrame(poll)
    }

    frameId = requestAnimationFrame(poll)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [isGamepadConnected, connectedGamepadId, rudderAxisConfig, inputMode, isCalibrating])

  // Save hardware profile
  const saveHardwareProfile = useCallback(async (profile: HardwareProfile) => {
    const existing = await getHardwareProfile(profile.id)
    if (existing) {
      await updateHardwareProfile(profile)
    } else {
      await createHardwareProfile(profile)
    }
    setHardwareProfile(profile)
  }, [])

  // Update axis config (convenience method)
  const updateAxisConfig = useCallback(
    async (axisConfig: AxisConfig) => {
      if (!connectedGamepadId) return

      const existingProfile = hardwareProfile ?? {
        id: DEFAULT_PROFILE_ID,
        devices: [],
        lastCalibrated: Date.now(),
      }

      // Find or create device config
      let deviceConfig = existingProfile.devices.find(
        (d) => d.deviceId === connectedGamepadId
      )

      if (!deviceConfig) {
        deviceConfig = {
          deviceId: connectedGamepadId,
          deviceName: connectedGamepad?.id ?? 'Unknown Device',
          axes: [],
          buttons: [],
        }
        existingProfile.devices.push(deviceConfig)
      }

      // Find or add axis config
      const existingAxisIndex = deviceConfig.axes.findIndex(
        (a) => a.index === axisConfig.index
      )
      if (existingAxisIndex >= 0) {
        deviceConfig.axes[existingAxisIndex] = axisConfig
      } else {
        deviceConfig.axes.push(axisConfig)
      }

      existingProfile.lastCalibrated = Date.now()

      await saveHardwareProfile(existingProfile)
    },
    [hardwareProfile, connectedGamepadId, connectedGamepad, saveHardwareProfile]
  )

  // Set selected axis index (creates default config if needed)
  const setSelectedAxisIndex = useCallback(
    (index: number) => {
      if (!connectedGamepadId) return

      const existingConfig = hardwareProfile?.devices?.[0]?.axes?.find(
        (a) => a.mapping === 'yaw' || a.mapping === 'x' || a.mapping === 'y'
      )

      // Create or update axis config
      const newConfig: AxisConfig = {
        index,
        label: `Axis ${index}`,
        mapping: 'y', // Default to y-axis for 1D vertical tracking
        deadzone: existingConfig?.deadzone ?? 0.05,
        sensitivity: existingConfig?.sensitivity ?? 1.0,
        sensitivityCurve: existingConfig?.sensitivityCurve ?? 'linear',
        inverted: existingConfig?.inverted ?? false,
        filterAlpha: existingConfig?.filterAlpha ?? 0.3,
        calibrationMin: existingConfig?.calibrationMin,
        calibrationMax: existingConfig?.calibrationMax,
      }

      updateAxisConfig(newConfig)
    },
    [hardwareProfile, connectedGamepadId, updateAxisConfig]
  )

  const value: HardwareContextValue = {
    isGamepadConnected,
    connectedGamepad,
    connectedGamepadId,
    hardwareProfile,
    rudderAxisConfig,
    inputMode,
    rawAxisValue,
    processedAxisValue,
    allAxesValues,
    saveHardwareProfile,
    updateAxisConfig,
    setSelectedAxisIndex,
    isCalibrating,
    setIsCalibrating,
  }

  return (
    <HardwareContext.Provider value={value}>{children}</HardwareContext.Provider>
  )
}
