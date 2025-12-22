import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-800 rounded-lg p-8 mb-8">
        <h1 className="text-3xl font-bold mb-4">Pilot Skills Trainer</h1>
        <p className="text-slate-300 text-lg leading-relaxed">
          This application trains aviation-relevant cognitive and motor skills
          such as continuous control, divided attention, and rapid task
          switching. Tasks are randomized and adaptive to promote transferable
          ability rather than memorization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/hardware"
          className="bg-slate-800 hover:bg-slate-700 rounded-lg p-6 transition-colors border border-slate-700 hover:border-blue-500"
        >
          <h2 className="text-xl font-semibold mb-2 text-blue-400">
            1. Hardware Setup
          </h2>
          <p className="text-slate-300">
            Detect and calibrate your input devices: joystick, throttle, rudder
            pedals, keyboard, and mouse.
          </p>
        </Link>

        <Link
          to="/training"
          className="bg-slate-800 hover:bg-slate-700 rounded-lg p-6 transition-colors border border-slate-700 hover:border-blue-500"
        >
          <h2 className="text-xl font-semibold mb-2 text-blue-400">
            2. Start Training
          </h2>
          <p className="text-slate-300">
            Choose a training module and begin skill development with adaptive
            difficulty.
          </p>
        </Link>

        <Link
          to="/analytics"
          className="bg-slate-800 hover:bg-slate-700 rounded-lg p-6 transition-colors border border-slate-700 hover:border-blue-500"
        >
          <h2 className="text-xl font-semibold mb-2 text-blue-400">
            3. View Analytics
          </h2>
          <p className="text-slate-300">
            Review your performance metrics, track progress, and identify areas
            for improvement.
          </p>
        </Link>
      </div>

      <div className="mt-8 bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-3">Training Modules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-mono text-blue-400">Module A</span>
            <span className="text-slate-300"> — 1D Pursuit Tracking</span>
          </div>
          <div>
            <span className="font-mono text-blue-400">Module B</span>
            <span className="text-slate-300"> — 2D Pursuit Tracking</span>
          </div>
          <div>
            <span className="font-mono text-blue-400">Module C</span>
            <span className="text-slate-300">
              {' '}
              — Auditory Selective Attention
            </span>
          </div>
          <div>
            <span className="font-mono text-blue-400">Module D</span>
            <span className="text-slate-300">
              {' '}
              — Spatial Orientation Microtasks
            </span>
          </div>
          <div>
            <span className="font-mono text-blue-400">Module E</span>
            <span className="text-slate-300"> — Dual-Task Motor Control</span>
          </div>
          <div>
            <span className="font-mono text-blue-400">Module F</span>
            <span className="text-slate-300">
              {' '}
              — Triple-Task (Motor + Auditory)
            </span>
          </div>
          <div>
            <span className="font-mono text-blue-400">Module G</span>
            <span className="text-slate-300">
              {' '}
              — Interrupt Handling Under Load
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
