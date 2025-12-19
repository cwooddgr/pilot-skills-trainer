import { useState, useEffect } from 'react'
import { ModuleA } from '@/modules/ModuleA'
import { ModuleB } from '@/modules/ModuleB'
import { ModuleC } from '@/modules/ModuleC'
import { ModuleD } from '@/modules/ModuleD'
import { ModuleE } from '@/modules/ModuleE'
import type { Session, ModuleRun, Trial, UserProfile, HardwareProfile } from '@/types'
import {
  createSession,
  createModuleRun,
  updateModuleRun,
  updateSession,
  createUserProfile,
  createHardwareProfile,
  getAllUserProfiles,
} from '@/lib/db'

export function TrainingPage() {
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [activeModuleRun, setActiveModuleRun] = useState<ModuleRun | null>(null)
  const [currentDifficulty, setCurrentDifficulty] = useState(0.3)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Initialize user profile on mount
  useEffect(() => {
    async function initializeProfile() {
      const profiles = await getAllUserProfiles()

      if (profiles.length === 0) {
        // Create default profile
        const hwProfile: HardwareProfile = {
          id: crypto.randomUUID(),
          devices: [],
          lastCalibrated: Date.now(),
        }
        await createHardwareProfile(hwProfile)

        const profile: UserProfile = {
          id: crypto.randomUUID(),
          hardwareProfileId: hwProfile.id,
          settings: {
            targetSuccessBand: [0.7, 0.85],
          },
          createdAt: Date.now(),
          lastActive: Date.now(),
        }
        await createUserProfile(profile)
        setUserProfile(profile)
      } else {
        setUserProfile(profiles[0])
      }

      setIsInitializing(false)
    }

    initializeProfile()
  }, [])

  const startModuleA = async () => {
    if (!userProfile) return

    // Create new session if needed
    let session = activeSession
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        userProfileId: userProfile.id,
        timestamp: Date.now(),
        moduleRuns: [],
      }
      await createSession(session)
      setActiveSession(session)
    }

    // Create module run
    const moduleRun: ModuleRun = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      moduleId: 'A',
      variant: 'adaptive',
      startTimestamp: Date.now(),
      trials: [],
    }
    await createModuleRun(moduleRun)
    setActiveModuleRun(moduleRun)
  }

  const startModuleB = async () => {
    if (!userProfile) return

    // Create new session if needed
    let session = activeSession
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        userProfileId: userProfile.id,
        timestamp: Date.now(),
        moduleRuns: [],
      }
      await createSession(session)
      setActiveSession(session)
    }

    // Create module run
    const moduleRun: ModuleRun = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      moduleId: 'B',
      variant: 'adaptive',
      startTimestamp: Date.now(),
      trials: [],
    }
    await createModuleRun(moduleRun)
    setActiveModuleRun(moduleRun)
  }

  const startModuleC = async () => {
    if (!userProfile) return

    // Create new session if needed
    let session = activeSession
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        userProfileId: userProfile.id,
        timestamp: Date.now(),
        moduleRuns: [],
      }
      await createSession(session)
      setActiveSession(session)
    }

    // Create module run
    const moduleRun: ModuleRun = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      moduleId: 'C',
      variant: 'adaptive',
      startTimestamp: Date.now(),
      trials: [],
    }
    await createModuleRun(moduleRun)
    setActiveModuleRun(moduleRun)
  }

  const startModuleD = async () => {
    if (!userProfile) return

    // Create new session if needed
    let session = activeSession
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        userProfileId: userProfile.id,
        timestamp: Date.now(),
        moduleRuns: [],
      }
      await createSession(session)
      setActiveSession(session)
    }

    // Create module run
    const moduleRun: ModuleRun = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      moduleId: 'D',
      variant: 'adaptive',
      startTimestamp: Date.now(),
      trials: [],
    }
    await createModuleRun(moduleRun)
    setActiveModuleRun(moduleRun)
  }

  const startModuleE = async () => {
    if (!userProfile) return

    // Create new session if needed
    let session = activeSession
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        userProfileId: userProfile.id,
        timestamp: Date.now(),
        moduleRuns: [],
      }
      await createSession(session)
      setActiveSession(session)
    }

    // Create module run
    const moduleRun: ModuleRun = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      moduleId: 'E',
      variant: 'dual-task',
      startTimestamp: Date.now(),
      trials: [],
    }
    await createModuleRun(moduleRun)
    setActiveModuleRun(moduleRun)
  }

  const handleTrialComplete = async (trial: Trial) => {
    if (!activeModuleRun || !activeSession) return

    // Update module run with new trial
    const updatedModuleRun: ModuleRun = {
      ...activeModuleRun,
      trials: [...activeModuleRun.trials, trial],
    }
    await updateModuleRun(updatedModuleRun)
    setActiveModuleRun(updatedModuleRun)

    // Adaptive difficulty adjustment
    adjustDifficulty(trial)
  }

  const adjustDifficulty = (trial: Trial) => {
    let success = false

    // Tracking modules (A, B)
    if (trial.metrics.tracking) {
      const rmse = trial.metrics.tracking.rmse
      // Simple adaptive algorithm: lower RMSE = higher success
      // Threshold inversely related to difficulty
      const threshold = 0.3 / (1 + currentDifficulty)
      success = rmse < threshold
    }
    // Spatial module (D)
    else if (trial.metrics.spatial) {
      const accuracy = trial.metrics.spatial.accuracy
      // Target accuracy band: 70-85%
      success = accuracy > 0.85
      const struggling = accuracy < 0.70

      let newDifficulty = currentDifficulty
      if (success) {
        newDifficulty = Math.min(1.0, currentDifficulty + 0.05)
      } else if (struggling) {
        newDifficulty = Math.max(0.1, currentDifficulty - 0.05)
      }
      setCurrentDifficulty(newDifficulty)
      return
    }
    // Other modules don't adjust difficulty yet
    else {
      return
    }

    let newDifficulty = currentDifficulty

    if (success) {
      // Increase difficulty if performing well
      newDifficulty = Math.min(1.0, currentDifficulty + 0.05)
    } else {
      // Decrease difficulty if struggling
      newDifficulty = Math.max(0.1, currentDifficulty - 0.05)
    }

    setCurrentDifficulty(newDifficulty)
  }

  const endSession = async () => {
    if (!activeSession) return

    const updatedSession: Session = {
      ...activeSession,
      endTimestamp: Date.now(),
    }
    await updateSession(updatedSession)

    setActiveSession(null)
    setActiveModuleRun(null)
  }

  if (isInitializing) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-800 rounded-lg p-6">
          <p className="text-slate-300">Initializing training system...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Training Modules</h1>
        <p className="text-slate-400">
          Select a module to begin training. Difficulty adapts automatically based on your
          performance.
        </p>
      </div>

      {/* Session Status */}
      <div className="bg-slate-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-slate-400">Session Status:</span>{' '}
            <span className={`font-semibold ${activeSession ? 'text-green-400' : 'text-slate-500'}`}>
              {activeSession ? 'Active' : 'No active session'}
            </span>
            {activeModuleRun && (
              <>
                {' '}
                <span className="text-slate-400">|</span>{' '}
                <span className="text-blue-400">
                  Module {activeModuleRun.moduleId} - {activeModuleRun.trials.length} trials
                  completed
                </span>
              </>
            )}
          </div>
          {activeSession && (
            <button
              onClick={endSession}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium transition-colors"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Module Selection */}
      {!activeModuleRun && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={startModuleA}
            className="bg-slate-800 hover:bg-slate-700 rounded-lg p-6 text-left transition-colors border border-slate-700 hover:border-blue-500"
          >
            <h3 className="text-xl font-semibold mb-2 text-blue-400">Module A</h3>
            <p className="text-slate-300 text-sm mb-3">1D Pursuit Tracking</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
                Motor Control
              </span>
              <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
                Continuous Tracking
              </span>
            </div>
          </button>

          <button
            onClick={startModuleB}
            className="bg-slate-800 hover:bg-slate-700 rounded-lg p-6 text-left transition-colors border border-slate-700 hover:border-blue-500"
          >
            <h3 className="text-xl font-semibold mb-2 text-blue-400">Module B</h3>
            <p className="text-slate-300 text-sm mb-3">2D Pursuit Tracking</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
                Motor Control
              </span>
              <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
                2D Tracking
              </span>
            </div>
          </button>

          <button
            onClick={startModuleC}
            className="bg-slate-800 hover:bg-slate-700 rounded-lg p-6 text-left transition-colors border border-slate-700 hover:border-blue-500"
          >
            <h3 className="text-xl font-semibold mb-2 text-blue-400">Module C</h3>
            <p className="text-slate-300 text-sm mb-3">Auditory Selective Attention</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
                Auditory
              </span>
              <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
                Go/No-Go
              </span>
            </div>
          </button>

          <button
            onClick={startModuleD}
            className="bg-slate-800 hover:bg-slate-700 rounded-lg p-6 text-left transition-colors border border-slate-700 hover:border-blue-500"
          >
            <h3 className="text-xl font-semibold mb-2 text-blue-400">Module D</h3>
            <p className="text-slate-300 text-sm mb-3">Mental Rotation</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
                Spatial Reasoning
              </span>
              <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
                Shape Matching
              </span>
            </div>
          </button>

          <button
            onClick={startModuleE}
            className="bg-slate-800 hover:bg-slate-700 rounded-lg p-6 text-left transition-colors border border-slate-700 hover:border-blue-500"
          >
            <h3 className="text-xl font-semibold mb-2 text-blue-400">Module E</h3>
            <p className="text-slate-300 text-sm mb-3">Dual-Task Motor Control</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
                Multitasking
              </span>
              <span className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400">
                Motor Control
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Active Module */}
      {activeModuleRun && activeModuleRun.moduleId === 'A' && (
        <ModuleA
          moduleRunId={activeModuleRun.id}
          difficulty={currentDifficulty}
          onTrialComplete={handleTrialComplete}
        />
      )}

      {activeModuleRun && activeModuleRun.moduleId === 'B' && (
        <ModuleB
          moduleRunId={activeModuleRun.id}
          difficulty={currentDifficulty}
          onTrialComplete={handleTrialComplete}
        />
      )}

      {activeModuleRun && activeModuleRun.moduleId === 'C' && (
        <ModuleC
          moduleRunId={activeModuleRun.id}
          difficulty={currentDifficulty}
          onTrialComplete={handleTrialComplete}
        />
      )}

      {activeModuleRun && activeModuleRun.moduleId === 'D' && (
        <ModuleD
          moduleRunId={activeModuleRun.id}
          difficulty={currentDifficulty}
          onTrialComplete={handleTrialComplete}
        />
      )}

      {activeModuleRun && activeModuleRun.moduleId === 'E' && (
        <ModuleE
          moduleRunId={activeModuleRun.id}
          difficulty={currentDifficulty}
          onTrialComplete={handleTrialComplete}
        />
      )}

      {/* Help Text */}
      {!activeModuleRun && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-3">Getting Started</h3>
          <ul className="space-y-2 text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span>
                Select a training module above to begin. Each module targets specific
                aviation-relevant skills.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span>
                Difficulty automatically adapts to maintain a 70-85% success rate, optimizing skill
                development.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span>
                All performance data is stored locally in your browser. Visit the Analytics page to
                review your progress.
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
