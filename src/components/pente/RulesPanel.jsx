import React from 'react'
import { PLAYER_COLORS } from 'src/lib/pente/constants'
import { MODE_RULES } from 'src/lib/pente/boardDisplay'

/**
 * The collapsible rules blurb under the header. Pure presentation over the
 * active game mode — no state of its own, no callbacks. Rendered only while
 * the parent's `showRules` toggle is on.
 */
export default function RulesPanel({ gameMode }) {
  const rules = gameMode && MODE_RULES[gameMode.key]

  return (
    <div className="mx-3 mb-2 rounded-xl bg-forest-900/80 border border-forest-700/40 px-4 py-3">
      <p className="text-xs text-forest-300 mb-2 leading-relaxed">
        {rules
          ? <strong className="text-forest-100">{rules.title}</strong>
          : <>19×19 board. First to <strong className="text-forest-100">five-in-a-row</strong> or{' '}
            <strong className="text-forest-100">five captured pairs</strong> wins.</>
        }
      </p>
      <ul className="text-xs text-forest-400 space-y-1.5">
        <li>
          <strong className="text-forest-200">Capture:</strong>{' '}
          {rules
            ? rules.captures
            : 'Bracket exactly two opponent stones with yours in a straight line.'
          }
        </li>
        <li>
          <strong className="text-forest-200">Five in a row:</strong>{' '}
          Any direction — horizontal, vertical, or diagonal.
          {gameMode?.teams && (
            <span className="text-forest-500"> (Your stones only — teammate stones don&rsquo;t count.)</span>
          )}
        </li>
        {(!gameMode || gameMode.key === 'classic') && (
          <li>
            <strong className="text-forest-200">Pro rule:</strong>{' '}
            First player&rsquo;s second stone must be ≥3 intersections from center.
          </li>
        )}
        {gameMode?.teams && (
          <li>
            <strong className="text-forest-200">Teams:</strong>{' '}
            {PLAYER_COLORS[gameMode.teams[0][0]]?.name} + {PLAYER_COLORS[gameMode.teams[0][1]]?.name} vs{' '}
            {PLAYER_COLORS[gameMode.teams[1][0]]?.name} + {PLAYER_COLORS[gameMode.teams[1][1]]?.name}.
            Captures are shared within your team.
          </li>
        )}
      </ul>
    </div>
  )
}
