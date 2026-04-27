// src/components/pente/MatchConfirmModal.js
export default function MatchConfirmModal({ opponent, confirmTimer, onAccept, onDecline }) {
  if (!opponent) return null

  const urgency = confirmTimer <= 5

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-forest-950/80 backdrop-blur-sm rounded-xl">
      <div className="bg-forest-900 border border-forest-700/60 rounded-xl p-5 max-w-xs w-full mx-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-white mb-1">Opponent found!</h3>
        <p className="text-xs text-forest-300 mb-4">
          <span className="text-white font-medium">{opponent.name}</span>
          {opponent.elo != null && (
            <span className="text-forest-400 ml-1">(~{opponent.elo} ELO)</span>
          )}
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={onAccept}
            className="flex-1 py-2 rounded-lg bg-gradient-to-r from-candy-500 to-candy-600 text-white font-semibold text-sm hover:from-candy-400 hover:to-candy-500 transition-all"
          >
            Accept
          </button>
          <button
            onClick={onDecline}
            className="flex-1 py-2 rounded-lg bg-forest-800 text-forest-300 text-sm border border-forest-700/40 hover:bg-forest-700/60 hover:text-white transition-colors"
          >
            Decline
          </button>
        </div>

        {/* Countdown */}
        <div className="text-center">
          <span className={`text-xs font-mono ${urgency ? 'text-red-400' : 'text-forest-500'}`}>
            {confirmTimer}s
          </span>
          <div className="mt-1 h-1 rounded-full bg-forest-800 overflow-hidden">
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
