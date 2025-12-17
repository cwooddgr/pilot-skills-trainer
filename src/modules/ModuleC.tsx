import { useEffect, useRef, useState } from 'react'
import {
  AudioStimulus,
  generateStimulusSequence,
  getResponseWindow,
  StimulusEvent,
  StimulusType,
} from '@/utils/audioStimulus'
import {
  calculateAttentionMetrics,
  responsesToEvents,
  AttentionResponse,
} from '@/utils/attentionMetrics'
import type { Trial, AttentionMetrics } from '@/types'
import { createTrial } from '@/lib/db'

interface ModuleCProps {
  moduleRunId: string
  difficulty: number
  onTrialComplete?: (trial: Trial) => void
}

type TrialState = 'idle' | 'preparing' | 'running' | 'completed'

export function ModuleC({ moduleRunId, difficulty, onTrialComplete }: ModuleCProps) {
  const [trialState, setTrialState] = useState<TrialState>('idle')
  const [currentMetrics, setCurrentMetrics] = useState<AttentionMetrics | null>(null)
  const [trialDuration] = useState(60000) // 60 seconds per trial
  const [currentStimulus, setCurrentStimulus] = useState<StimulusType | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string>('')
  const [targetTypes, setTargetTypes] = useState<StimulusType[]>([])
  const [countdown, setCountdown] = useState<number>(0)

  // Game state refs
  const audioStimulus = useRef<AudioStimulus | null>(null)
  const stimulusSequence = useRef<StimulusEvent[]>([])
  const responses = useRef<AttentionResponse[]>([])
  const trialStartTime = useRef<number>(0)
  const currentStimulusIndex = useRef<number>(0)
  const currentStimulusStart = useRef<number>(0)
  const previousStimulusStart = useRef<number>(0)
  const responseWindow = useRef<{ min: number; max: number }>({ min: 100, max: 1000 })
  const hasResponded = useRef<boolean>(false)
  const animationFrameId = useRef<number | null>(null)
  const isTrialRunning = useRef<boolean>(false) // Ref for keyboard handler

  useEffect(() => {
    // Initialize audio system
    audioStimulus.current = new AudioStimulus()

    // Keyboard listener for responses (spacebar)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      if (audioStimulus.current) {
        audioStimulus.current.destroy()
      }
      window.removeEventListener('keydown', handleKeyDown)
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && isTrialRunning.current) {
      e.preventDefault()
      handleResponse()
    }
  }

  const handleResponse = () => {
    console.log('Spacebar pressed!')

    if (hasResponded.current) {
      console.log('Already responded to this stimulus, ignoring')
      return
    }

    const now = performance.now()
    const reactionTime = now - currentStimulusStart.current

    // Find which stimulus this response is for
    // It's the one that was most recently presented
    const stimulusIndex = currentStimulusIndex.current - 1
    console.log('Response for stimulus index:', stimulusIndex, 'RT:', reactionTime)

    if (stimulusIndex < 0 || stimulusIndex >= stimulusSequence.current.length) {
      console.log('Invalid stimulus index, ignoring')
      return
    }

    const currentStim = stimulusSequence.current[stimulusIndex]
    console.log('Stimulus:', currentStim.type, 'isTarget:', currentStim.isTarget)

    // Check if response is within valid window
    console.log('Response window:', responseWindow.current, 'RT:', reactionTime)
    if (reactionTime >= responseWindow.current.min && reactionTime <= responseWindow.current.max) {
      console.log('Response VALID - recording')
      // Valid response - record it
      responses.current.push({
        stimulusTimestamp: currentStim.timestamp,
        responseTimestamp: now - trialStartTime.current,
        isTarget: currentStim.isTarget,
        responded: true,
        reactionTime,
      })

      // Visual feedback
      if (currentStim.isTarget) {
        setFeedbackMessage('✓ Hit')
      } else {
        setFeedbackMessage('✗ False Alarm')
      }

      hasResponded.current = true
    } else {
      console.log('Response OUTSIDE WINDOW - ignoring')
    }
  }

  const prepareTrial = async () => {
    if (!audioStimulus.current) return

    // Resume audio context (required for user interaction)
    await audioStimulus.current.resume()

    // Randomize target types for this block
    const allTypes: StimulusType[] = ['high', 'low', 'medium']
    const numTargetTypes = 1 + Math.floor(Math.random() * 2) // 1 or 2 target types
    const selectedTargets: StimulusType[] = []
    for (let i = 0; i < numTargetTypes; i++) {
      const availableTypes = allTypes.filter((t) => !selectedTargets.includes(t))
      const selected = availableTypes[Math.floor(Math.random() * availableTypes.length)]
      selectedTargets.push(selected)
    }

    setTargetTypes(selectedTargets)
    setTrialState('preparing')
    setCountdown(5)

    // Start countdown
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          beginTrial(selectedTargets)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const beginTrial = (selectedTargets: StimulusType[]) => {
    // Reset state
    responses.current = []
    currentStimulusIndex.current = 0
    hasResponded.current = false
    previousStimulusStart.current = 0
    setFeedbackMessage('')
    setCurrentStimulus(null)

    // Generate stimulus sequence
    stimulusSequence.current = generateStimulusSequence(
      { targetTypes: selectedTargets, difficulty },
      trialDuration
    )

    // Get response window for this difficulty
    responseWindow.current = getResponseWindow(difficulty)

    // Start trial
    trialStartTime.current = performance.now()
    isTrialRunning.current = true // Enable keyboard responses
    setTrialState('running')

    console.log('Trial started - keyboard responses enabled')

    // Start presenting stimuli
    presentNextStimulus()
  }

  const playExampleTone = async (type: StimulusType) => {
    if (audioStimulus.current) {
      await audioStimulus.current.playTone(type)
    }
  }

  const presentNextStimulus = async () => {
    const now = performance.now()
    const elapsed = now - trialStartTime.current

    // Check if trial is complete
    if (elapsed >= trialDuration || currentStimulusIndex.current >= stimulusSequence.current.length) {
      stopTrial()
      return
    }

    const currentStim = stimulusSequence.current[currentStimulusIndex.current]

    // Wait until it's time for this stimulus
    const delay = currentStim.timestamp - elapsed
    if (delay > 0) {
      setTimeout(presentNextStimulus, delay)
      return
    }

    // Record if previous stimulus had no response AND response window has closed
    if (currentStimulusIndex.current > 0 && !hasResponded.current) {
      const timeSinceLastStimulus = now - previousStimulusStart.current
      console.log('Checking previous stimulus - time since:', timeSinceLastStimulus, 'window max:', responseWindow.current.max, 'hasResponded:', hasResponded.current)

      // Only record "no response" if the response window has closed
      if (timeSinceLastStimulus > responseWindow.current.max) {
        const prevStim = stimulusSequence.current[currentStimulusIndex.current - 1]
        console.log('Recording NO RESPONSE for previous stimulus', currentStimulusIndex.current - 1, 'isTarget:', prevStim.isTarget)
        responses.current.push({
          stimulusTimestamp: prevStim.timestamp,
          responseTimestamp: null,
          isTarget: prevStim.isTarget,
          responded: false,
          reactionTime: null,
        })

        // Show feedback for miss
        if (prevStim.isTarget) {
          setFeedbackMessage('✗ Miss')
        }
      } else {
        console.log('Response window still open for previous stimulus')
      }
    }

    // Save current stimulus start time as previous for next iteration
    previousStimulusStart.current = performance.now()

    console.log('Presenting stimulus', currentStimulusIndex.current, '- type:', currentStim.type, 'isTarget:', currentStim.isTarget)

    // Present stimulus
    currentStimulusStart.current = performance.now()
    hasResponded.current = false

    // Play tone
    if (audioStimulus.current) {
      audioStimulus.current.playTone(currentStim.type)
    }

    // Visual feedback
    setCurrentStimulus(currentStim.type)
    setTimeout(() => setCurrentStimulus(null), 200) // Flash for 200ms

    // Move to next stimulus
    currentStimulusIndex.current++

    // Check if this was the last stimulus
    if (currentStimulusIndex.current >= stimulusSequence.current.length) {
      // This was the last stimulus - wait for response window to close before ending trial
      console.log('Final stimulus presented - waiting for response window to close')
      setTimeout(() => {
        stopTrial()
      }, responseWindow.current.max + 100) // Wait for response window + small buffer
    } else {
      // Schedule next stimulus check
      animationFrameId.current = requestAnimationFrame(presentNextStimulus)
    }
  }

  const stopTrial = async () => {
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current)
      animationFrameId.current = null
    }

    console.log('Stopping trial - checking final stimulus')

    // Record final stimulus if it didn't get a response
    const lastPresentedIndex = currentStimulusIndex.current - 1
    if (lastPresentedIndex >= 0 && !hasResponded.current) {
      console.log('Final stimulus had no response - recording as miss/correct rejection')
      const lastStim = stimulusSequence.current[lastPresentedIndex]
      responses.current.push({
        stimulusTimestamp: lastStim.timestamp,
        responseTimestamp: null,
        isTarget: lastStim.isTarget,
        responded: false,
        reactionTime: null,
      })
    } else if (lastPresentedIndex >= 0) {
      console.log('Final stimulus already has response recorded')
    }

    // Calculate final metrics
    console.log('Trial ended. Total responses recorded:', responses.current.length)
    console.log('Responses:', responses.current)
    const metrics = calculateAttentionMetrics(responses.current)
    console.log('Metrics:', metrics)
    setCurrentMetrics(metrics)

    // Create trial object
    const trial: Trial = {
      id: crypto.randomUUID(),
      moduleRunId,
      moduleId: 'C',
      difficulty,
      durationMs: trialDuration,
      startTimestamp: trialStartTime.current,
      events: responsesToEvents(responses.current),
      metrics: {
        attention: metrics,
      },
    }

    // Save to database
    await createTrial(trial)

    isTrialRunning.current = false // Disable keyboard responses
    setTrialState('completed')
    setFeedbackMessage('')

    console.log('Trial stopped - keyboard responses disabled')

    // Notify parent
    if (onTrialComplete) {
      onTrialComplete(trial)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2">Module C: Auditory Selective Attention</h2>
        <p className="text-slate-300 mb-4">
          Listen for target tones and press SPACEBAR when you hear them. Do NOT press for non-target tones.
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

        {/* Visual Feedback */}
        <div className="bg-slate-900 rounded-lg p-8 mb-4 min-h-[300px] flex flex-col items-center justify-center">
          {trialState === 'idle' && (
            <div className="text-center">
              <p className="text-slate-400 text-lg mb-4">
                Click "Start Trial" to begin. You will hear different tones.
              </p>
              <p className="text-slate-500 text-sm">
                Press SPACEBAR only when you hear a target tone.
              </p>
            </div>
          )}

          {trialState === 'preparing' && (
            <div className="text-center w-full max-w-2xl">
              <h3 className="text-2xl font-bold text-blue-400 mb-3">Target Tones for This Trial</h3>
              <p className="text-slate-300 mb-2">
                You will hear <strong>ALL THREE</strong> tone types during the trial.
              </p>
              <p className="text-green-400 font-semibold mb-6">
                Press SPACEBAR ONLY for the highlighted tones below:
              </p>

              <div className="flex justify-center gap-4 mb-6">
                {(['high', 'medium', 'low'] as StimulusType[]).map((type) => {
                  const isTarget = targetTypes.includes(type)
                  return (
                    <button
                      key={type}
                      onClick={() => playExampleTone(type)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-colors ${
                        isTarget
                          ? 'bg-slate-700 hover:bg-slate-600 border-4 border-yellow-400'
                          : 'bg-slate-800 hover:bg-slate-750 opacity-50 border-2 border-slate-600'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center">
                        <span className="text-slate-300 text-4xl">♪</span>
                      </div>
                      <span className={`font-semibold uppercase text-sm ${isTarget ? 'text-white' : 'text-slate-500'}`}>
                        {type}
                      </span>
                      {isTarget && (
                        <span className="text-yellow-400 font-bold text-xs">⭐ TARGET</span>
                      )}
                      {!isTarget && (
                        <span className="text-slate-500 text-xs">IGNORE</span>
                      )}
                      <span className={`text-xs ${isTarget ? 'text-slate-300' : 'text-slate-600'}`}>
                        Click to hear
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="bg-slate-800 rounded-lg p-4 mb-4">
                <p className="text-slate-300 text-sm">
                  <span className="text-yellow-400 font-bold">⭐ TARGET tones:</span> Press SPACEBAR
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  <span className="text-slate-500 font-bold">IGNORE tones:</span> Do NOT press SPACEBAR
                </p>
              </div>

              <div className="text-4xl font-bold text-blue-400 mt-6">
                Starting in {countdown}...
              </div>
            </div>
          )}

          {trialState === 'running' && (
            <>
              {currentStimulus && !feedbackMessage && (
                <div className="mb-4">
                  {/* Neutral visual indicator - same for all stimulus types */}
                  <div className="w-32 h-32 rounded-full flex items-center justify-center bg-slate-700 border-4 border-blue-400 animate-pulse">
                    <span className="text-slate-300 text-4xl font-bold">♪</span>
                  </div>
                </div>
              )}

              {feedbackMessage && (
                <div
                  className={`text-2xl font-bold ${
                    feedbackMessage.includes('✓') ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {feedbackMessage}
                </div>
              )}

              {!currentStimulus && !feedbackMessage && (
                <div className="text-slate-500 text-lg">Listening...</div>
              )}

              <div className="mt-4 text-slate-400 text-sm">
                Stimuli: {currentStimulusIndex.current} / {stimulusSequence.current.length}
              </div>
            </>
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
            onClick={prepareTrial}
            disabled={trialState === 'running' || trialState === 'preparing'}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-md font-medium transition-colors"
          >
            {trialState === 'preparing' ? 'Preparing...' : 'Start Trial'}
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
              <div className="text-slate-400 text-sm">Hit Rate</div>
              <div className="text-2xl font-mono text-blue-400">
                {(currentMetrics.hitRate * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">False Alarm Rate</div>
              <div className="text-2xl font-mono text-blue-400">
                {(currentMetrics.falseAlarmRate * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">d-prime (d′)</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.dPrime.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-1">(higher is better)</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Mean Reaction Time</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.meanRT.toFixed(0)}ms
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Median Reaction Time</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.medianRT.toFixed(0)}ms
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Total Responses</div>
              <div className="text-2xl font-mono text-blue-400">
                {currentMetrics.reactionTimes.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
