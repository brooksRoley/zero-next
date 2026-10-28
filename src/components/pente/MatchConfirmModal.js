// src/components/pente/MatchConfirmModal.js
export default function MatchConfirmModal({ opponent, confirmTimer, onAccept, onDecline }) {
  if (!opponent) return null

  const urgency = confirmTimer <= 5

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm rounded-xl">
      <div className="bg-ink-900 border border-ink-700/60 rounded-xl p-5 max-w-xs w-full mx-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-white mb-1">Opponent found!</h3>
        <p className="text-xs text-ink-300 mb-4">
          <span className="text-white font-medium">{opponent.name}</span>
          {opponent.elo != null && (
            <span className="text-ink-400 ml-1">(~{opponent.elo} ELO)</span>
          )}
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={onAccept}
            className="flex-1 py-2 rounded-lg bg-gradient-to-r from-brass-500 to-brass-600 text-white font-semibold text-sm hover:from-brass-400 hover:to-brass-500 transition-all"
          >
            Accept
          </button>
          <button
            onClick={onDecline}
            className="flex-1 py-2 rounded-lg bg-ink-800 text-ink-300 text-sm border border-ink-700/40 hover:bg-ink-700/60 hover:text-white transition-colors"
          >
            Decline
          </button>
        </div>

        {/* Countdown */}
        <div className="text-center">
          <span className={`text-xs font-mono ${urgency ? 'text-red-400' : 'text-ink-500'}`}>
            {confirmTimer}s
          </span>
          <div className="mt-1 h-1 rounded-full bg-ink-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${urgency ? 'bg-red-500' : 'bg-cyan-500'}`}
              style={{ width: `${(confirmTimer / 15) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
