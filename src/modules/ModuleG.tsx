import { useEffect, useRef, useState } from 'react'
import { createTargetGenerator2D, TargetGenerator2D } from '@/utils/targetGeneration2D'
import { InputSystem } from '@/utils/inputSystem'
import { TrackingSample2D } from '@/utils/metricsCalculation2D'
import {
  generateInterruptSequence,
  InterruptSequence,
  Interrupt,
  InterruptResponse,
  InterruptColor,
} from '@/utils/interruptTasks'
import { calculateInterruptMetrics, InterruptMetrics } from '@/utils/interruptMetrics'
import type { Trial } from '@/types'
import { createTrial } from '@/lib/db'

interface ModuleGProps {
  moduleRunId: string
  difficulty: number
  onTrialComplete?: (trial: Trial) => void
}

type TrialState = 'idle' | 'ready' | 'running' | 'completed'

export function ModuleG({ moduleRunId, difficulty, onTrialComplete }: ModuleGProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // State (triggers re-renders)
  const [trialState, setTrialState] = useState<TrialState>('idle')
  const [currentMetrics, setCurrentMetrics] = useState<InterruptMetrics | null>(null)
  const [currentInterrupt, setCurrentInterrupt] = useState<Interrupt | null>(null)
  const [interruptFeedback, setInterruptFeedback] = useState<{
    message: string
    color: string
  } | null>(null)

  // Refs for render function (avoid closure bugs with requestAnimationFrame)
  const interruptFeedbackRef = useRef<{ message: string; color: string } | null>(null)
  const [countdown, setCountdown] = useState<number>(0)

  // Refs (avoid closure bugs)
  const trialStateRef = useRef<TrialState>('idle')
  const inputSystem = useRef<InputSystem | null>(null)
  const targetGenerator = useRef<TargetGenerator2D | null>(null)
  const animationFrameId = useRef<number | null>(null)
  const trialStartTime = useRef<number>(0)
  const lastFrameTime = useRef<number>(0)
  const cursorPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const mouseCanvasX = useRef<number>(0)
  const mouseCanvasY = useRef<number>(0)

  // Tracking samples
  const samples = useRef<TrackingSample2D[]>([])

  // Interrupt state
  const interruptSequence = useRef<InterruptSequence | null>(null)
  const currentInterruptIndex = useRef<number>(0)
  const currentInterruptStartTime = useRef<number>(0)
  const interruptResponses = useRef<InterruptResponse[]>([])
  const currentInterruptRef = useRef<Interrupt | null>(null)
  const interruptTimeoutId = useRef<number | null>(null)

  // Canvas dimensions
  const canvasWidth = 800
  const canvasHeight = 600
  const trialDuration = 60000 // 60 seconds

  // CRITICAL: Sync state with ref to avoid closure bugs
  useEffect(() => {
    trialStateRef.current = trialState
  }, [trialState])

  useEffect(() => {
    currentInterruptRef.current = currentInterrupt
  }, [currentInterrupt])

  useEffect(() => {
    interruptFeedbackRef.current = interruptFeedback
  }, [interruptFeedback])

  // Initialize input system and event handlers
  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize mouse position to center
    mouseCanvasX.current = canvasWidth / 2
    mouseCanvasY.current = canvasHeight / 2

    // Initialize input system WITHOUT pointer lock
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
        beginTrialAfterClick()
      }
    }

    // Handle keyboard for interrupt responses
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = trialStateRef.current
      if (state !== 'running') return

      const interrupt = currentInterruptRef.current
      if (!interrupt) return

      // Check if key is 1-4
      if (['1', '2', '3', '4'].includes(e.key)) {
        handleInterruptResponse(e.key)
      }
    }

    canvasRef.current.addEventListener('mousemove', handleMouseMove)
    canvasRef.current.addEventListener('click', handleCanvasClick)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      if (inputSystem.current) {
        inputSystem.current.destroy()
      }
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
      }
      if (interruptTimeoutId.current !== null) {
        clearTimeout(interruptTimeoutId.current)
      }
      canvasRef.current?.removeEventListener('mousemove', handleMouseMove)
      canvasRef.current?.removeEventListener('click', handleCanvasClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Start trial preparation
  const startTrial = () => {
    setTrialState('ready')
    setCurrentMetrics(null)
    setCurrentInterrupt(null)
    setInterruptFeedback(null)
    samples.current = []
    interruptResponses.current = []
    currentInterruptIndex.current = 0

    // Generate interrupt sequence
    interruptSequence.current = generateInterruptSequence(difficulty, trialDuration)

    // Initialize target generator with NORMALIZED coordinates (-1 to 1)
    // We'll scale to pixels when rendering
    const algorithm = Math.random() > 0.5 ? 'momentum' : 'curvilinear'
    targetGenerator.current = createTargetGenerator2D({
      type: algorithm,
      bounds: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      difficulty: 0.4 + difficulty * 0.3, // 0.4-0.7 moderate speed
    })

    // Reset cursor to center
    cursorPosition.current = { x: canvasWidth / 2, y: canvasHeight / 2 }
    mouseCanvasX.current = canvasWidth / 2
    mouseCanvasY.current = canvasHeight / 2

    // Render initial state with crosshair
    renderReadyState()
  }

  // Render ready state with crosshair
  const renderReadyState = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw crosshair at center
    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2

    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 2
    const cursorSize = 15
    ctx.beginPath()
    ctx.moveTo(centerX - cursorSize, centerY)
    ctx.lineTo(centerX + cursorSize, centerY)
    ctx.moveTo(centerX, centerY - cursorSize)
    ctx.lineTo(centerX, centerY + cursorSize)
    ctx.stroke()

    // Draw circle around crosshair to make it more visible
    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(centerX, centerY, 50, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Begin trial after click
  const beginTrialAfterClick = () => {
    // 3-2-1 countdown
    setCountdown(3)
    let count = 3

    const countdownInterval = setInterval(() => {
      count--

      if (count === 0) {
        clearInterval(countdownInterval)
        setCountdown(-1) // Hide countdown overlay

        // Small delay before starting
        setTimeout(() => {
          // Start trial
          setTrialState('running')
          trialStateRef.current = 'running' // Set ref immediately to avoid race condition
          const now = performance.now()
          trialStartTime.current = now
          lastFrameTime.current = now
          gameLoop()
          // Schedule first interrupt
          scheduleNextInterrupt()
        }, 100)
      } else {
        setCountdown(count)
      }
    }, 1000)
  }

  // Schedule next interrupt
  const scheduleNextInterrupt = () => {
    if (!interruptSequence.current) return

    const sequence = interruptSequence.current
    if (currentInterruptIndex.current >= sequence.interrupts.length) return

    const interrupt = sequence.interrupts[currentInterruptIndex.current]
    const now = performance.now()
    const elapsedTime = now - trialStartTime.current
    const timeUntilInterrupt = interrupt.appearTime - elapsedTime

    if (timeUntilInterrupt > 0) {
      interruptTimeoutId.current = window.setTimeout(() => {
        showInterrupt(interrupt)
      }, timeUntilInterrupt)
    }
  }

  // Show interrupt
  const showInterrupt = (interrupt: Interrupt) => {
    setCurrentInterrupt(interrupt)
    currentInterruptStartTime.current = performance.now()

    // Schedule miss if no response
    interruptTimeoutId.current = window.setTimeout(() => {
      if (currentInterruptRef.current?.id === interrupt.id) {
        handleInterruptMiss(interrupt)
      }
    }, interrupt.responseWindow)
  }

  // Handle interrupt response
  const handleInterruptResponse = (keyPressed: string) => {
    const interrupt = currentInterruptRef.current
    if (!interrupt) return

    const responseTime = performance.now() - currentInterruptStartTime.current
    const correct = keyPressed === interrupt.correctKey

    // Record response
    const response: InterruptResponse = {
      interruptId: interrupt.id,
      responseTime,
      keyPressed,
      correct,
      missed: false,
    }
    interruptResponses.current.push(response)

    // Show feedback
    if (correct) {
      setInterruptFeedback({ message: 'Correct!', color: '#10b981' })
    } else {
      setInterruptFeedback({ message: 'Incorrect!', color: '#ef4444' })
    }

    // Clear interrupt
    setCurrentInterrupt(null)
    if (interruptTimeoutId.current !== null) {
      clearTimeout(interruptTimeoutId.current)
    }

    // Clear feedback after 500ms
    setTimeout(() => {
      setInterruptFeedback(null)
    }, 500)

    // Schedule next interrupt
    currentInterruptIndex.current++
    scheduleNextInterrupt()
  }

  // Handle interrupt miss
  const handleInterruptMiss = (interrupt: Interrupt) => {
    // Record miss
    const response: InterruptResponse = {
      interruptId: interrupt.id,
      responseTime: interrupt.responseWindow,
      keyPressed: '',
      correct: false,
      missed: true,
    }
    interruptResponses.current.push(response)

    // Show feedback
    setInterruptFeedback({ message: 'Missed!', color: '#f59e0b' })

    // Clear interrupt
    setCurrentInterrupt(null)

    // Clear feedback after 500ms
    setTimeout(() => {
      setInterruptFeedback(null)
    }, 500)

    // Schedule next interrupt
    currentInterruptIndex.current++
    scheduleNextInterrupt()
  }

  // Main game loop
  const gameLoop = () => {
    if (trialStateRef.current !== 'running') return

    const now = performance.now()
    const elapsedTime = now - trialStartTime.current

    // Check if trial complete
    if (elapsedTime >= trialDuration) {
      endTrial()
      return
    }

    // Calculate delta time in seconds
    let dt = (now - lastFrameTime.current) / 1000
    lastFrameTime.current = now

    // First frame might have dt=0, use 16ms default
    if (dt <= 0 || dt > 0.1) {
      dt = 0.016 // Assume 60fps
    }

    // Update cursor position from mouse
    cursorPosition.current = {
      x: mouseCanvasX.current,
      y: mouseCanvasY.current,
    }

    // Update target with actual delta time
    if (targetGenerator.current) {
      targetGenerator.current.update(dt)
      const targetPos = targetGenerator.current.getPosition()

      // Scale from normalized (-1 to 1) to canvas pixels with padding
      const padding = 50
      const targetX = ((targetPos.x + 1) / 2) * (canvasWidth - 2 * padding) + padding
      const targetY = ((targetPos.y + 1) / 2) * (canvasHeight - 2 * padding) + padding

      // Record sample with pixel coordinates
      samples.current.push({
        timestamp: elapsedTime,
        targetPosition: { x: targetX, y: targetY },
        cursorPosition: { x: cursorPosition.current.x, y: cursorPosition.current.y },
        inputValue: { x: mouseCanvasX.current, y: mouseCanvasY.current },
      })
    }

    // Render
    render()

    // Continue loop
    animationFrameId.current = requestAnimationFrame(gameLoop)
  }

  // Render function
  const render = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw target (scale from normalized -1 to 1 to pixel coordinates)
    if (targetGenerator.current) {
      const targetPos = targetGenerator.current.getPosition()
      // Scale from normalized (-1 to 1) to canvas pixels with padding
      const padding = 50
      const targetX = ((targetPos.x + 1) / 2) * (canvasWidth - 2 * padding) + padding
      const targetY = ((targetPos.y + 1) / 2) * (canvasHeight - 2 * padding) + padding

      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(targetX, targetY, 20, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw cursor (crosshair)
    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 2
    const cursorSize = 15
    ctx.beginPath()
    ctx.moveTo(cursorPosition.current.x - cursorSize, cursorPosition.current.y)
    ctx.lineTo(cursorPosition.current.x + cursorSize, cursorPosition.current.y)
    ctx.moveTo(cursorPosition.current.x, cursorPosition.current.y - cursorSize)
    ctx.lineTo(cursorPosition.current.x, cursorPosition.current.y + cursorSize)
    ctx.stroke()

    // Draw interrupt overlay if present (use ref to avoid closure bug)
    if (currentInterruptRef.current) {
      drawInterrupt(ctx, currentInterruptRef.current)
    }

    // Draw feedback if present (use ref to avoid closure bug)
    if (interruptFeedbackRef.current) {
      ctx.fillStyle = interruptFeedbackRef.current.color
      ctx.font = 'bold 32px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(interruptFeedbackRef.current.message, canvasWidth / 2, 80)
    }

    // Draw timer
    const now = performance.now()
    const elapsedTime = now - trialStartTime.current
    const remainingTime = Math.max(0, (trialDuration - elapsedTime) / 1000)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '20px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`${remainingTime.toFixed(1)}s`, canvasWidth - 20, 30)
  }

  // Draw interrupt stimulus
  const drawInterrupt = (ctx: CanvasRenderingContext2D, interrupt: Interrupt) => {
    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2
    const size = 120

    // Semi-transparent backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw shape
    ctx.fillStyle = getColorHex(interrupt.color)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3

    switch (interrupt.type) {
      case 'circle':
        ctx.beginPath()
        ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
      case 'square':
        ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size)
        ctx.strokeRect(centerX - size / 2, centerY - size / 2, size, size)
        break
      case 'triangle':
        ctx.beginPath()
        ctx.moveTo(centerX, centerY - size / 2)
        ctx.lineTo(centerX + size / 2, centerY + size / 2)
        ctx.lineTo(centerX - size / 2, centerY + size / 2)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break
      case 'star':
        drawStar(ctx, centerX, centerY, 5, size / 2, size / 4)
        ctx.fill()
        ctx.stroke()
        break
    }

    // Draw instructions
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Press the number key:', centerX, centerY + size + 40)
    ctx.fillText(`1=Red  2=Blue  3=Green  4=Yellow`, centerX, centerY + size + 75)
  }

  // Helper: Draw star shape
  const drawStar = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    spikes: number,
    outerRadius: number,
    innerRadius: number
  ) => {
    let rot = (Math.PI / 2) * 3
    let x = cx
    let y = cy
    const step = Math.PI / spikes

    ctx.beginPath()
    ctx.moveTo(cx, cy - outerRadius)

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius
      y = cy + Math.sin(rot) * outerRadius
      ctx.lineTo(x, y)
      rot += step

      x = cx + Math.cos(rot) * innerRadius
      y = cy + Math.sin(rot) * innerRadius
      ctx.lineTo(x, y)
      rot += step
    }

    ctx.lineTo(cx, cy - outerRadius)
    ctx.closePath()
  }

  // Helper: Get color hex
  const getColorHex = (color: InterruptColor): string => {
    switch (color) {
      case 'red':
        return '#ef4444'
      case 'blue':
        return '#3b82f6'
      case 'green':
        return '#10b981'
      case 'yellow':
        return '#f59e0b'
    }
  }

  // End trial and save metrics
  const endTrial = async () => {
    setTrialState('completed')

    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current)
    }
    if (interruptTimeoutId.current !== null) {
      clearTimeout(interruptTimeoutId.current)
    }

    // Calculate metrics
    const metrics = calculateInterruptMetrics(
      samples.current,
      interruptSequence.current?.interrupts || [],
      interruptResponses.current,
      interruptSequence.current?.baselineDuration || 0
    )

    setCurrentMetrics(metrics)

    // Create trial record
    const trial: Trial = {
      id: crypto.randomUUID(),
      moduleRunId,
      moduleId: 'G',
      difficulty,
      durationMs: trialDuration,
      startTimestamp: Date.now() - trialDuration,
      events: [],
      metrics: {
        interrupt: metrics,
      },
    }

    await createTrial(trial)

    if (onTrialComplete) {
      onTrialComplete(trial)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Module G: Interrupt Handling Under Load</h2>
        <p className="text-slate-400">
          Track the target while responding to time-critical interrupts
        </p>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="border-2 border-slate-600 bg-slate-800 rounded"
          style={{ cursor: trialState === 'running' ? 'none' : 'default' }}
        />

        {trialState === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
            <button
              onClick={startTrial}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Start Trial
            </button>
          </div>
        )}

        {trialState === 'ready' && (
          <div className="absolute top-4 left-0 right-0 flex flex-col items-center pointer-events-none">
            <div className="bg-black/80 px-6 py-4 rounded-lg text-center text-white">
              <p className="text-xl mb-2 font-semibold">Click the blue crosshair to begin</p>
              <p className="text-sm text-slate-300">
                Track the red target • Respond to interrupts with number keys (1-4)
              </p>
            </div>
          </div>
        )}

        {countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded">
            <div className="text-8xl font-bold text-white">{countdown}</div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {trialState !== 'completed' && (
        <div className="bg-slate-800 p-6 rounded-lg max-w-2xl">
          <h3 className="font-semibold mb-2">Instructions</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• Use your mouse to track the red target continuously</li>
            <li>• Visual interrupts will appear requiring immediate classification</li>
            <li>• Press the number key matching the color: 1=Red, 2=Blue, 3=Green, 4=Yellow</li>
            <li>• Respond quickly and accurately, then return to tracking</li>
            <li>• Trial duration: 60 seconds</li>
          </ul>
        </div>
      )}

      {/* Results */}
      {trialState === 'completed' && currentMetrics && (
        <div className="bg-slate-800 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="text-xl font-semibold mb-4">Trial Results</h3>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">Tracking Performance</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Baseline RMSE:</span>
                  <span className="font-mono">{currentMetrics.baselineRMSE.toFixed(2)} px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Interrupt RMSE:</span>
                  <span className="font-mono">{currentMetrics.interruptRMSE.toFixed(2)} px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Interference Cost:</span>
                  <span className="font-mono">
                    {(currentMetrics.interferenceCost * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-green-400 mb-2">Interrupt Performance</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Accuracy:</span>
                  <span className="font-mono">
                    {(currentMetrics.interruptAccuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hit Rate:</span>
                  <span className="font-mono">
                    {(currentMetrics.interruptHitRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mean Reaction Time:</span>
                  <span className="font-mono">{currentMetrics.meanReactionTime.toFixed(0)} ms</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-semibold text-purple-400 mb-2">Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm text-center">
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-2xl font-bold text-green-400">
                  {currentMetrics.correctResponses}
                </div>
                <div className="text-slate-400">Correct</div>
              </div>
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-2xl font-bold text-red-400">
                  {currentMetrics.incorrectResponses}
                </div>
                <div className="text-slate-400">Incorrect</div>
              </div>
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-2xl font-bold text-yellow-400">
                  {currentMetrics.missedResponses}
                </div>
                <div className="text-slate-400">Missed</div>
              </div>
            </div>
          </div>

          <button
            onClick={startTrial}
            className="mt-6 w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Run Another Trial
          </button>
        </div>
      )}
    </div>
  )
}
