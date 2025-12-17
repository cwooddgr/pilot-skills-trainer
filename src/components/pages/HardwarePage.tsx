export function HardwarePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Hardware Setup</h1>
      <div className="bg-slate-800 rounded-lg p-6">
        <p className="text-slate-300">
          Hardware detection and calibration interface will be implemented here.
        </p>
        <p className="text-slate-400 text-sm mt-4">
          Features: Gamepad API detection, axis mapping, deadzone configuration,
          sensitivity curves, and per-device calibration.
        </p>
      </div>
    </div>
  )
}
