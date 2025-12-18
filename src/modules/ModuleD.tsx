import { useState, useRef, useEffect } from 'react'
import {
  generateSpatialTask,
  transformShape,
  TETRIS_SHAPES,
  type SpatialTask,
  type MentalRotationStimulus,
  type MentalRotationOption,
  type Point2D,
} from '@/utils/spatialTasks'
import {
  calculateSpatialMetrics,
  responsesToEvents,
  type SpatialResponse,
} from '@/utils/spatialMetrics'
import type { Trial, SpatialMetrics } from '@/types'
import { createTrial } from '@/lib/db'

interface ModuleDProps {
  moduleRunId: string
  difficulty: number
  onTrialComplete?: (trial: Trial) => void
}

type TrialState = 'idle' | 'running' | 'completed'

export function ModuleD({ moduleRunId, difficulty, onTrialComplete }: ModuleDProps) {
  const [trialState, setTrialState] = useState<TrialState>('idle')
  const [currentMetrics, setCurrentMetrics] = useState<SpatialMetrics | null>(null)
  const [tasksPerTrial] = useState(15) // 15 tasks per trial
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [currentTask, setCurrentTask] = useState<SpatialTask | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)

  // Refs for trial data
  const trialStartTime = useRef<number>(0)
  const taskStartTime = useRef<number>(0)
  const responses = useRef<SpatialResponse[]>([])

  // Set task timer AFTER the task is rendered and visible to the user
  useEffect(() => {
    if (trialState === 'running' && currentTask && selectedAnswer === null && !showFeedback) {
      // Use requestAnimationFrame to ensure timer starts AFTER browser paints the new task
      requestAnimationFrame(() => {
        taskStartTime.current = performance.now()
      })
    }
  }, [currentTask, currentTaskIndex, trialState, selectedAnswer, showFeedback])

  const startTrial = () => {
    // Reset state
    responses.current = []
    setCurrentTaskIndex(0)
    setCurrentMetrics(null)
    trialStartTime.current = performance.now()

    // Generate first task
    const task = generateSpatialTask('mental-rotation', difficulty)
    setCurrentTask(task)
    setSelectedAnswer(null)
    setShowFeedback(false)
    setTrialState('running')
    // Timer will be set by useEffect after task is rendered
  }

  const handleAnswerSelect = (answerIndex: number) => {
    if (!currentTask || selectedAnswer !== null) return

    setSelectedAnswer(answerIndex)

    const reactionTime = performance.now() - taskStartTime.current
    const isCorrect = answerIndex === currentTask.correctAnswer

    // Record response
    responses.current.push({
      taskIndex: currentTaskIndex,
      selectedAnswer: answerIndex,
      correctAnswer: currentTask.correctAnswer,
      reactionTime,
      isCorrect,
    })

    // Show feedback
    setShowFeedback(true)

    // Move to next task after delay
    setTimeout(() => {
      const nextIndex = currentTaskIndex + 1
      if (nextIndex >= tasksPerTrial) {
        endTrial()
      } else {
        setCurrentTaskIndex(nextIndex)
        const task = generateSpatialTask('mental-rotation', difficulty)
        setCurrentTask(task)
        setSelectedAnswer(null)
        setShowFeedback(false)
        // Timer will be set by useEffect after task is rendered
      }
    }, 1000)
  }

  const endTrial = async () => {
    // Calculate metrics
    const metrics = calculateSpatialMetrics(responses.current)
    setCurrentMetrics(metrics)

    // Create trial object
    const trial: Trial = {
      id: crypto.randomUUID(),
      moduleRunId,
      moduleId: 'D',
      difficulty,
      durationMs: performance.now() - trialStartTime.current,
      startTimestamp: trialStartTime.current,
      events: responsesToEvents(responses.current),
      metrics: {
        spatial: metrics,
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

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2">Module D: Mental Rotation</h2>
        <p className="text-slate-300 mb-4">
          Find the shape that matches the reference (rotated 90°, 180°, or 270° - not mirrored).
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

        {/* Task Display */}
        <div className="bg-slate-900 rounded-lg p-8 mb-4 min-h-[550px] flex flex-col items-center justify-center">
          {trialState === 'idle' && (
            <div className="text-center">
              <p className="text-slate-400 text-lg mb-4">Click "Start Trial" to begin.</p>
              <p className="text-slate-500 text-sm">
                You'll be presented with {tasksPerTrial} spatial reasoning tasks.
              </p>
            </div>
          )}

          {trialState === 'running' && currentTask && (
            <div className="w-full max-w-4xl">
              <div className="mb-6 text-center">
                <span className="text-slate-400">
                  Task {currentTaskIndex + 1} of {tasksPerTrial}
                </span>
              </div>

              <MentalRotationDisplay
                task={currentTask}
                selectedAnswer={selectedAnswer}
                showFeedback={showFeedback}
                onAnswerSelect={handleAnswerSelect}
              />
            </div>
          )}

          {trialState === 'completed' && (
            <div className="text-center">
              <div className="text-green-400 text-2xl font-bold mb-2">Trial Complete!</div>
              <p className="text-slate-400">View your results below</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <button
            onClick={startTrial}
            disabled={trialState === 'running'}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-md font-medium transition-colors"
          >
            Start Trial
          </button>
        </div>
      </div>

      {/* Metrics Display */}
      {currentMetrics && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Trial Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Accuracy</div>
              <div className="text-2xl font-mono text-blue-400">
                {(currentMetrics.accuracy * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Mean Reaction Time</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.reactionTime.toFixed(0)}ms
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Speed-Accuracy Score</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.speedAccuracyTradeoff.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-1">(higher is better)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Mental Rotation Task Display
function MentalRotationDisplay({
  task,
  selectedAnswer,
  showFeedback,
  onAnswerSelect,
}: {
  task: SpatialTask
  selectedAnswer: number | null
  showFeedback: boolean
  onAnswerSelect: (index: number) => void
}) {
  const stimulus = task.stimulus as MentalRotationStimulus
  const options = task.options as MentalRotationOption[]

  // Transform reference shape
  const referencePoints = transformShape(stimulus.shapePoints, stimulus.referenceRotation, false)

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4 text-center text-slate-200">
        Which shape is the same as the reference?
      </h3>
      <p className="text-sm text-slate-400 text-center mb-6">
        (Any rotation is OK - but not mirrored)
      </p>

      {/* Reference Shape */}
      <div className="mb-8">
        <div className="text-slate-400 text-sm mb-2 text-center">Reference:</div>
        <div className="flex justify-center">
          <div className="bg-slate-800 rounded-lg p-4 border-2 border-blue-500">
            <ShapeRenderer points={referencePoints} size={120} color="#3b82f6" />
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="text-slate-400 text-sm mb-2 text-center">Select the matching shape:</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {options.map((option, index) => {
          const optionPoints = transformShape(
            TETRIS_SHAPES[option.shapeIndex],
            option.rotation,
            option.isMirrored
          )
          const isSelected = selectedAnswer === index
          const isCorrect = index === task.correctAnswer
          const showCorrectHighlight = showFeedback && isCorrect
          const showIncorrectHighlight = showFeedback && isSelected && !isCorrect

          return (
            <button
              key={index}
              onClick={() => onAnswerSelect(index)}
              disabled={selectedAnswer !== null}
              className={`p-4 rounded-lg border-2 transition-all ${
                showCorrectHighlight
                  ? 'border-green-500 bg-green-900/30'
                  : showIncorrectHighlight
                    ? 'border-red-500 bg-red-900/30'
                    : isSelected
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-slate-600 hover:border-slate-500 bg-slate-800'
              } ${selectedAnswer !== null ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-750'}`}
            >
              <div className="flex justify-center">
                <ShapeRenderer
                  points={optionPoints}
                  size={100}
                  color={showCorrectHighlight ? '#22c55e' : showIncorrectHighlight ? '#ef4444' : '#94a3b8'}
                />
              </div>
              <div className="text-center mt-2 text-sm text-slate-500">Option {index + 1}</div>
              {showFeedback && isCorrect && (
                <div className="text-green-400 text-sm mt-1 text-center font-semibold">✓ Correct</div>
              )}
              {showFeedback && isSelected && !isCorrect && (
                <div className="text-red-400 text-sm mt-1 text-center font-semibold">✗ Incorrect</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// SVG Shape Renderer
function ShapeRenderer({
  points,
  size,
  color,
}: {
  points: Point2D[]
  size: number
  color: string
}) {
  if (points.length === 0) return null

  // Find bounds
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const range = Math.max(rangeX, rangeY)

  const padding = 10
  const scale = (size - 2 * padding) / range

  // Center the shape
  const offsetX = (size - rangeX * scale) / 2 - minX * scale
  const offsetY = (size - rangeY * scale) / 2 - minY * scale

  // Create path
  const pathData = points
    .map((p, i) => {
      const x = p.x * scale + offsetX
      const y = size - (p.y * scale + offsetY) // Flip Y for SVG coordinates
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ') + ' Z'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={pathData} fill={color} stroke={color} strokeWidth="2" />
    </svg>
  )
}

