import { useEffect, useRef, useState } from 'react'
import { createTargetGenerator2D, TargetGenerator2D } from '@/utils/targetGeneration2D'
import { InputSystem } from '@/utils/inputSystem'
import {
  calculateTrackingMetrics2D,
  samplesToEvents2D,
  TrackingSample2D,
} from '@/utils/metricsCalculation2D'
import type { Trial, TrackingMetrics } from '@/types'
import { createTrial } from '@/lib/db'

interface ModuleBProps {
  moduleRunId: string
  difficulty: number
  onTrialComplete?: (trial: Trial) => void
}

type TrialState = 'idle' | 'ready' | 'running' | 'completed'

export function ModuleB({ moduleRunId, difficulty, onTrialComplete }: ModuleBProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [trialState, setTrialState] = useState<TrialState>('idle')
  const trialStateRef = useRef<TrialState>('idle')
  const [currentMetrics, setCurrentMetrics] = useState<TrackingMetrics | null>(null)
  const [trialDuration] = useState(30000) // 30 seconds per trial

  // Game state refs (don't trigger re-renders)
  const targetGenerator = useRef<TargetGenerator2D | null>(null)
  const inputSystem = useRef<InputSystem | null>(null)
  const animationFrameId = useRef<number | null>(null)
  const samples = useRef<TrackingSample2D[]>([])
  const trialStartTime = useRef<number>(0)
  const cursorPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Raw mouse position in canvas pixels
  const mouseCanvasX = useRef<number>(0)
  const mouseCanvasY = useRef<number>(0)

  // Canvas dimensions
  const canvasWidth = 800
  const canvasHeight = 600

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize input system WITHOUT pointer lock (we'll use direct mouse tracking)
    inputSystem.current = new InputSystem()
    inputSystem.current.init(canvasRef.current, false)

    // Handle mouse movement for direct position tracking
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      mouseCanvasX.current = e.clientX - rect.left
      mouseCanvasY.current = e.clientY - rect.top
    }

    // Handle canvas click for trial initialization
    const handleCanvasClick = (e: MouseEvent) => {
      const state = trialStateRef.current
      if (state !== 'ready') return

      const canvas = canvasRef.current
      if (!canvas) return

      // Get click position relative to canvas
      const rect = canvas.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      // Cursor is in center of canvas
      const cursorCanvasX = canvasWidth / 2
      const cursorCanvasY = canvasHeight / 2

      // Check if click is near cursor (within 50px)
      const distance = Math.sqrt(
        Math.pow(clickX - cursorCanvasX, 2) + Math.pow(clickY - cursorCanvasY, 2)
      )

      if (distance <= 50) {
        // Click on cursor! Begin trial
        beginTrialAfterClick()
      }
    }

    canvasRef.current.addEventListener('mousemove', handleMouseMove)
    canvasRef.current.addEventListener('click', handleCanvasClick)

    return () => {
      if (inputSystem.current) {
        inputSystem.current.destroy()
      }
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
      }
      canvasRef.current?.removeEventListener('mousemove', handleMouseMove)
      canvasRef.current?.removeEventListener('click', handleCanvasClick)
    }
  }, [])

  // Sync trialState with ref to avoid closure issues
  useEffect(() => {
    trialStateRef.current = trialState

    // Start ready state animation
    if (trialState === 'ready') {
      renderReadyState()
    }
  }, [trialState])

  const startTrial = () => {
    if (!canvasRef.current) return

    // Reset state
    samples.current = []
    cursorPosition.current = { x: 0, y: 0 }
    if (inputSystem.current) {
      inputSystem.current.reset()
    }

    // Create target generator (randomize variant)
    const variants = ['momentum', 'curvilinear'] as const
    const variantIndex = Math.floor(Math.random() * variants.length)
    const variant = variants[variantIndex]

    targetGenerator.current = createTargetGenerator2D({
      type: variant,
      bounds: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      difficulty: difficulty,
    })

    setCurrentMetrics(null)

    // Show ready state first (click to start)
    setTrialState('ready')
  }

  // Begin trial after click
  const beginTrialAfterClick = () => {
    trialStartTime.current = performance.now()
    setTrialState('running')
    gameLoop()
  }

  const stopTrial = async () => {
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current)
      animationFrameId.current = null
    }

    // Calculate final metrics
    const metrics = calculateTrackingMetrics2D(samples.current)
    setCurrentMetrics(metrics)

    // Create trial object
    const trial: Trial = {
      id: crypto.randomUUID(),
      moduleRunId,
      moduleId: 'B',
      difficulty,
      durationMs: trialDuration,
      startTimestamp: trialStartTime.current,
      events: samplesToEvents2D(samples.current),
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
    const targetPos = targetGenerator.current?.update(dt) || { x: 0, y: 0 }

    // Update cursor using direct mouse position tracking (pixel-perfect)
    // Convert mouse canvas pixel position to normalized coordinates
    const normalizedX = (mouseCanvasX.current / canvasWidth) * 2 - 1
    const normalizedY = (mouseCanvasY.current / canvasHeight) * 2 - 1

    // Clamp to bounds
    cursorPosition.current = {
      x: Math.max(-1, Math.min(1, normalizedX)),
      y: Math.max(-1, Math.min(1, normalizedY)),
    }

    // Record sample
    samples.current.push({
      timestamp: elapsed,
      targetPosition: targetPos,
      cursorPosition: cursorPosition.current,
      inputValue: cursorPosition.current,
    })

    // Render
    render(targetPos, cursorPosition.current)

    // Continue loop
    animationFrameId.current = requestAnimationFrame(gameLoop)
  }

  // Render ready state (waiting for click)
  const renderReadyState = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const state = trialStateRef.current

    // Stop animation if no longer in ready state
    if (state !== 'ready') {
      return
    }

    // Clear canvas
    ctx.fillStyle = '#0f172a' // slate-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw center crosshairs
    ctx.strokeStyle = '#334155' // slate-700
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, canvasHeight / 2)
    ctx.lineTo(canvasWidth, canvasHeight / 2)
    ctx.moveTo(canvasWidth / 2, 0)
    ctx.lineTo(canvasWidth / 2, canvasHeight)
    ctx.stroke()

    // Draw green cursor in center
    const cursorX = canvasWidth / 2
    const cursorY = canvasHeight / 2

    // Pulsing effect
    const pulse = Math.sin(Date.now() / 300) * 0.2 + 1
    ctx.fillStyle = '#10b981' // green-500
    ctx.globalAlpha = pulse * 0.8
    ctx.beginPath()
    ctx.arc(cursorX, cursorY, 15 * pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // Draw cursor ring
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cursorX, cursorY, 30, 0, Math.PI * 2)
    ctx.stroke()

    // Draw instruction text
    ctx.fillStyle = '#f1f5f9' // slate-100
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Click the green cursor to begin', canvasWidth / 2, canvasHeight - 40)
    ctx.textAlign = 'left'

    // Request next frame for animation
    requestAnimationFrame(renderReadyState)
  }

  const render = (targetPos: { x: number; y: number }, _cursorPos: { x: number; y: number }) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#0f172a' // slate-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw center crosshairs
    ctx.strokeStyle = '#334155' // slate-700
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, canvasHeight / 2)
    ctx.lineTo(canvasWidth, canvasHeight / 2)
    ctx.moveTo(canvasWidth / 2, 0)
    ctx.lineTo(canvasWidth / 2, canvasHeight)
    ctx.stroke()

    // Convert target normalized position to canvas coordinates (with margin)
    const targetX = canvasWidth / 2 + targetPos.x * (canvasWidth / 2) * 0.8
    const targetY = canvasHeight / 2 + targetPos.y * (canvasHeight / 2) * 0.8

    // Draw cursor at EXACT mouse position (pixel-perfect)
    const cursorX = mouseCanvasX.current
    const cursorY = mouseCanvasY.current

    // Draw target
    ctx.fillStyle = '#3b82f6' // blue-500
    ctx.beginPath()
    ctx.arc(targetX, targetY, 15, 0, Math.PI * 2)
    ctx.fill()

    // Draw target outer ring
    ctx.strokeStyle = '#60a5fa' // blue-400
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(targetX, targetY, 25, 0, Math.PI * 2)
    ctx.stroke()

    // Draw cursor
    ctx.fillStyle = '#10b981' // green-500
    ctx.beginPath()
    ctx.arc(cursorX, cursorY, 12, 0, Math.PI * 2)
    ctx.fill()

    // Draw connecting line (error visualization)
    const dx = targetX - cursorX
    const dy = targetY - cursorY
    const error = Math.sqrt(dx * dx + dy * dy)
    const errorColor = error < 20 ? '#10b981' : error < 40 ? '#f59e0b' : '#ef4444'
    ctx.strokeStyle = errorColor
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(targetX, targetY)
    ctx.lineTo(cursorX, cursorY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw time remaining
    const elapsed = performance.now() - trialStartTime.current
    const remaining = Math.max(0, (trialDuration - elapsed) / 1000)
    ctx.fillStyle = '#94a3b8' // slate-400
    ctx.font = '16px monospace'
    ctx.fillText(`Time: ${remaining.toFixed(1)}s`, 20, 30)

    // Draw error distance
    ctx.fillText(`Error: ${error.toFixed(0)}px`, 20, 55)

    // Draw instructions
    ctx.fillStyle = '#64748b' // slate-500
    ctx.font = '14px sans-serif'
    const instruction = document.pointerLockElement === canvasRef.current
      ? 'Use mouse or WASD keys to match the blue target (ESC to release mouse)'
      : 'Click canvas to lock mouse, then use mouse or WASD keys'
    ctx.fillText(instruction, 20, canvasHeight - 20)
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2">Module B: 2D Pursuit Tracking</h2>
        <p className="text-slate-300 mb-4">
          Track the moving blue target in 2D space. Click the canvas to lock your mouse for smooth control,
          or use WASD/Arrow keys. Press ESC to release mouse lock.
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
            <span
              className={`font-mono ${
                trialState === 'running'
                  ? 'text-green-400'
                  : trialState === 'completed'
                    ? 'text-blue-400'
                    : 'text-slate-400'
              }`}
            >
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
            className="border border-slate-700 rounded cursor-none"
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
                {currentMetrics.smoothness.toFixed(3)}
              </div>
              <div className="text-xs text-slate-500 mt-1">(lower is smoother)</div>
            </div>
            {currentMetrics.reacquisitionTimes && currentMetrics.reacquisitionTimes.length > 0 && (
              <div className="bg-slate-900 rounded-lg p-4 col-span-2 md:col-span-3">
                <div className="text-slate-400 text-sm mb-2">Reacquisition Times</div>
                <div className="text-sm font-mono text-blue-400">
                  {currentMetrics.reacquisitionTimes.map((t) => (t / 1000).toFixed(2)).join('s, ')}s
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Average: {(currentMetrics.reacquisitionTimes.reduce((a, b) => a + b, 0) / currentMetrics.reacquisitionTimes.length / 1000).toFixed(2)}s
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
