import { useState, useEffect } from 'react'
import { getAllSessions, getAllUserProfiles, getAllTrials, getAllModuleRuns } from '@/lib/db'
import type { Session, ModuleId, Trial, ModuleRun } from '@/types'
import { LineChart } from '@/components/charts/LineChart'

interface ModuleStats {
  moduleId: ModuleId
  trialCount: number
  avgDifficulty: number
  recentMetrics?: {
    tracking?: { rmse: number; timeOnTarget: number }
    attention?: { dPrime: number; hitRate: number }
    spatial?: { accuracy: number; reactionTime: number }
  }
}

export function AnalyticsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [moduleStats, setModuleStats] = useState<Map<ModuleId, ModuleStats>>(new Map())
  const [trialsByModule, setTrialsByModule] = useState<Map<ModuleId, Trial[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAnalyticsData()
  }, [])

  const loadAnalyticsData = async () => {
    setIsLoading(true)
    try {
      const profiles = await getAllUserProfiles()
      if (profiles.length === 0) {
        setIsLoading(false)
        return
      }

      // Fetch all data separately
      const allSessions = await getAllSessions()
      const allModuleRuns = await getAllModuleRuns()
      const allTrials = await getAllTrials()

      // Build map of moduleRunId -> trials
      const trialsByModuleRun = new Map<string, Trial[]>()
      allTrials.forEach(trial => {
        const existing = trialsByModuleRun.get(trial.moduleRunId) || []
        existing.push(trial)
        trialsByModuleRun.set(trial.moduleRunId, existing)
      })

      // Build map of sessionId -> moduleRuns (with trials)
      const moduleRunsBySession = new Map<string, ModuleRun[]>()
      allModuleRuns.forEach(run => {
        const trials = trialsByModuleRun.get(run.id) || []
        const runWithTrials = { ...run, trials }
        const existing = moduleRunsBySession.get(run.sessionId) || []
        existing.push(runWithTrials)
        moduleRunsBySession.set(run.sessionId, existing)
      })

      // Reconstruct sessions with their module runs and trials
      const sessionsWithData = allSessions.map(session => ({
        ...session,
        moduleRuns: moduleRunsBySession.get(session.id) || []
      }))

      setSessions(sessionsWithData)

      // Calculate module statistics
      const stats = new Map<ModuleId, ModuleStats>()

      allTrials.forEach(trial => {
        const existing = stats.get(trial.moduleId) || {
          moduleId: trial.moduleId,
          trialCount: 0,
          avgDifficulty: 0,
        }

        existing.trialCount += 1

        // Calculate average difficulty
        const totalDiff = existing.avgDifficulty * (existing.trialCount - 1) + trial.difficulty
        existing.avgDifficulty = totalDiff / existing.trialCount

        // Update recent metrics (will keep updating to latest)
        if (trial.metrics.tracking) {
          existing.recentMetrics = {
            tracking: {
              rmse: trial.metrics.tracking.rmse,
              timeOnTarget: trial.metrics.tracking.timeOnTarget,
            }
          }
        } else if (trial.metrics.attention) {
          existing.recentMetrics = {
            attention: {
              dPrime: trial.metrics.attention.dPrime,
              hitRate: trial.metrics.attention.hitRate,
            }
          }
        } else if (trial.metrics.spatial) {
          existing.recentMetrics = {
            spatial: {
              accuracy: trial.metrics.spatial.accuracy,
              reactionTime: trial.metrics.spatial.reactionTime,
            }
          }
        }

        stats.set(trial.moduleId, existing)
      })

      setModuleStats(stats)

      // Group trials by module for charts
      const trialsByMod = new Map<ModuleId, Trial[]>()
      allTrials
        .sort((a, b) => a.startTimestamp - b.startTimestamp)
        .forEach(trial => {
          const existing = trialsByMod.get(trial.moduleId) || []
          existing.push(trial)
          trialsByMod.set(trial.moduleId, existing)
        })
      setTrialsByModule(trialsByMod)
    } catch (error) {
      console.error('Failed to load analytics data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const totalTrials = Array.from(moduleStats.values()).reduce((sum, stat) => sum + stat.trialCount, 0)

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Performance Analytics</h1>
        <div className="bg-slate-800 rounded-lg p-6">
          <p className="text-slate-300">Loading analytics data...</p>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Performance Analytics</h1>
        <div className="bg-slate-800 rounded-lg p-6">
          <p className="text-slate-300 mb-4">No training data available yet.</p>
          <p className="text-slate-400 text-sm">
            Complete some training sessions to see your performance analytics here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Performance Analytics</h1>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="text-slate-400 text-sm mb-1">Total Sessions</div>
          <div className="text-3xl font-bold text-blue-400">{sessions.length}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="text-slate-400 text-sm mb-1">Total Trials</div>
          <div className="text-3xl font-bold text-blue-400">{totalTrials}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="text-slate-400 text-sm mb-1">Modules Trained</div>
          <div className="text-3xl font-bold text-blue-400">{moduleStats.size}</div>
        </div>
      </div>

      {/* Module Statistics */}
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Module Performance</h2>
        <div className="space-y-4">
          {Array.from(moduleStats.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([moduleId, stats]) => (
              <ModuleStatCard key={moduleId} moduleId={moduleId} stats={stats} />
            ))}
        </div>
      </div>

      {/* Performance Over Time Charts */}
      {trialsByModule.size > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Performance Over Time</h2>
          <div className="space-y-6">
            {Array.from(trialsByModule.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([moduleId, trials]) => (
                <ModuleChart key={moduleId} moduleId={moduleId} trials={trials} />
              ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Recent Sessions</h2>
        <div className="space-y-3">
          {sessions
            .slice()
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10)
            .map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
        </div>
      </div>
    </div>
  )
}

function ModuleStatCard({ moduleId, stats }: { moduleId: ModuleId; stats: ModuleStats }) {
  const moduleNames: Record<ModuleId, string> = {
    A: '1D Pursuit Tracking',
    B: '2D Pursuit Tracking',
    C: 'Auditory Selective Attention',
    D: 'Mental Rotation',
    E: 'Dual-Task Motor Control',
    F: 'Triple-Task',
    G: 'Interrupt Handling',
  }

  return (
    <div className="bg-slate-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-blue-400 font-semibold text-lg">Module {moduleId}</span>
          <span className="text-slate-400 text-sm ml-2">— {moduleNames[moduleId]}</span>
        </div>
        <div className="text-slate-400 text-sm">
          {stats.trialCount} trial{stats.trialCount !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-slate-500 text-xs">Avg Difficulty</div>
          <div className="text-slate-200 font-mono">{(stats.avgDifficulty * 100).toFixed(0)}%</div>
        </div>

        {stats.recentMetrics?.tracking && (
          <>
            <div>
              <div className="text-slate-500 text-xs">RMSE</div>
              <div className="text-slate-200 font-mono">{stats.recentMetrics.tracking.rmse.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Time on Target</div>
              <div className="text-slate-200 font-mono">
                {stats.recentMetrics.tracking.timeOnTarget.toFixed(1)}%
              </div>
            </div>
          </>
        )}

        {stats.recentMetrics?.attention && (
          <>
            <div>
              <div className="text-slate-500 text-xs">d-prime</div>
              <div className="text-slate-200 font-mono">{stats.recentMetrics.attention.dPrime.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Hit Rate</div>
              <div className="text-slate-200 font-mono">
                {(stats.recentMetrics.attention.hitRate * 100).toFixed(1)}%
              </div>
            </div>
          </>
        )}

        {stats.recentMetrics?.spatial && (
          <>
            <div>
              <div className="text-slate-500 text-xs">Accuracy</div>
              <div className="text-slate-200 font-mono">
                {(stats.recentMetrics.spatial.accuracy * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Reaction Time</div>
              <div className="text-slate-200 font-mono">{stats.recentMetrics.spatial.reactionTime.toFixed(0)}ms</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ModuleChart({ moduleId, trials }: { moduleId: ModuleId; trials: Trial[] }) {
  const moduleNames: Record<ModuleId, string> = {
    A: '1D Pursuit Tracking',
    B: '2D Pursuit Tracking',
    C: 'Auditory Selective Attention',
    D: 'Mental Rotation',
    E: 'Dual-Task Motor Control',
    F: 'Triple-Task',
    G: 'Interrupt Handling',
  }

  if (trials.length === 0) return null

  // Determine chart type based on first trial metrics
  const firstTrial = trials[0]
  const isTracking = !!firstTrial.metrics.tracking
  const isAttention = !!firstTrial.metrics.attention
  const isSpatial = !!firstTrial.metrics.spatial

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">
        <span className="text-blue-400">Module {moduleId}</span>
        <span className="text-slate-400 text-sm ml-2">— {moduleNames[moduleId]}</span>
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tracking modules (A, B) */}
        {isTracking && (
          <>
            <div>
              <h4 className="text-sm text-slate-400 mb-2">RMSE Over Time</h4>
              <LineChart
                data={trials.map((t, i) => ({ x: i + 1, y: t.metrics.tracking!.rmse }))}
                width={500}
                height={180}
                color="#3b82f6"
                xLabel="Trial"
                yLabel="RMSE"
                yMin={0}
              />
            </div>
            <div>
              <h4 className="text-sm text-slate-400 mb-2">Time on Target</h4>
              <LineChart
                data={trials.map((t, i) => ({
                  x: i + 1,
                  y: t.metrics.tracking!.timeOnTarget,
                }))}
                width={500}
                height={180}
                color="#10b981"
                xLabel="Trial"
                yLabel="Time on Target (%)"
                yMin={0}
                yMax={100}
              />
            </div>
          </>
        )}

        {/* Attention module (C) */}
        {isAttention && (
          <>
            <div>
              <h4 className="text-sm text-slate-400 mb-2">d-prime Over Time</h4>
              <LineChart
                data={trials.map((t, i) => ({ x: i + 1, y: t.metrics.attention!.dPrime }))}
                width={500}
                height={180}
                color="#3b82f6"
                xLabel="Trial"
                yLabel="d-prime"
                yMin={0}
              />
            </div>
            <div>
              <h4 className="text-sm text-slate-400 mb-2">Hit Rate</h4>
              <LineChart
                data={trials.map((t, i) => ({
                  x: i + 1,
                  y: t.metrics.attention!.hitRate * 100,
                }))}
                width={500}
                height={180}
                color="#10b981"
                xLabel="Trial"
                yLabel="Hit Rate (%)"
                yMin={0}
                yMax={100}
              />
            </div>
          </>
        )}

        {/* Spatial module (D) */}
        {isSpatial && (
          <>
            <div>
              <h4 className="text-sm text-slate-400 mb-2">Accuracy Over Time</h4>
              <LineChart
                data={trials.map((t, i) => ({
                  x: i + 1,
                  y: t.metrics.spatial!.accuracy * 100,
                }))}
                width={500}
                height={180}
                color="#3b82f6"
                xLabel="Trial"
                yLabel="Accuracy (%)"
                yMin={0}
                yMax={100}
              />
            </div>
            <div>
              <h4 className="text-sm text-slate-400 mb-2">Reaction Time</h4>
              <LineChart
                data={trials.map((t, i) => ({ x: i + 1, y: t.metrics.spatial!.reactionTime }))}
                width={500}
                height={180}
                color="#f59e0b"
                xLabel="Trial"
                yLabel="Reaction Time (ms)"
                yMin={0}
              />
            </div>
          </>
        )}

        {/* Difficulty progression (all modules) */}
        <div>
          <h4 className="text-sm text-slate-400 mb-2">Difficulty Progression</h4>
          <LineChart
            data={trials.map((t, i) => ({ x: i + 1, y: t.difficulty * 100 }))}
            width={500}
            height={180}
            color="#8b5cf6"
            xLabel="Trial"
            yLabel="Difficulty (%)"
            yMin={0}
            yMax={100}
          />
        </div>
      </div>
    </div>
  )
}

function SessionCard({ session }: { session: Session }) {
  const date = new Date(session.timestamp)
  const duration = session.endTimestamp
    ? Math.round((session.endTimestamp - session.timestamp) / 60000)
    : null

  return (
    <div className="bg-slate-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-slate-200">{date.toLocaleDateString()} {date.toLocaleTimeString()}</div>
        <div className="text-slate-400 text-sm">
          {duration !== null ? `${duration} min` : 'In progress'}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {session.moduleRuns.map(run => (
          <div key={run.id} className="text-xs bg-slate-800 px-2 py-1 rounded">
            <span className="text-blue-400">Module {run.moduleId}</span>
            <span className="text-slate-500 ml-1">({run.trials.length})</span>
          </div>
        ))}
        {session.moduleRuns.length === 0 && (
          <div className="text-slate-500 text-sm">No modules completed</div>
        )}
      </div>
    </div>
  )
}
