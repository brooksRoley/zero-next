// src/components/pente/QueueBanner.js
export default function QueueBanner({ onLeave }) {
  return (
    <div className="mx-3 mb-2 rounded-lg bg-cyan-900/30 border border-cyan-700/40 px-3 py-2 flex items-center gap-2">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
      </span>
      <span className="text-xs text-cyan-200 flex-1">
        In queue — playing bot while waiting...
      </span>
      <button
        onClick={onLeave}
        className="text-xs px-2 py-1 rounded-md bg-forest-800/60 text-forest-300 hover:text-white hover:bg-forest-700/60 border border-forest-700/40 transition-colors"
      >
        Leave Queue
      </button>
    </div>
  )
}
