import { useEffect, useRef, useState } from 'react'
import { createTargetGenerator, TargetGenerator } from '@/utils/targetGeneration'
import { InputSystem } from '@/utils/inputSystem'
import {
  calculateTrackingMetrics,
  samplesToEvents,
  TrackingSample,
} from '@/utils/metricsCalculation'
import type { Trial, TrackingMetrics } from '@/types'
import { createTrial } from '@/lib/db'

interface ModuleAProps {
  moduleRunId: string
  difficulty: number
  onTrialComplete?: (trial: Trial) => void
}

type TrialState = 'idle' | 'running' | 'completed'

export function ModuleA({ moduleRunId, difficulty, onTrialComplete }: ModuleAProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [trialState, setTrialState] = useState<TrialState>('idle')
  const [currentMetrics, setCurrentMetrics] = useState<TrackingMetrics | null>(null)
  const [trialDuration] = useState(30000) // 30 seconds per trial

  // Game state refs (don't trigger re-renders)
  const targetGenerator = useRef<TargetGenerator | null>(null)
  const inputSystem = useRef<InputSystem | null>(null)
  const animationFrameId = useRef<number | null>(null)
  const samples = useRef<TrackingSample[]>([])
  const trialStartTime = useRef<number>(0)
  const cursorPosition = useRef<number>(0)

  // Canvas dimensions
  const canvasWidth = 800
  const canvasHeight = 200

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize input system
    inputSystem.current = new InputSystem()
    inputSystem.current.init(canvasRef.current)

    return () => {
      if (inputSystem.current) {
        inputSystem.current.destroy()
      }
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [])

  const startTrial = () => {
    if (!canvasRef.current) return

    // Reset state
    samples.current = []
    cursorPosition.current = 0
    if (inputSystem.current) {
      inputSystem.current.reset()
    }

    // Create target generator (randomize variant)
    const variants = ['ornstein-uhlenbeck', 'sinusoid', 'piecewise'] as const
    const variantIndex = Math.floor(Math.random() * variants.length)
    const variant = variants[variantIndex]

    targetGenerator.current = createTargetGenerator({
      type: variant,
      bounds: [-1, 1],
      difficulty: difficulty,
    })

    // Start trial
    trialStartTime.current = performance.now()
    setTrialState('running')
    setCurrentMetrics(null)

    // Start game loop
    gameLoop()
  }

  const stopTrial = async () => {
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current)
      animationFrameId.current = null
    }

    // Calculate final metrics
    const metrics = calculateTrackingMetrics(samples.current)
    setCurrentMetrics(metrics)

    // Create trial object
    const trial: Trial = {
      id: crypto.randomUUID(),
      moduleRunId,
      moduleId: 'A',
      difficulty,
      durationMs: trialDuration,
      startTimestamp: trialStartTime.current,
      events: samplesToEvents(samples.current),
      metrics: {
        tracking: metrics,
      },
    }

    // Save to database
    await createTrial(trial)

    setTrialState('completed')

    // Notify parent
    if (onTrialComplete) {
      onTrialComplete(trial)
    }
  }

  const gameLoop = () => {
    const now = performance.now()
    const elapsed = now - trialStartTime.current

    // Check if trial duration exceeded
    if (elapsed >= trialDuration) {
      stopTrial()
      return
    }

    // Update target
    const dt = 1 / 60 // Assume 60 FPS
    const targetPos = targetGenerator.current?.update(dt) || 0

    // Get input
    const inputState = inputSystem.current?.getState() || { x: 0, y: 0, buttons: new Map() }

    // Update cursor (in 1D, we use y axis for vertical movement)
    // For keyboard: direct position control
    // For mouse: position is already normalized -1 to 1
    cursorPosition.current = inputState.y

    // Record sample
    samples.current.push({
      timestamp: elapsed,
      targetPosition: targetPos,
      cursorPosition: cursorPosition.current,
      inputValue: inputState.y,
    })

    // Render
    render(targetPos, cursorPosition.current)

    // Continue loop
    animationFrameId.current = requestAnimationFrame(gameLoop)
  }

  const render = (targetPos: number, cursorPos: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#0f172a' // slate-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw center line
    ctx.strokeStyle = '#334155' // slate-700
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, canvasHeight / 2)
    ctx.lineTo(canvasWidth, canvasHeight / 2)
    ctx.stroke()

    // Convert normalized positions (-1 to 1) to canvas coordinates
    const targetY = canvasHeight / 2 + targetPos * (canvasHeight / 2) * 0.8
    const cursorY = canvasHeight / 2 + cursorPos * (canvasHeight / 2) * 0.8

    // Draw target
    ctx.fillStyle = '#3b82f6' // blue-500
    ctx.beginPath()
    ctx.arc(100, targetY, 12, 0, Math.PI * 2)
    ctx.fill()

    // Draw cursor
    ctx.fillStyle = '#10b981' // green-500
    ctx.beginPath()
    ctx.arc(100, cursorY, 10, 0, Math.PI * 2)
    ctx.fill()

    // Draw connecting line (error visualization)
    const error = Math.abs(targetY - cursorY)
    const errorColor = error < 15 ? '#10b981' : error < 30 ? '#f59e0b' : '#ef4444'
    ctx.strokeStyle = errorColor
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(100, targetY)
    ctx.lineTo(100, cursorY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw time remaining
    const elapsed = performance.now() - trialStartTime.current
    const remaining = Math.max(0, (trialDuration - elapsed) / 1000)
    ctx.fillStyle = '#94a3b8' // slate-400
    ctx.font = '16px monospace'
    ctx.fillText(`Time: ${remaining.toFixed(1)}s`, 20, 30)

    // Draw instructions
    ctx.fillStyle = '#64748b' // slate-500
    ctx.font = '14px sans-serif'
    ctx.fillText('Use ↑ ↓ arrow keys or mouse to match the blue target', 20, canvasHeight - 20)
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2">Module A: 1D Pursuit Tracking</h2>
        <p className="text-slate-300 mb-4">
          Track the moving blue target with your cursor. Use arrow keys or mouse to control the
          green cursor.
        </p>

        <div className="flex items-center gap-4 mb-4">
          <div className="text-sm">
            <span className="text-slate-400">Difficulty:</span>{' '}
            <span className="font-mono text-blue-400">{(difficulty * 100).toFixed(0)}%</span>
          </div>
          <div className="text-sm">
            <span className="text-slate-400">Duration:</span>{' '}
            <span className="font-mono text-blue-400">{trialDuration / 1000}s</span>
          </div>
          <div className="text-sm">
            <span className="text-slate-400">Status:</span>{' '}
            <span className={`font-mono ${
              trialState === 'running' ? 'text-green-400' :
              trialState === 'completed' ? 'text-blue-400' : 'text-slate-400'
            }`}>
              {trialState}
            </span>
          </div>
        </div>

        {/* Canvas */}
        <div className="bg-slate-900 rounded-lg p-4 inline-block">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="border border-slate-700 rounded"
          />
        </div>

        {/* Controls */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={startTrial}
            disabled={trialState === 'running'}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-md font-medium transition-colors"
          >
            Start Trial
          </button>
          <button
            onClick={stopTrial}
            disabled={trialState !== 'running'}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-md font-medium transition-colors"
          >
            Stop Trial
          </button>
        </div>
      </div>

      {/* Metrics Display */}
      {currentMetrics && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Trial Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Mean Absolute Error</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.mae.toFixed(3)}
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Root Mean Squared Error</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.rmse.toFixed(3)}
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Time on Target</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.timeOnTarget.toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Overshoot Count</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.overshootCount}
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Avg Overshoot</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.overshootMagnitude.toFixed(3)}
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Smoothness</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.smoothness.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-1">(lower is smoother)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
