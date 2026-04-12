import React, { useEffect, useState } from 'react'

/**
 * The moment-of-learning card. Slides up over the dimmed board after a loss
 * with a tactical diagnosis ("You fell into a 4-3 Fork") and a single
 * compelling next step: train the exact pattern at the user's ELO.
 *
 * The weight here is intentional — heavy shadow, thick border, slight tilt on
 * entry — because passive-voice failure needs a tactile, embodied hand-off
 * into the training that fixes it.
 */
export default function InterventionCard({
  tacticLabel,
  narrative,
  trainingElo,
  onTrain,
  onDismiss,
  onPlayAgain,
  visible,
  delayMs = 900,
}) {
  const [appear, setAppear] = useState(false)
  useEffect(() => {
    if (!visible) { setAppear(false); return }
    const t = setTimeout(() => setAppear(true), delayMs)
    return () => clearTimeout(t)
  }, [visible, delayMs])

  if (!visible) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-end sm:items-center justify-center p-3 sm:p-6"
      style={{ zIndex: 30 }}
      role="dialog"
      aria-label="Tactical intervention"
    >
      <div
        className="intervention-card pointer-events-auto w-full max-w-md"
        style={{
          opacity: appear ? 1 : 0,
          transform: appear ? 'translateY(0) rotateX(0deg)' : 'translateY(40px) rotateX(8deg)',
          transition: 'opacity 520ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div className="intervention-card-inner">
          <div className="flex items-center gap-2 mb-1">
            <span className="intervention-tag">Post-mortem</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
            You fell into a {tacticLabel}.
          </h2>
          <p className="text-sm text-forest-200 mt-2 leading-relaxed">
            {narrative}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={onTrain}
              className="intervention-primary group"
            >
              <span className="flex-1 text-left">
                Train {tacticLabel} Defense
                <span className="block text-[11px] opacity-75 font-normal mt-0.5">
                  Puzzle at ELO {trainingElo}
                </span>
              </span>
              <span className="intervention-primary-arrow group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </button>
            <div className="flex gap-2">
              <button onClick={onPlayAgain} className="intervention-secondary flex-1">
                Play Again
              </button>
              <button onClick={onDismiss} className="intervention-ghost">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
