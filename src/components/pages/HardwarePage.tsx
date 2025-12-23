import { useState, useEffect, useRef, useCallback } from 'react'
import { useHardware } from '@/context/HardwareContext'
import { gamepadManager } from '@/utils/gamepadManager'
import type { AxisConfig, SensitivityCurve } from '@/types'

// Axis value bar component
function AxisBar({
  value,
  label,
  selected,
  onSelect,
}: {
  value: number
  label: string
  selected: boolean
  onSelect: () => void
}) {
  // Map -1..1 to 0..100%
  const position = ((value + 1) / 2) * 100

  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 rounded-lg border-2 transition-colors ${
        selected
          ? 'border-blue-500 bg-slate-700'
          : 'border-slate-600 bg-slate-800 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-slate-400 font-mono">{value.toFixed(3)}</span>
      </div>
      <div className="relative h-3 bg-slate-900 rounded overflow-hidden">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />
        {/* Value indicator */}
        <div
          className="absolute top-0 bottom-0 w-2 bg-blue-500 rounded transition-all duration-75"
          style={{ left: `calc(${position}% - 4px)` }}
        />
      </div>
    </button>
  )
}

// Calibration wizard component
function CalibrationWizard({
  rawValue,
  onComplete,
  onCancel,
}: {
  rawValue: number
  onComplete: (min: number, max: number) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<'min' | 'max' | 'done'>('min')
  const [minValue, setMinValue] = useState<number | null>(null)
  const [maxValue, setMaxValue] = useState<number | null>(null)
  const [recordedMin, setRecordedMin] = useState<number>(rawValue)
  const [recordedMax, setRecordedMax] = useState<number>(rawValue)

  // Track min/max during each step
  useEffect(() => {
    if (step === 'min') {
      setRecordedMin((prev) => Math.min(prev, rawValue))
    } else if (step === 'max') {
      setRecordedMax((prev) => Math.max(prev, rawValue))
    }
  }, [rawValue, step])

  const handleSetMin = () => {
    setMinValue(recordedMin)
    setRecordedMax(rawValue)
    setStep('max')
  }

  const handleSetMax = () => {
    setMaxValue(recordedMax)
    setStep('done')
  }

  const handleComplete = () => {
    if (minValue !== null && maxValue !== null) {
      onComplete(minValue, maxValue)
    }
  }

  return (
    <div className="bg-slate-700 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold">Calibration Wizard</h3>

      {step === 'min' && (
        <div className="space-y-3">
          <p className="text-slate-300">
            Step 1: Push the pedal to its <strong>minimum</strong> position (full left)
          </p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-slate-400 mb-1">Current value</div>
              <div className="font-mono text-lg">{rawValue.toFixed(3)}</div>
            </div>
            <div className="flex-1">
              <div className="text-xs text-slate-400 mb-1">Recorded minimum</div>
              <div className="font-mono text-lg text-blue-400">{recordedMin.toFixed(3)}</div>
            </div>
          </div>
          <button
            onClick={handleSetMin}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            Set Minimum
          </button>
        </div>
      )}

      {step === 'max' && (
        <div className="space-y-3">
          <p className="text-slate-300">
            Step 2: Push the pedal to its <strong>maximum</strong> position (full right)
          </p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-slate-400 mb-1">Current value</div>
              <div className="font-mono text-lg">{rawValue.toFixed(3)}</div>
            </div>
            <div className="flex-1">
              <div className="text-xs text-slate-400 mb-1">Recorded maximum</div>
              <div className="font-mono text-lg text-blue-400">{recordedMax.toFixed(3)}</div>
            </div>
          </div>
          <button
            onClick={handleSetMax}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            Set Maximum
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-3">
          <p className="text-green-400">Calibration complete!</p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-slate-400 mb-1">Minimum</div>
              <div className="font-mono text-lg">{minValue?.toFixed(3)}</div>
            </div>
            <div className="flex-1">
              <div className="text-xs text-slate-400 mb-1">Maximum</div>
              <div className="font-mono text-lg">{maxValue?.toFixed(3)}</div>
            </div>
          </div>
          <button
            onClick={handleComplete}
            className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
          >
            Save Calibration
          </button>
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}

// Mini test canvas for verifying configuration
function TestCanvas({ processedValue }: { processedValue: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetRef = useRef(0)
  const animationRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Animate target
    const animate = () => {
      // Move target slowly
      targetRef.current += 0.005
      const targetY = Math.sin(targetRef.current) * 0.7

      // Clear
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(0, 0, width, height)

      // Draw center line
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(width / 2, 0)
      ctx.lineTo(width / 2, height)
      ctx.stroke()

      // Draw target
      const targetX = ((targetY + 1) / 2) * width
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath()
      ctx.arc(targetX, height / 2, 8, 0, Math.PI * 2)
      ctx.fill()

      // Draw cursor
      const cursorX = ((processedValue + 1) / 2) * width
      ctx.fillStyle = '#10b981'
      ctx.beginPath()
      ctx.arc(cursorX, height / 2, 6, 0, Math.PI * 2)
      ctx.fill()

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [processedValue])

  return (
    <div className="space-y-2">
      <div className="text-sm text-slate-400">
        Test: Move pedals to control the green dot, try to follow the blue target
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={60}
        className="w-full bg-slate-800 rounded-lg"
      />
    </div>
  )
}

export function HardwarePage() {
  const {
    isGamepadConnected,
    connectedGamepad,
    rudderAxisConfig,
    allAxesValues,
    rawAxisValue,
    processedAxisValue,
    updateAxisConfig,
    setSelectedAxisIndex,
    isCalibrating,
    setIsCalibrating,
  } = useHardware()

  // Active polling for gamepad detection on this page
  useEffect(() => {
    // Poll more aggressively on this page to detect gamepads
    const pollInterval = setInterval(() => {
      gamepadManager.poll()
    }, 100)

    return () => clearInterval(pollInterval)
  }, [])

  // Local state for settings
  const [deadzone, setDeadzone] = useState(rudderAxisConfig?.deadzone ?? 0.05)
  const [sensitivity, setSensitivity] = useState(rudderAxisConfig?.sensitivity ?? 1.0)
  const [sensitivityCurve, setSensitivityCurve] = useState<SensitivityCurve>(
    rudderAxisConfig?.sensitivityCurve ?? 'linear'
  )
  const [inverted, setInverted] = useState(rudderAxisConfig?.inverted ?? false)

  // Sync local state when config changes
  useEffect(() => {
    if (rudderAxisConfig) {
      setDeadzone(rudderAxisConfig.deadzone)
      setSensitivity(rudderAxisConfig.sensitivity)
      setSensitivityCurve(rudderAxisConfig.sensitivityCurve ?? 'linear')
      setInverted(rudderAxisConfig.inverted)
    }
  }, [rudderAxisConfig])

  // Save settings
  const handleSaveSettings = useCallback(async () => {
    if (!rudderAxisConfig) return

    const newConfig: AxisConfig = {
      ...rudderAxisConfig,
      deadzone,
      sensitivity,
      sensitivityCurve,
      inverted,
    }

    await updateAxisConfig(newConfig)
  }, [rudderAxisConfig, deadzone, sensitivity, sensitivityCurve, inverted, updateAxisConfig])

  // Handle calibration complete
  const handleCalibrationComplete = useCallback(
    async (min: number, max: number) => {
      if (!rudderAxisConfig) return

      const newConfig: AxisConfig = {
        ...rudderAxisConfig,
        calibrationMin: min,
        calibrationMax: max,
      }

      await updateAxisConfig(newConfig)
      setIsCalibrating(false)
    },
    [rudderAxisConfig, updateAxisConfig, setIsCalibrating]
  )

  // Reset calibration
  const handleResetCalibration = useCallback(async () => {
    if (!rudderAxisConfig) return

    const newConfig: AxisConfig = {
      ...rudderAxisConfig,
      calibrationMin: undefined,
      calibrationMax: undefined,
    }

    await updateAxisConfig(newConfig)
  }, [rudderAxisConfig, updateAxisConfig])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Hardware Setup</h1>

      {/* Device Status */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Device Status</h2>

        {isGamepadConnected && connectedGamepad ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <div className="font-medium">{connectedGamepad.id}</div>
              <div className="text-sm text-slate-400">
                Connected - {connectedGamepad.axes.length} axes,{' '}
                {connectedGamepad.buttons.length} buttons
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-slate-400 mb-4">No gamepad detected</div>
            <p className="text-sm text-slate-500 mb-4">
              Connect your rudder pedals and <strong>press a button or move the pedals</strong> to
              wake up the device.
            </p>
            <p className="text-xs text-slate-600 mb-4">
              (Browsers require interaction before detecting gamepads)
            </p>
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 inline-block">
              <p className="text-xs text-amber-400">
                <strong>Note:</strong> Safari has limited gamepad support. Use Chrome or Firefox for best results.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Axis Selection */}
      {isGamepadConnected && allAxesValues.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Axis Selection</h2>
          <p className="text-sm text-slate-400 mb-4">
            Move the pedals to identify the correct axis, then select it below.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allAxesValues.map((value, index) => (
              <AxisBar
                key={index}
                value={value}
                label={`Axis ${index}`}
                selected={rudderAxisConfig?.index === index}
                onSelect={() => setSelectedAxisIndex(index)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Calibration */}
      {isGamepadConnected && rudderAxisConfig && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Calibration</h2>

          {isCalibrating ? (
            <CalibrationWizard
              rawValue={rawAxisValue}
              onComplete={handleCalibrationComplete}
              onCancel={() => setIsCalibrating(false)}
            />
          ) : (
            <div className="space-y-4">
              {rudderAxisConfig.calibrationMin !== undefined &&
              rudderAxisConfig.calibrationMax !== undefined ? (
                <div className="flex items-center gap-4 p-3 bg-slate-700 rounded-lg">
                  <div className="flex-1">
                    <div className="text-xs text-slate-400">Calibrated Range</div>
                    <div className="font-mono">
                      {rudderAxisConfig.calibrationMin.toFixed(3)} to{' '}
                      {rudderAxisConfig.calibrationMax.toFixed(3)}
                    </div>
                  </div>
                  <button
                    onClick={handleResetCalibration}
                    className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 rounded transition-colors"
                  >
                    Reset
                  </button>
                </div>
              ) : (
                <div className="text-sm text-slate-400">
                  No calibration set. Calibrate for best accuracy.
                </div>
              )}

              <button
                onClick={() => setIsCalibrating(true)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
              >
                Start Calibration
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fine Tuning */}
      {isGamepadConnected && rudderAxisConfig && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Fine Tuning</h2>

          <div className="space-y-6">
            {/* Deadzone */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">Deadzone</label>
                <span className="text-sm text-slate-400 font-mono">{deadzone.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.3"
                step="0.01"
                value={deadzone}
                onChange={(e) => setDeadzone(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Ignore small movements near center position
              </p>
            </div>

            {/* Sensitivity Curve */}
            <div>
              <label className="text-sm font-medium block mb-2">Sensitivity Curve</label>
              <select
                value={sensitivityCurve}
                onChange={(e) => setSensitivityCurve(e.target.value as SensitivityCurve)}
                className="w-full p-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="linear">Linear (1:1 response)</option>
                <option value="quadratic">Quadratic (more precision near center)</option>
                <option value="cubic">Cubic (most precision near center)</option>
              </select>
            </div>

            {/* Sensitivity */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">Sensitivity</label>
                <span className="text-sm text-slate-400 font-mono">{sensitivity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            {/* Invert */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="invert"
                checked={inverted}
                onChange={(e) => setInverted(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <label htmlFor="invert" className="text-sm font-medium">
                Invert Axis
              </label>
            </div>

            {/* Live Preview */}
            <div className="p-3 bg-slate-700 rounded-lg">
              <div className="flex items-center gap-4 mb-2">
                <div className="flex-1">
                  <div className="text-xs text-slate-400">Raw</div>
                  <div className="font-mono">{rawAxisValue.toFixed(3)}</div>
                </div>
                <div className="text-slate-500">→</div>
                <div className="flex-1">
                  <div className="text-xs text-slate-400">Processed</div>
                  <div className="font-mono text-blue-400">{processedAxisValue.toFixed(3)}</div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Test Area */}
      {isGamepadConnected && rudderAxisConfig && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Area</h2>
          <TestCanvas processedValue={processedAxisValue} />
        </div>
      )}
    </div>
  )
}
