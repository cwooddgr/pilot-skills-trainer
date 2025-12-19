import { useState, useRef, useEffect } from 'react'
import { createTrial } from '@/lib/db'
import type { Trial, TrackingMetrics } from '@/types'
import { InputSystem } from '@/utils/inputSystem'
import { createTargetGenerator } from '@/utils/targetGeneration'
import { createTargetGenerator2D } from '@/utils/targetGeneration2D'
import type { TargetGenerator } from '@/utils/targetGeneration'
import type { TargetGenerator2D } from '@/utils/targetGeneration2D'
import { calculateTrackingMetrics } from '@/utils/metricsCalculation'
import { calculateTrackingMetrics2D } from '@/utils/metricsCalculation2D'
import {
  calculateMultitaskMetrics,
  type MultitaskMetricsInput,
} from '@/utils/metricsCalculationMultitask'
import type { TrackingSample } from '@/utils/metricsCalculation'
import type { TrackingSample2D } from '@/utils/metricsCalculation2D'

interface ModuleEProps {
  moduleRunId: string
  difficulty: number
  onTrialComplete?: (trial: Trial) => void
}

type TrialMode = 'idle' | 'baseline-1d' | 'baseline-2d' | 'dual-task' | 'ready-2d' | 'ready-dual'

export function ModuleE({ moduleRunId, difficulty, onTrialComplete }: ModuleEProps) {
  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Trial state
  const [trialMode, setTrialMode] = useState<TrialMode>('idle')
  const [baselineMetrics1D, setBaselineMetrics1D] = useState<TrackingMetrics | null>(null)
  const [baselineMetrics2D, setBaselineMetrics2D] = useState<TrackingMetrics | null>(null)
  const [currentMetrics1D, setCurrentMetrics1D] = useState<TrackingMetrics | null>(null)
  const [currentMetrics2D, setCurrentMetrics2D] = useState<TrackingMetrics | null>(null)
  const [dualTaskCost, setDualTaskCost] = useState<number | null>(null)

  // Game state refs
  const trialModeRef = useRef<TrialMode>('idle')
  const inputSystem = useRef<InputSystem | null>(null)
  const targetGenerator1D = useRef<TargetGenerator | null>(null)
  const targetGenerator2D = useRef<TargetGenerator2D | null>(null)
  const animationFrameId = useRef<number | null>(null)
  const trialStartTime = useRef<number>(0)
  const lastUpdateTime = useRef<number>(0)

  // Cursor positions
  const keyboard1DPosition = useRef<number>(0)
  const cursor2DPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Raw mouse position in canvas pixels
  const mouseCanvasX = useRef<number>(0)
  const mouseCanvasY = useRef<number>(0)

  // Sample recording
  const samples1D = useRef<TrackingSample[]>([])
  const samples2D = useRef<TrackingSample2D[]>([])

  // Tracked keys for 1D keyboard control
  const keysPressed = useRef<Set<string>>(new Set())

  // Constants
  const trialDuration = 30000 // 30 seconds in ms
  const canvasWidth = 1200
  const canvasHeight = 400
  const leftPanelWidth = 600
  const rightPanelWidth = 600

  // Initialize input system
  useEffect(() => {
    if (!canvasRef.current) return

    inputSystem.current = new InputSystem()
    inputSystem.current.init(canvasRef.current, false) // No pointer lock

    // Set up keyboard tracking for 1D
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'a' || key === 'd') {
        keysPressed.current.add(key)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysPressed.current.delete(key)
    }

    // Handle mouse movement for direct position tracking
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      mouseCanvasX.current = e.clientX - rect.left
      mouseCanvasY.current = e.clientY - rect.top
    }

    // Handle canvas click for 2D trial initialization
    const handleCanvasClick = (e: MouseEvent) => {
      const mode = trialModeRef.current
      if (mode !== 'ready-2d' && mode !== 'ready-dual') return

      const canvas = canvasRef.current
      if (!canvas) return

      // Get click position relative to canvas
      const rect = canvas.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      // For ready-2d, cursor is in right panel center
      // For ready-dual, cursor is also in right panel center
      const panelOffsetX = mode === 'ready-2d' || mode === 'ready-dual' ? 600 : 0
      const cursorCanvasX = panelOffsetX + 300 // Center of right panel
      const cursorCanvasY = 200 // Center vertically

      // Check if click is near cursor (within 50px)
      const distance = Math.sqrt(
        Math.pow(clickX - cursorCanvasX, 2) + Math.pow(clickY - cursorCanvasY, 2)
      )

      if (distance <= 50) {
        // Click on cursor! Begin trial
        if (mode === 'ready-2d') {
          beginTrialAfterClick('baseline-2d')
        } else if (mode === 'ready-dual') {
          beginTrialAfterClick('dual-task')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    canvasRef.current.addEventListener('mousemove', handleMouseMove)
    canvasRef.current.addEventListener('click', handleCanvasClick)

    return () => {
      inputSystem.current?.destroy()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      canvasRef.current?.removeEventListener('mousemove', handleMouseMove)
      canvasRef.current?.removeEventListener('click', handleCanvasClick)
    }
  }, [])

  // Sync trialMode state with ref to avoid closure issues in game loop
  useEffect(() => {
    trialModeRef.current = trialMode

    // Start ready state animation for 2D trials
    if (trialMode === 'ready-2d' || trialMode === 'ready-dual') {
      renderReadyState()
    }
  }, [trialMode])

  // Update keyboard-controlled 1D position
  const updateKeyboard1D = (dt: number) => {
    const keyboardSpeed = 2.0 // Units per second

    if (keysPressed.current.has('a')) {
      keyboard1DPosition.current -= keyboardSpeed * dt
    }
    if (keysPressed.current.has('d')) {
      keyboard1DPosition.current += keyboardSpeed * dt
    }

    // Clamp to [-1, 1]
    keyboard1DPosition.current = Math.max(-1, Math.min(1, keyboard1DPosition.current))
  }

  // Start trial (or ready state for 2D trials)
  const startTrial = (mode: TrialMode) => {
    if (!canvasRef.current) return

    // Reset state
    samples1D.current = []
    samples2D.current = []
    keyboard1DPosition.current = 0
    cursor2DPosition.current = { x: 0, y: 0 }
    inputSystem.current?.reset()
    keysPressed.current.clear()

    // Create target generators based on mode
    if (mode === 'baseline-1d' || mode === 'dual-task' || mode === 'ready-dual') {
      // Random variant for 1D
      const variant1D = Math.random() < 0.5 ? 'sinusoid' : 'ornstein-uhlenbeck'
      targetGenerator1D.current = createTargetGenerator({
        type: variant1D,
        bounds: [-1, 1],
        difficulty,
      })
    }

    if (mode === 'baseline-2d' || mode === 'dual-task' || mode === 'ready-2d' || mode === 'ready-dual') {
      // Random variant for 2D
      const variant2D = Math.random() < 0.5 ? 'momentum' : 'curvilinear'
      targetGenerator2D.current = createTargetGenerator2D({
        type: variant2D,
        bounds: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
        difficulty,
      })
    }

    setCurrentMetrics1D(null)
    setCurrentMetrics2D(null)
    setDualTaskCost(null)

    // For 2D trials, show "ready" screen first
    if (mode === 'baseline-2d') {
      setTrialMode('ready-2d')
    } else if (mode === 'dual-task') {
      setTrialMode('ready-dual')
    } else {
      // 1D trial starts immediately
      trialStartTime.current = performance.now()
      lastUpdateTime.current = performance.now()
      setTrialMode(mode)
      gameLoop()
    }
  }

  // Begin trial after click (for 2D trials)
  const beginTrialAfterClick = (mode: TrialMode) => {
    trialStartTime.current = performance.now()
    lastUpdateTime.current = performance.now()
    setTrialMode(mode)
    gameLoop()
  }

  // Game loop
  const gameLoop = () => {
    const now = performance.now()
    const elapsed = now - trialStartTime.current
    const dt = (now - lastUpdateTime.current) / 1000
    lastUpdateTime.current = now

    // Check if trial should end
    if (elapsed >= trialDuration) {
      stopTrial()
      return
    }

    const mode = trialModeRef.current

    // Update targets
    const target1D = (mode === 'baseline-1d' || mode === 'dual-task')
      ? targetGenerator1D.current?.update(1 / 60) || 0
      : 0

    const target2D = (mode === 'baseline-2d' || mode === 'dual-task')
      ? targetGenerator2D.current?.update(1 / 60) || { x: 0, y: 0 }
      : { x: 0, y: 0 }

    // Update cursors
    // 1D: Use keyboard accumulator
    if (mode === 'baseline-1d' || mode === 'dual-task') {
      updateKeyboard1D(dt)
    }

    // 2D: Use direct mouse position tracking (pixel-perfect)
    if (mode === 'baseline-2d' || mode === 'dual-task') {
      // Convert mouse canvas pixel position to normalized coordinates
      // Right panel is from x=600 to x=1200
      const mousePanelX = mouseCanvasX.current - leftPanelWidth
      const mousePanelY = mouseCanvasY.current

      // Normalize to [-1, 1]
      const normalizedX = (mousePanelX / rightPanelWidth) * 2 - 1
      const normalizedY = (mousePanelY / canvasHeight) * 2 - 1

      // Clamp to bounds
      cursor2DPosition.current = {
        x: Math.max(-1, Math.min(1, normalizedX)),
        y: Math.max(-1, Math.min(1, normalizedY)),
      }
    }

    // Record samples
    if (mode === 'baseline-1d' || mode === 'dual-task') {
      samples1D.current.push({
        timestamp: elapsed,
        targetPosition: target1D,
        cursorPosition: keyboard1DPosition.current,
        inputValue: keyboard1DPosition.current,
      })
    }

    if (mode === 'baseline-2d' || mode === 'dual-task') {
      samples2D.current.push({
        timestamp: elapsed,
        targetPosition: target2D,
        cursorPosition: cursor2DPosition.current,
        inputValue: cursor2DPosition.current,
      })
    }

    // Render
    render(target1D, keyboard1DPosition.current, target2D, cursor2DPosition.current, elapsed)

    // Continue loop
    animationFrameId.current = requestAnimationFrame(gameLoop)
  }

  // Stop trial
  const stopTrial = async () => {
    // Cancel animation frame
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current)
      animationFrameId.current = null
    }

    const mode = trialModeRef.current

    if (mode === 'baseline-1d') {
      // Calculate and store 1D baseline metrics
      const metrics = calculateTrackingMetrics(samples1D.current)
      setBaselineMetrics1D(metrics)
      setCurrentMetrics1D(metrics)

      // Auto-advance to 2D baseline after a brief pause
      setTimeout(() => startTrial('baseline-2d'), 1500)
    } else if (mode === 'baseline-2d') {
      // Calculate and store 2D baseline metrics
      const metrics = calculateTrackingMetrics2D(samples2D.current)
      setBaselineMetrics2D(metrics)
      setCurrentMetrics2D(metrics)

      // Return to idle, ready for dual-task
      setTrialMode('idle')
    } else if (mode === 'dual-task') {
      // Calculate metrics for both tasks
      const metrics1D = calculateTrackingMetrics(samples1D.current)
      const metrics2D = calculateTrackingMetrics2D(samples2D.current)

      setCurrentMetrics1D(metrics1D)
      setCurrentMetrics2D(metrics2D)

      // Calculate multitask metrics
      if (baselineMetrics1D && baselineMetrics2D) {
        const multitaskInput: MultitaskMetricsInput = {
          baseline1D: baselineMetrics1D,
          baseline2D: baselineMetrics2D,
          dual1D: metrics1D,
          dual2D: metrics2D,
        }

        const multitaskMetrics = calculateMultitaskMetrics(multitaskInput)
        setDualTaskCost(multitaskMetrics.dualTaskCost)

        // Save trial to database
        const trial: Trial = {
          id: crypto.randomUUID(),
          moduleRunId,
          moduleId: 'E',
          difficulty,
          durationMs: trialDuration,
          startTimestamp: trialStartTime.current,
          events: [
            // Tag 1D samples
            ...samples1D.current.map(s => ({
              t: s.timestamp,
              type: 'input' as const,
              value: {
                task: '1D',
                targetPosition: s.targetPosition,
                cursorPosition: s.cursorPosition,
                inputValue: s.inputValue,
              },
            })),
            // Tag 2D samples
            ...samples2D.current.map(s => ({
              t: s.timestamp,
              type: 'input' as const,
              value: {
                task: '2D',
                targetPosition: s.targetPosition,
                cursorPosition: s.cursorPosition,
                inputValue: s.inputValue,
              },
            })),
          ].sort((a, b) => a.t - b.t),
          metrics: {
            tracking: metrics1D,
            multitask: multitaskMetrics,
          },
        }

        await createTrial(trial)
        onTrialComplete?.(trial)
      }

      setTrialMode('idle')
    }
  }

  // Render ready state (waiting for click)
  const renderReadyState = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const mode = trialModeRef.current

    // Stop animation if no longer in ready state
    if (mode !== 'ready-2d' && mode !== 'ready-dual') {
      return
    }

    // Clear canvas
    ctx.fillStyle = '#0f172a' // slate-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw background for active panel(s)
    if (mode === 'ready-dual') {
      // Both panels active
      ctx.fillStyle = '#1e293b' // slate-800
      ctx.fillRect(0, 0, leftPanelWidth, canvasHeight)
    }
    if (mode === 'ready-2d' || mode === 'ready-dual') {
      ctx.fillStyle = '#1e293b' // slate-800
      ctx.fillRect(leftPanelWidth, 0, rightPanelWidth, canvasHeight)
    }

    // Draw vertical divider
    ctx.strokeStyle = '#475569' // slate-600
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(leftPanelWidth, 0)
    ctx.lineTo(leftPanelWidth, canvasHeight)
    ctx.stroke()

    // Draw green cursor in center of right panel
    const cursorX = leftPanelWidth + rightPanelWidth / 2
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

  // Render function
  const render = (
    target1D: number,
    cursor1D: number,
    target2D: { x: number; y: number },
    cursor2D: { x: number; y: number },
    elapsed: number
  ) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const mode = trialModeRef.current

    // Clear canvas
    ctx.fillStyle = '#0f172a' // slate-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw background for left panel (slightly different shade)
    if (mode === 'baseline-1d' || mode === 'dual-task') {
      ctx.fillStyle = '#1e293b' // slate-800
      ctx.fillRect(0, 0, leftPanelWidth, canvasHeight)
    }

    // Draw vertical divider
    ctx.strokeStyle = '#475569' // slate-600
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(leftPanelWidth, 0)
    ctx.lineTo(leftPanelWidth, canvasHeight)
    ctx.stroke()

    // Render 1D task (left panel)
    if (mode === 'baseline-1d' || mode === 'dual-task') {
      render1DTask(ctx, target1D, cursor1D, 0)
    }

    // Render 2D task (right panel)
    if (mode === 'baseline-2d' || mode === 'dual-task') {
      render2DTask(ctx, target2D, cursor2D, leftPanelWidth)
    }

    // Draw labels
    ctx.fillStyle = '#94a3b8' // slate-400
    ctx.font = '14px sans-serif'

    if (mode === 'baseline-1d') {
      ctx.fillText('1D Baseline (A/D keys)', 20, 30)
    } else if (mode === 'baseline-2d') {
      ctx.fillText('2D Baseline (Mouse)', leftPanelWidth + 20, 30)
    } else if (mode === 'dual-task') {
      ctx.fillText('1D Tracking (A/D keys)', 20, 30)
      ctx.fillText('2D Tracking (Mouse)', leftPanelWidth + 20, 30)
    }

    // Draw timer
    const remaining = Math.max(0, (trialDuration - elapsed) / 1000)
    ctx.fillStyle = '#f1f5f9' // slate-100
    ctx.font = '18px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`Time: ${remaining.toFixed(1)}s`, canvasWidth / 2, canvasHeight - 20)
    ctx.textAlign = 'left'
  }

  // Render 1D horizontal tracking task
  const render1DTask = (
    ctx: CanvasRenderingContext2D,
    targetPos: number,
    cursorPos: number,
    offsetX: number
  ) => {
    const centerX = offsetX + leftPanelWidth / 2
    const centerY = canvasHeight / 2

    // Convert normalized positions to canvas coordinates
    const targetX = centerX + targetPos * (leftPanelWidth / 2) * 0.8
    const cursorX = centerX + cursorPos * (leftPanelWidth / 2) * 0.8

    // Draw center reference line (horizontal)
    ctx.strokeStyle = '#334155' // slate-700
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(offsetX + 50, centerY)
    ctx.lineTo(offsetX + leftPanelWidth - 50, centerY)
    ctx.stroke()

    // Calculate error for color coding
    const errorPx = Math.abs(targetX - cursorX)
    let errorColor = '#10b981' // green
    if (errorPx > 30) errorColor = '#ef4444' // red
    else if (errorPx > 15) errorColor = '#f59e0b' // amber

    // Draw error line
    ctx.strokeStyle = errorColor
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(targetX, centerY)
    ctx.lineTo(cursorX, centerY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw target circle
    ctx.fillStyle = '#3b82f6' // blue-500
    ctx.beginPath()
    ctx.arc(targetX, centerY, 12, 0, Math.PI * 2)
    ctx.fill()

    // Draw cursor circle
    ctx.fillStyle = '#10b981' // green-500
    ctx.beginPath()
    ctx.arc(cursorX, centerY, 10, 0, Math.PI * 2)
    ctx.fill()

    // Draw error distance
    ctx.fillStyle = '#cbd5e1' // slate-300
    ctx.font = '12px monospace'
    ctx.fillText(`Error: ${errorPx.toFixed(0)}px`, offsetX + 20, 60)
  }

  // Render 2D tracking task
  const render2DTask = (
    ctx: CanvasRenderingContext2D,
    targetPos: { x: number; y: number },
    _cursorPos: { x: number; y: number },
    offsetX: number
  ) => {
    const centerX = offsetX + rightPanelWidth / 2
    const centerY = canvasHeight / 2

    // Convert target normalized position to canvas coordinates (with margin)
    const targetX = centerX + targetPos.x * (rightPanelWidth / 2) * 0.8
    const targetY = centerY + targetPos.y * (canvasHeight / 2) * 0.8

    // Draw cursor at EXACT mouse position (pixel-perfect)
    const cursorX = mouseCanvasX.current
    const cursorY = mouseCanvasY.current

    // Draw center crosshairs
    ctx.strokeStyle = '#334155' // slate-700
    ctx.lineWidth = 1
    ctx.beginPath()
    // Horizontal line
    ctx.moveTo(offsetX + 50, centerY)
    ctx.lineTo(offsetX + rightPanelWidth - 50, centerY)
    // Vertical line
    ctx.moveTo(centerX, 50)
    ctx.lineTo(centerX, canvasHeight - 50)
    ctx.stroke()

    // Calculate error for color coding
    const dx = targetX - cursorX
    const dy = targetY - cursorY
    const errorPx = Math.sqrt(dx * dx + dy * dy)
    let errorColor = '#10b981' // green
    if (errorPx > 40) errorColor = '#ef4444' // red
    else if (errorPx > 20) errorColor = '#f59e0b' // amber

    // Draw error line
    ctx.strokeStyle = errorColor
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(targetX, targetY)
    ctx.lineTo(cursorX, cursorY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw target circle with outer ring
    ctx.fillStyle = '#3b82f6' // blue-500
    ctx.beginPath()
    ctx.arc(targetX, targetY, 15, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#60a5fa' // blue-400
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(targetX, targetY, 25, 0, Math.PI * 2)
    ctx.stroke()

    // Draw cursor circle
    ctx.fillStyle = '#10b981' // green-500
    ctx.beginPath()
    ctx.arc(cursorX, cursorY, 12, 0, Math.PI * 2)
    ctx.fill()

    // Draw error distance
    ctx.fillStyle = '#cbd5e1' // slate-300
    ctx.font = '12px monospace'
    ctx.fillText(`Error: ${errorPx.toFixed(0)}px`, offsetX + 20, 60)
  }

  // Handle baseline button click
  const handleStartBaseline = () => {
    if (!baselineMetrics1D) {
      startTrial('baseline-1d')
    } else if (!baselineMetrics2D) {
      startTrial('baseline-2d')
    } else {
      // Reset baselines and start over
      setBaselineMetrics1D(null)
      setBaselineMetrics2D(null)
      startTrial('baseline-1d')
    }
  }

  // Handle dual-task button click
  const handleStartDualTask = () => {
    startTrial('dual-task')
  }

  const isRunning = trialMode !== 'idle'
  const canStartDualTask = baselineMetrics1D !== null && baselineMetrics2D !== null && !isRunning

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2">Module E: Dual-Task Motor Control</h2>
        <p className="text-slate-300 mb-4">
          Perform 1D horizontal tracking (left panel, keyboard A/D) and 2D tracking (right panel,
          mouse) simultaneously. Complete baseline trials first to measure dual-task cost.
        </p>

        {/* Baseline Status */}
        <div className="grid grid-cols-2 gap-4">
          <div
            className={`p-4 rounded ${baselineMetrics1D ? 'bg-green-900/20 border border-green-700' : 'bg-slate-900'}`}
          >
            <div className="text-sm text-slate-400 mb-1">1D Baseline</div>
            <div className="font-mono text-blue-400 text-lg">
              {baselineMetrics1D ? `RMSE: ${baselineMetrics1D.rmse.toFixed(3)}` : 'Not completed'}
            </div>
            {baselineMetrics1D && (
              <div className="text-xs text-slate-500 mt-1">
                MAE: {baselineMetrics1D.mae.toFixed(3)} | Time on Target:{' '}
                {baselineMetrics1D.timeOnTarget.toFixed(1)}%
              </div>
            )}
          </div>

          <div
            className={`p-4 rounded ${baselineMetrics2D ? 'bg-green-900/20 border border-green-700' : 'bg-slate-900'}`}
          >
            <div className="text-sm text-slate-400 mb-1">2D Baseline</div>
            <div className="font-mono text-blue-400 text-lg">
              {baselineMetrics2D ? `RMSE: ${baselineMetrics2D.rmse.toFixed(3)}` : 'Not completed'}
            </div>
            {baselineMetrics2D && (
              <div className="text-xs text-slate-500 mt-1">
                MAE: {baselineMetrics2D.mae.toFixed(3)} | Time on Target:{' '}
                {baselineMetrics2D.timeOnTarget.toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="bg-slate-900 rounded-lg p-4">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="border border-slate-700 rounded"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={handleStartBaseline}
          disabled={isRunning}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-md font-medium transition-colors"
        >
          {!baselineMetrics1D
            ? 'Start 1D Baseline'
            : !baselineMetrics2D
              ? 'Start 2D Baseline'
              : 'Redo Baselines'}
        </button>

        <button
          onClick={handleStartDualTask}
          disabled={!canStartDualTask}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-md font-medium transition-colors"
        >
          Start Dual-Task Trial
        </button>
      </div>

      {/* Results Display */}
      {trialMode === 'idle' && currentMetrics1D && currentMetrics2D && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Dual-Task Results</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* 1D Task Results */}
            <div className="bg-slate-900 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-blue-400 mb-3">1D Task Performance</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">MAE:</span>
                  <span className="font-mono">{currentMetrics1D.mae.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">RMSE:</span>
                  <span className="font-mono">{currentMetrics1D.rmse.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time on Target:</span>
                  <span className="font-mono">{currentMetrics1D.timeOnTarget.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Smoothness:</span>
                  <span className="font-mono">{currentMetrics1D.smoothness.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* 2D Task Results */}
            <div className="bg-slate-900 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-blue-400 mb-3">2D Task Performance</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">MAE:</span>
                  <span className="font-mono">{currentMetrics2D.mae.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">RMSE:</span>
                  <span className="font-mono">{currentMetrics2D.rmse.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time on Target:</span>
                  <span className="font-mono">{currentMetrics2D.timeOnTarget.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Smoothness:</span>
                  <span className="font-mono">{currentMetrics2D.smoothness.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dual-Task Cost */}
          {dualTaskCost !== null && (
            <div className="bg-slate-900 rounded-lg p-4 border-2 border-blue-500">
              <h4 className="text-lg font-semibold text-blue-400 mb-2">Dual-Task Cost</h4>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold font-mono">
                  {(dualTaskCost * 100).toFixed(1)}%
                </span>
                <span className="text-slate-400">
                  {dualTaskCost > 0
                    ? 'performance degradation'
                    : dualTaskCost < 0
                      ? 'performance improvement'
                      : 'no change'}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                {dualTaskCost > 0.3
                  ? 'High cost: Consider practicing each task separately first'
                  : dualTaskCost > 0.1
                    ? 'Moderate cost: Normal dual-task interference'
                    : 'Low cost: Good multitasking performance'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
