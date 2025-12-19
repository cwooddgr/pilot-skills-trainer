import { useEffect, useRef, useState } from 'react'
import { createTargetGenerator, TargetGenerator } from '@/utils/targetGeneration'
import { createTargetGenerator2D, TargetGenerator2D } from '@/utils/targetGeneration2D'
import { InputSystem } from '@/utils/inputSystem'
import { AudioStimulus, StimulusType, StimulusEvent } from '@/utils/audioStimulus'
import {
  calculateTrackingMetrics,
  samplesToEvents,
  TrackingSample,
} from '@/utils/metricsCalculation'
import {
  calculateTrackingMetrics2D,
  samplesToEvents2D,
  TrackingSample2D,
} from '@/utils/metricsCalculation2D'
import {
  calculateAttentionMetrics,
  AttentionResponse,
} from '@/utils/attentionMetrics'
import { generateStimulusSequence } from '@/utils/audioStimulus'
import { calculateTripleTaskMetrics } from '@/utils/metricsCalculationTripleTask'
import type { Trial, TrackingMetrics, AttentionMetrics } from '@/types'
import { createTrial } from '@/lib/db'

interface ModuleFProps {
  moduleRunId: string
  difficulty: number
  onTrialComplete?: (trial: Trial) => void
}

type TrialMode =
  | 'idle'
  | 'baseline-1d'
  | 'baseline-2d'
  | 'ready-2d'
  | 'baseline-audio'
  | 'preparing-audio'
  | 'ready-triple'
  | 'preparing-triple'
  | 'triple-task'

export function ModuleF({ moduleRunId, difficulty, onTrialComplete }: ModuleFProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // State (triggers re-renders)
  const [trialMode, setTrialMode] = useState<TrialMode>('idle')
  const [countdown, setCountdown] = useState<number>(0)
  const [baselineMetrics1D, setBaselineMetrics1D] = useState<TrackingMetrics | null>(null)
  const [baselineMetrics2D, setBaselineMetrics2D] = useState<TrackingMetrics | null>(null)
  const [baselineMetricsAudio, setBaselineMetricsAudio] = useState<AttentionMetrics | null>(null)
  const [currentStimulus, setCurrentStimulus] = useState<StimulusType | null>(null)
  const [currentTargetTypes, setCurrentTargetTypes] = useState<StimulusType[]>([])
  const [stimulusCount, setStimulusCount] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  })
  const [feedbackMessage, setFeedbackMessage] = useState<string>('')

  // Refs (avoid closure bugs in game loops)
  const trialModeRef = useRef<TrialMode>('idle')
  const isTrialRunning = useRef<boolean>(false) // Gates spacebar
  const inputSystem = useRef<InputSystem | null>(null)
  const targetGenerator1D = useRef<TargetGenerator | null>(null)
  const targetGenerator2D = useRef<TargetGenerator2D | null>(null)
  const audioStimulus = useRef<AudioStimulus | null>(null)
  const animationFrameId = useRef<number | null>(null)
  const trialStartTime = useRef<number>(0)
  const lastUpdateTime = useRef<number>(0)
  const trialDuration = useRef<number>(30000) // Default 30s

  // Motor tracking state
  const keyboard1DPosition = useRef<number>(0)
  const cursor2DPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const mouseCanvasX = useRef<number>(0)
  const mouseCanvasY = useRef<number>(0)
  const keysPressed = useRef<Set<string>>(new Set())

  // Auditory task state
  const targetTypes = useRef<StimulusType[]>([])
  const stimulusSequence = useRef<StimulusEvent[]>([])
  const auditoryResponses = useRef<AttentionResponse[]>([])
  const currentStimulusIndex = useRef<number>(0)
  const currentStimulusStart = useRef<number>(0)
  const previousStimulusStart = useRef<number>(0)
  const responseWindow = useRef<{ min: number; max: number }>({ min: 100, max: 1200 })
  const hasRespondedToCurrentStimulus = useRef<boolean>(false)
  const countdownInterval = useRef<number | null>(null)

  // Sample recording
  const samples1D = useRef<TrackingSample[]>([])
  const samples2D = useRef<TrackingSample2D[]>([])

  // Canvas dimensions
  const canvasWidth = 900
  const canvasHeight = 400
  const leftPanelWidth = 450
  const rightPanelWidth = 450

  // CRITICAL: Sync state with ref to avoid closure bugs
  useEffect(() => {
    trialModeRef.current = trialMode
  }, [trialMode])

  // Initialize systems
  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize input system
    inputSystem.current = new InputSystem()
    inputSystem.current.init(canvasRef.current, false) // No pointer lock

    // Initialize audio stimulus
    audioStimulus.current = new AudioStimulus()

    return () => {
      if (inputSystem.current) {
        inputSystem.current.destroy()
      }
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
      }
      if (countdownInterval.current !== null) {
        clearInterval(countdownInterval.current)
      }
    }
  }, [])

  // Keyboard and mouse event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      // Motor task: A/D keys
      if (key === 'a' || key === 'd') {
        keysPressed.current.add(key)
      }

      // Auditory task: Spacebar (ONLY when gated)
      if (e.code === 'Space' && isTrialRunning.current) {
        e.preventDefault()
        handleAuditoryResponse()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'a' || key === 'd') {
        keysPressed.current.delete(key)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      mouseCanvasX.current = e.clientX - rect.left
      mouseCanvasY.current = e.clientY - rect.top
    }

    const handleCanvasClick = (e: MouseEvent) => {
      const mode = trialModeRef.current
      if (mode !== 'ready-2d' && mode !== 'ready-triple') return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      // Check if click is near cursor in RIGHT PANEL (within 50px)
      // Center of right panel: 500 + 250 = 750px
      const cursorCanvasX = leftPanelWidth + rightPanelWidth / 2
      const cursorCanvasY = canvasHeight / 2
      const distance = Math.sqrt(
        Math.pow(clickX - cursorCanvasX, 2) + Math.pow(clickY - cursorCanvasY, 2)
      )

      if (distance <= 50) {
        if (mode === 'ready-2d') {
          beginBaseline2D()
        } else if (mode === 'ready-triple') {
          beginTripleTask()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    canvasRef.current?.addEventListener('mousemove', handleMouseMove)
    canvasRef.current?.addEventListener('click', handleCanvasClick)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      canvasRef.current?.removeEventListener('mousemove', handleMouseMove)
      canvasRef.current?.removeEventListener('click', handleCanvasClick)
    }
  }, [])

  // Start ready-state animation
  useEffect(() => {
    if (trialMode === 'ready-2d' || trialMode === 'ready-triple') {
      renderReadyState()
    }
  }, [trialMode])

  // Helper: Update 1D keyboard position
  const updateKeyboard1D = (dt: number) => {
    if (keysPressed.current.has('a')) {
      keyboard1DPosition.current -= 2.0 * dt
    }
    if (keysPressed.current.has('d')) {
      keyboard1DPosition.current += 2.0 * dt
    }
    keyboard1DPosition.current = Math.max(-1, Math.min(1, keyboard1DPosition.current))
  }

  // Helper: Update 2D mouse position
  const updateMouse2D = () => {
    // Convert right panel mouse position to normalized coordinates
    const mousePanelX = mouseCanvasX.current - leftPanelWidth
    const mousePanelY = mouseCanvasY.current

    const normalizedX = (mousePanelX / rightPanelWidth) * 2 - 1
    const normalizedY = (mousePanelY / canvasHeight) * 2 - 1

    cursor2DPosition.current = {
      x: Math.max(-1, Math.min(1, normalizedX)),
      y: Math.max(-1, Math.min(1, normalizedY)),
    }
  }

  // Start baseline trials
  const startBaseline = () => {
    // Reset all baseline metrics
    setBaselineMetrics1D(null)
    setBaselineMetrics2D(null)
    setBaselineMetricsAudio(null)

    // Start with 1D baseline
    startBaseline1D()
  }

  const startBaseline1D = () => {
    // Reset state
    samples1D.current = []
    keyboard1DPosition.current = 0
    keysPressed.current.clear()

    // Create 1D target generator
    const variants = ['ornstein-uhlenbeck', 'sinusoid', 'piecewise'] as const
    const variantIndex = Math.floor(Math.random() * variants.length)
    const variant = variants[variantIndex]

    targetGenerator1D.current = createTargetGenerator({
      type: variant,
      bounds: [-1, 1],
      difficulty: difficulty,
    })

    trialDuration.current = 30000 // 30s
    trialStartTime.current = performance.now()
    lastUpdateTime.current = performance.now()
    setTrialMode('baseline-1d')
    motorGameLoop()
  }

  const startBaseline2D = () => {
    // Reset state
    samples2D.current = []
    cursor2DPosition.current = { x: 0, y: 0 }

    // Create 2D target generator
    const variants = ['momentum', 'curvilinear'] as const
    const variantIndex = Math.floor(Math.random() * variants.length)
    const variant = variants[variantIndex]

    targetGenerator2D.current = createTargetGenerator2D({
      type: variant,
      bounds: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      difficulty: difficulty,
    })

    // Show ready state (click-to-start)
    setTrialMode('ready-2d')
  }

  const beginBaseline2D = () => {
    trialDuration.current = 30000 // 30s
    trialStartTime.current = performance.now()
    lastUpdateTime.current = performance.now()
    setTrialMode('baseline-2d')
    motorGameLoop()
  }

  const startBaselineAudio = () => {
    // Reset state
    auditoryResponses.current = []
    currentStimulusIndex.current = 0

    // Choose random target types (1-2 types)
    const allTypes: StimulusType[] = ['low', 'medium', 'high']
    const numTargets = Math.random() < 0.5 ? 1 : 2
    const shuffled = [...allTypes].sort(() => Math.random() - 0.5)
    const selectedTargets = shuffled.slice(0, numTargets)

    targetTypes.current = selectedTargets
    setCurrentTargetTypes(selectedTargets)

    // Generate stimulus sequence (60s for audio baseline)
    stimulusSequence.current = generateStimulusSequence({ targetTypes: selectedTargets, difficulty }, 60000)
    setStimulusCount({ current: 0, total: stimulusSequence.current.length })

    // Set response window based on difficulty
    responseWindow.current = {
      min: 100,
      max: 1200 - difficulty * 600, // Harder = narrower window
    }

    // Show countdown (5s)
    setTrialMode('preparing-audio')
    let count = 5
    setCountdown(count)

    countdownInterval.current = window.setInterval(() => {
      count--
      setCountdown(count)
      if (count === 0) {
        if (countdownInterval.current !== null) {
          clearInterval(countdownInterval.current)
          countdownInterval.current = null
        }
        beginBaselineAudio()
      }
    }, 1000)
  }

  const beginBaselineAudio = () => {
    trialDuration.current = 60000 // 60s
    trialStartTime.current = performance.now()
    isTrialRunning.current = true
    setTrialMode('baseline-audio')

    // Start presenting stimuli
    presentNextStimulus()
  }

  // Start triple-task trial
  const startTripleTask = () => {
    // Reset all state
    samples1D.current = []
    samples2D.current = []
    auditoryResponses.current = []
    currentStimulusIndex.current = 0
    keyboard1DPosition.current = 0
    cursor2DPosition.current = { x: 0, y: 0 }
    keysPressed.current.clear()

    // Generate 1D target
    const variants1D = ['ornstein-uhlenbeck', 'sinusoid', 'piecewise'] as const
    const variantIndex1D = Math.floor(Math.random() * variants1D.length)
    targetGenerator1D.current = createTargetGenerator({
      type: variants1D[variantIndex1D],
      bounds: [-1, 1],
      difficulty: difficulty,
    })

    // Generate 2D target
    const variants2D = ['momentum', 'curvilinear'] as const
    const variantIndex2D = Math.floor(Math.random() * variants2D.length)
    targetGenerator2D.current = createTargetGenerator2D({
      type: variants2D[variantIndex2D],
      bounds: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      difficulty: difficulty,
    })

    // Generate stimulus sequence (60s)
    const allTypes: StimulusType[] = ['low', 'medium', 'high']
    const numTargets = Math.random() < 0.5 ? 1 : 2
    const shuffled = [...allTypes].sort(() => Math.random() - 0.5)
    const selectedTargets = shuffled.slice(0, numTargets)

    targetTypes.current = selectedTargets
    setCurrentTargetTypes(selectedTargets)
    stimulusSequence.current = generateStimulusSequence({ targetTypes: selectedTargets, difficulty }, 60000)
    setStimulusCount({ current: 0, total: stimulusSequence.current.length })

    responseWindow.current = {
      min: 100,
      max: 1200 - difficulty * 600,
    }

    // Show countdown (5s)
    setTrialMode('preparing-triple')
    let count = 5
    setCountdown(count)

    countdownInterval.current = window.setInterval(() => {
      count--
      setCountdown(count)
      if (count === 0) {
        if (countdownInterval.current !== null) {
          clearInterval(countdownInterval.current)
          countdownInterval.current = null
        }
        setTrialMode('ready-triple')
        renderReadyState()
      }
    }, 1000)
  }

  const beginTripleTask = () => {
    trialDuration.current = 60000 // 60s
    trialStartTime.current = performance.now()
    lastUpdateTime.current = performance.now()
    isTrialRunning.current = true
    setTrialMode('triple-task')

    // Start both loops
    motorGameLoop()
    presentNextStimulus()
  }

  // Motor game loop (requestAnimationFrame)
  const motorGameLoop = () => {
    const now = performance.now()
    const elapsed = now - trialStartTime.current
    const dt = (now - lastUpdateTime.current) / 1000
    lastUpdateTime.current = now

    // Check completion
    if (elapsed >= trialDuration.current) {
      stopTrial()
      return
    }

    const mode = trialModeRef.current

    // Update targets
    const target1D = targetGenerator1D.current?.update(1 / 60) || 0
    const target2D = targetGenerator2D.current?.update(1 / 60) || { x: 0, y: 0 }

    // Update cursors
    if (mode === 'baseline-1d' || mode === 'triple-task') {
      updateKeyboard1D(dt)
    }

    if (mode === 'baseline-2d' || mode === 'triple-task') {
      updateMouse2D()
    }

    // Record samples
    if (mode === 'baseline-1d' || mode === 'triple-task') {
      samples1D.current.push({
        timestamp: elapsed,
        targetPosition: target1D,
        cursorPosition: keyboard1DPosition.current,
        inputValue: keyboard1DPosition.current,
      })
    }

    if (mode === 'baseline-2d' || mode === 'triple-task') {
      samples2D.current.push({
        timestamp: elapsed,
        targetPosition: target2D,
        cursorPosition: cursor2DPosition.current,
        inputValue: cursor2DPosition.current,
      })
    }

    // Render
    render(target1D, target2D, elapsed)

    // Continue loop
    animationFrameId.current = requestAnimationFrame(motorGameLoop)
  }

  // Auditory stimulus loop (setTimeout scheduled)
  const presentNextStimulus = () => {
    const now = performance.now()
    const elapsed = now - trialStartTime.current

    // Check completion
    if (
      elapsed >= trialDuration.current ||
      currentStimulusIndex.current >= stimulusSequence.current.length
    ) {
      // If this is audio-only baseline, we need to stop the trial
      const mode = trialModeRef.current
      if (mode === 'baseline-audio') {
        stopTrial()
      }
      return
    }

    const currentStim = stimulusSequence.current[currentStimulusIndex.current]

    // Wait until scheduled time
    const delay = currentStim.timestamp - elapsed
    if (delay > 0) {
      setTimeout(presentNextStimulus, delay)
      return
    }

    // Record previous stimulus if no response
    recordMissedResponse()

    // Play tone
    currentStimulusStart.current = performance.now()
    previousStimulusStart.current = performance.now()
    hasRespondedToCurrentStimulus.current = false
    audioStimulus.current?.playTone(currentStim.type)

    // Visual feedback (200ms)
    setCurrentStimulus(currentStim.type)
    setTimeout(() => setCurrentStimulus(null), 200)

    // Update count
    setStimulusCount({ current: currentStimulusIndex.current + 1, total: stimulusSequence.current.length })

    currentStimulusIndex.current++

    // Schedule next
    if (currentStimulusIndex.current < stimulusSequence.current.length) {
      requestAnimationFrame(presentNextStimulus)
    } else {
      // Sequence complete - if audio-only baseline, stop trial after brief delay
      const mode = trialModeRef.current
      if (mode === 'baseline-audio') {
        setTimeout(() => stopTrial(), 500)
      }
    }
  }

  // Handle spacebar response
  const handleAuditoryResponse = () => {
    if (hasRespondedToCurrentStimulus.current) return
    if (currentStimulusIndex.current === 0) return // No stimulus yet

    const now = performance.now()
    const reactionTime = now - currentStimulusStart.current
    const currentStimIndex = currentStimulusIndex.current - 1

    // Check if response is within window
    if (
      reactionTime < responseWindow.current.min ||
      reactionTime > responseWindow.current.max
    ) {
      return // Outside response window
    }

    hasRespondedToCurrentStimulus.current = true

    const stimulus = stimulusSequence.current[currentStimIndex]
    const isCorrect = stimulus.isTarget

    // Record response
    auditoryResponses.current.push({
      stimulusTimestamp: previousStimulusStart.current - trialStartTime.current,
      responseTimestamp: now - trialStartTime.current,
      isTarget: stimulus.isTarget,
      responded: true,
      reactionTime: reactionTime,
    })

    // Show feedback (500ms)
    if (isCorrect) {
      setFeedbackMessage('✓ Hit')
    } else {
      setFeedbackMessage('✗ False Alarm')
    }
    setTimeout(() => setFeedbackMessage(''), 500)
  }

  // Record missed response for previous stimulus
  const recordMissedResponse = () => {
    if (currentStimulusIndex.current === 0) return
    if (hasRespondedToCurrentStimulus.current) return

    const currentStimIndex = currentStimulusIndex.current - 1
    const stimulus = stimulusSequence.current[currentStimIndex]

    auditoryResponses.current.push({
      stimulusTimestamp: previousStimulusStart.current - trialStartTime.current,
      responseTimestamp: null,
      isTarget: stimulus.isTarget,
      responded: false,
      reactionTime: null,
    })

    // Show feedback for miss (500ms)
    if (stimulus.isTarget) {
      setFeedbackMessage('✗ Miss')
      setTimeout(() => setFeedbackMessage(''), 500)
    }
  }

  // Stop trial
  const stopTrial = async () => {
    const mode = trialModeRef.current

    // Stop motor loop
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current)
      animationFrameId.current = null
    }

    // Disable keyboard response
    isTrialRunning.current = false

    // Record final auditory stimulus if needed
    if (mode === 'baseline-audio' || mode === 'triple-task') {
      recordMissedResponse()
    }

    // Calculate metrics
    if (mode === 'baseline-1d') {
      const metrics1D = calculateTrackingMetrics(samples1D.current)
      setBaselineMetrics1D(metrics1D)

      // Auto-advance to 2D baseline after 1.5s
      setTimeout(() => {
        startBaseline2D()
      }, 1500)
    } else if (mode === 'baseline-2d') {
      const metrics2D = calculateTrackingMetrics2D(samples2D.current)
      setBaselineMetrics2D(metrics2D)

      // Auto-advance to audio baseline after 1.5s
      setTimeout(() => {
        startBaselineAudio()
      }, 1500)
    } else if (mode === 'baseline-audio') {
      const metricsAudio = calculateAttentionMetrics(auditoryResponses.current)
      setBaselineMetricsAudio(metricsAudio)

      // Return to idle (ready for triple-task)
      setTrialMode('idle')
    } else if (mode === 'triple-task') {
      // Calculate all metrics
      const metrics1D = calculateTrackingMetrics(samples1D.current)
      const metrics2D = calculateTrackingMetrics2D(samples2D.current)
      const metricsAudio = calculateAttentionMetrics(auditoryResponses.current)

      // Calculate triple-task metrics
      const tripleTaskMetrics = calculateTripleTaskMetrics({
        metrics1D,
        metrics2D,
        metricsAudio,
        baseline1D: baselineMetrics1D!,
        baseline2D: baselineMetrics2D!,
        baselineAudio: baselineMetricsAudio!,
        samples1D: samples1D.current,
        samples2D: samples2D.current,
        auditoryResponses: auditoryResponses.current,
      })

      // Create events array (merged from all three tasks)
      const events = [
        ...samplesToEvents(samples1D.current).map((e) => ({
          ...e,
          value: { task: '1D', ...e.value },
        })),
        ...samplesToEvents2D(samples2D.current).map((e) => ({
          ...e,
          value: { task: '2D', ...e.value },
        })),
        ...auditoryResponses.current.map((r) => ({
          t: r.stimulusTimestamp,
          type: 'stimulus' as const,
          value: { isTarget: r.isTarget },
        })),
        ...auditoryResponses.current
          .filter((r) => r.responded)
          .map((r) => ({
            t: r.responseTimestamp!,
            type: 'response' as const,
            value: { isTarget: r.isTarget, reactionTime: r.reactionTime },
          })),
      ].sort((a, b) => a.t - b.t)

      // Create trial object
      const trial: Trial = {
        id: crypto.randomUUID(),
        moduleRunId,
        moduleId: 'F',
        difficulty,
        durationMs: 60000,
        startTimestamp: trialStartTime.current,
        events,
        metrics: {
          tracking: metrics1D,
          tracking2D: metrics2D,
          attention: metricsAudio,
          tripleTask: tripleTaskMetrics,
        },
      }

      // Save to database
      await createTrial(trial)

      setTrialMode('idle')

      // Notify parent
      if (onTrialComplete) {
        onTrialComplete(trial)
      }
    }
  }

  // Render ready state (click-to-start)
  const renderReadyState = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const mode = trialModeRef.current

    // Stop animation if no longer in ready state
    if (mode !== 'ready-2d' && mode !== 'ready-triple') {
      return
    }

    // Clear canvas
    ctx.fillStyle = '#0f172a' // slate-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw divider
    ctx.strokeStyle = '#475569' // slate-600
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(leftPanelWidth, 0)
    ctx.lineTo(leftPanelWidth, canvasHeight)
    ctx.stroke()

    // Draw center cursor in RIGHT PANEL (2D tracking area)
    // Center of right panel: 500 + 250 = 750px
    const cursorX = leftPanelWidth + rightPanelWidth / 2
    const cursorY = canvasHeight / 2

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

    // Draw instruction text centered in right panel
    ctx.fillStyle = '#f1f5f9' // slate-100
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Click the green cursor to begin', cursorX, canvasHeight - 20)
    ctx.textAlign = 'left'

    // Request next frame for animation
    requestAnimationFrame(renderReadyState)
  }

  // Render main task
  const render = (target1D: number, target2D: { x: number; y: number }, elapsed: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const mode = trialModeRef.current

    // Clear canvas
    ctx.fillStyle = '#0f172a' // slate-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw divider
    ctx.strokeStyle = '#475569' // slate-600
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(leftPanelWidth, 0)
    ctx.lineTo(leftPanelWidth, canvasHeight)
    ctx.stroke()

    // Render 1D task (left panel)
    if (mode === 'baseline-1d' || mode === 'triple-task') {
      render1DTask(ctx, target1D, keyboard1DPosition.current, 0)
    }

    // Render 2D task (right panel)
    if (mode === 'baseline-2d' || mode === 'triple-task') {
      render2DTask(ctx, target2D, cursor2DPosition.current, leftPanelWidth)
    }

    // Draw timer
    const remaining = Math.max(0, (trialDuration.current - elapsed) / 1000)
    ctx.fillStyle = '#94a3b8' // slate-400
    ctx.font = '16px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`Time: ${remaining.toFixed(1)}s`, canvasWidth / 2, canvasHeight - 10)
    ctx.textAlign = 'left'
  }

  // Render 1D horizontal tracking task
  const render1DTask = (
    ctx: CanvasRenderingContext2D,
    targetPos: number,
    cursorPos: number,
    offsetX: number
  ) => {
    const panelWidth = leftPanelWidth
    const panelHeight = canvasHeight

    // Draw center line
    ctx.strokeStyle = '#334155' // slate-700
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(offsetX, panelHeight / 2)
    ctx.lineTo(offsetX + panelWidth, panelHeight / 2)
    ctx.stroke()

    // Convert normalized position to panel coordinates (with 0.8 margin)
    const targetX = offsetX + panelWidth / 2 + targetPos * (panelWidth / 2) * 0.8
    const cursorX = offsetX + panelWidth / 2 + cursorPos * (panelWidth / 2) * 0.8

    const y = panelHeight / 2

    // Draw target
    ctx.fillStyle = '#3b82f6' // blue-500
    ctx.beginPath()
    ctx.arc(targetX, y, 12, 0, Math.PI * 2)
    ctx.fill()

    // Draw cursor
    ctx.fillStyle = '#10b981' // green-500
    ctx.beginPath()
    ctx.arc(cursorX, y, 10, 0, Math.PI * 2)
    ctx.fill()

    // Draw connecting line (error visualization)
    const error = Math.abs(targetX - cursorX)
    const errorColor = error < 15 ? '#10b981' : error < 30 ? '#f59e0b' : '#ef4444'
    ctx.strokeStyle = errorColor
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(targetX, y)
    ctx.lineTo(cursorX, y)
    ctx.stroke()
    ctx.setLineDash([])

    // Label
    ctx.fillStyle = '#94a3b8'
    ctx.font = '14px sans-serif'
    ctx.fillText('1D Tracking (A/D keys)', offsetX + 10, 30)
  }

  // Render 2D tracking task
  const render2DTask = (
    ctx: CanvasRenderingContext2D,
    targetPos: { x: number; y: number },
    _cursorPos: { x: number; y: number },
    offsetX: number
  ) => {
    const panelWidth = rightPanelWidth
    const panelHeight = canvasHeight

    // Draw crosshairs
    ctx.strokeStyle = '#334155' // slate-700
    ctx.lineWidth = 1
    ctx.beginPath()
    // Vertical
    ctx.moveTo(offsetX + panelWidth / 2, 0)
    ctx.lineTo(offsetX + panelWidth / 2, panelHeight)
    // Horizontal
    ctx.moveTo(offsetX, panelHeight / 2)
    ctx.lineTo(offsetX + panelWidth, panelHeight / 2)
    ctx.stroke()

    // Convert normalized target position to panel coordinates (with 0.8 margin)
    const targetX = offsetX + panelWidth / 2 + targetPos.x * (panelWidth / 2) * 0.8
    const targetY = panelHeight / 2 + targetPos.y * (panelHeight / 2) * 0.8

    // Use pixel-perfect mouse position
    const cursorX = mouseCanvasX.current
    const cursorY = mouseCanvasY.current

    // Draw target
    ctx.fillStyle = '#3b82f6' // blue-500
    ctx.beginPath()
    ctx.arc(targetX, targetY, 12, 0, Math.PI * 2)
    ctx.fill()

    // Draw cursor
    ctx.fillStyle = '#10b981' // green-500
    ctx.beginPath()
    ctx.arc(cursorX, cursorY, 10, 0, Math.PI * 2)
    ctx.fill()

    // Draw connecting line
    const dx = targetX - cursorX
    const dy = targetY - cursorY
    const error = Math.sqrt(dx * dx + dy * dy)
    const errorColor = error < 15 ? '#10b981' : error < 30 ? '#f59e0b' : '#ef4444'
    ctx.strokeStyle = errorColor
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(targetX, targetY)
    ctx.lineTo(cursorX, cursorY)
    ctx.stroke()
    ctx.setLineDash([])

    // Label
    ctx.fillStyle = '#94a3b8'
    ctx.font = '14px sans-serif'
    ctx.fillText('2D Tracking (Mouse)', offsetX + 10, 30)
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2">Module F: Triple-Task (Motor + Auditory)</h2>
        <p className="text-slate-300 mb-4">
          Perform three tasks simultaneously: 1D tracking (A/D keys), 2D tracking (mouse), and
          auditory Go/No-Go (spacebar). Complete baseline trials first.
        </p>

        <div className="flex items-center gap-4 mb-4">
          <div className="text-sm">
            <span className="text-slate-400">Difficulty:</span>{' '}
            <span className="font-mono text-blue-400">{(difficulty * 100).toFixed(0)}%</span>
          </div>
          <div className="text-sm">
            <span className="text-slate-400">Status:</span>{' '}
            <span
              className={`font-mono ${
                trialMode === 'triple-task'
                  ? 'text-green-400'
                  : trialMode.startsWith('baseline')
                    ? 'text-blue-400'
                    : 'text-slate-400'
              }`}
            >
              {trialMode}
            </span>
          </div>
        </div>

        {/* Countdown display */}
        {(trialMode === 'preparing-audio' || trialMode === 'preparing-triple') && (
          <div className="bg-slate-900 rounded-lg p-8 mb-4">
            <p className="text-center text-slate-300 text-lg mb-2">
              Auditory Selective Attention Task
            </p>
            <p className="text-center text-green-400 font-semibold mb-6">
              Press SPACEBAR ONLY for the highlighted tones below:
            </p>

            <div className="flex justify-center gap-4 mb-6">
              {(['high', 'medium', 'low'] as StimulusType[]).map((type) => {
                const isTarget = currentTargetTypes.includes(type)
                return (
                  <div
                    key={type}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-colors ${
                      isTarget
                        ? 'bg-slate-700 border-4 border-yellow-400'
                        : 'bg-slate-800 opacity-50 border-2 border-slate-600'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center">
                      <span className="text-slate-300 text-4xl">♪</span>
                    </div>
                    <span
                      className={`font-semibold uppercase text-sm ${isTarget ? 'text-white' : 'text-slate-500'}`}
                    >
                      {type}
                    </span>
                    {isTarget && (
                      <span className="text-yellow-400 font-bold text-xs">⭐ TARGET</span>
                    )}
                    {!isTarget && <span className="text-slate-500 text-xs">IGNORE</span>}
                  </div>
                )
              })}
            </div>

            <div className="bg-slate-800 rounded-lg p-4 mb-4">
              <p className="text-slate-300 text-sm">
                <span className="text-yellow-400 font-bold">⭐ TARGET tones:</span> Press SPACEBAR
              </p>
              <p className="text-slate-400 text-sm mt-1">
                <span className="text-slate-500 font-bold">IGNORE tones:</span> Do NOT press
                SPACEBAR
              </p>
            </div>

            <div className="text-center text-4xl font-bold text-blue-400 mt-6">
              Starting in {countdown}...
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="bg-slate-900 rounded-lg p-4 inline-block">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className={`border border-slate-700 rounded ${
              trialMode === 'baseline-2d' || trialMode === 'triple-task'
                ? 'cursor-none'
                : 'cursor-pointer'
            }`}
          />
        </div>

        {/* Auditory task feedback (shown during audio baseline and triple-task) */}
        {(trialMode === 'baseline-audio' || trialMode === 'triple-task') && (
          <div className="bg-slate-900 rounded-lg p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-6">
                <div className="bg-slate-800 rounded-lg px-4 py-2">
                  <div className="text-xs text-slate-500 mb-1">TARGET TONES</div>
                  <div className="flex items-center gap-2">
                    {currentTargetTypes.map((type) => (
                      <span
                        key={type}
                        className="px-3 py-1 bg-yellow-400/20 border-2 border-yellow-400 rounded font-bold text-yellow-400 text-sm uppercase"
                      >
                        ⭐ {type}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-sm text-slate-400">
                  Stimuli:{' '}
                  <span className="font-mono text-slate-300">
                    {stimulusCount.current} / {stimulusCount.total}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {currentStimulus && !feedbackMessage && (
                  <div className="w-16 h-16 rounded-full flex items-center justify-center bg-slate-700 border-4 border-blue-400 animate-pulse">
                    <span className="text-slate-300 text-2xl font-bold">♪</span>
                  </div>
                )}
                {feedbackMessage && (
                  <div
                    className={`text-lg font-semibold ${
                      feedbackMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {feedbackMessage}
                  </div>
                )}
                {!currentStimulus && !feedbackMessage && (
                  <div className="text-slate-500 text-sm">Listening...</div>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-500 text-center">
              Press SPACEBAR for target tones only
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={startBaseline}
            disabled={trialMode !== 'idle' || baselineMetrics1D !== null}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-md font-medium transition-colors"
          >
            Start Baseline Trials
          </button>
          <button
            onClick={startTripleTask}
            disabled={
              trialMode !== 'idle' ||
              baselineMetrics1D === null ||
              baselineMetrics2D === null ||
              baselineMetricsAudio === null
            }
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-md font-medium transition-colors"
          >
            Start Triple-Task
          </button>
        </div>

        {/* Baseline status */}
        {(baselineMetrics1D || baselineMetrics2D || baselineMetricsAudio) && (
          <div className="mt-4 bg-slate-900 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Baseline Status</h3>
            <div className="grid grid-cols-3 gap-4">
              <div
                className={`p-3 rounded ${baselineMetrics1D ? 'bg-green-900/30 text-green-400' : 'bg-slate-800 text-slate-500'}`}
              >
                <div className="text-sm">1D Tracking</div>
                <div className="text-lg font-semibold">{baselineMetrics1D ? '✓' : '○'}</div>
              </div>
              <div
                className={`p-3 rounded ${baselineMetrics2D ? 'bg-green-900/30 text-green-400' : 'bg-slate-800 text-slate-500'}`}
              >
                <div className="text-sm">2D Tracking</div>
                <div className="text-lg font-semibold">{baselineMetrics2D ? '✓' : '○'}</div>
              </div>
              <div
                className={`p-3 rounded ${baselineMetricsAudio ? 'bg-green-900/30 text-green-400' : 'bg-slate-800 text-slate-500'}`}
              >
                <div className="text-sm">Auditory</div>
                <div className="text-lg font-semibold">{baselineMetricsAudio ? '✓' : '○'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
