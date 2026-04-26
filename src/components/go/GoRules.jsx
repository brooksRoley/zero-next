import React from 'react'

/**
 * Teaching panel for the Go MVP. Expanded by default — the whole point of this
 * route right now is to introduce the rules to a player who has never seen Go
 * before. Toggle is provided so it can be collapsed once the player gets it.
 */
export default function GoRules({ open, onToggle, boardSize }) {
  return (
    <div className="rounded-xl border border-forest-700/50 bg-forest-900/70 backdrop-blur-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-white tracking-wide">
          How to play Go
        </span>
        <span className="text-xs text-forest-400">
          {open ? 'hide' : 'show'} {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 text-sm leading-relaxed text-forest-200">
          <p>
            Go is a territory game. Black and White take turns placing one stone
            at a time on the {boardSize}×{boardSize} board. Whoever
            controls the most points at the end wins.
          </p>

          <div>
            <h3 className="text-forest-100 font-semibold mb-1">Liberties</h3>
            <p className="text-forest-300">
              A stone&rsquo;s <em>liberties</em> are the empty points directly
              next to it (up, down, left, right — not diagonal). Stones
              that touch each other share liberties as a single group.
            </p>
          </div>

          <div>
            <h3 className="text-forest-100 font-semibold mb-1">Capture</h3>
            <p className="text-forest-300">
              When you fill the last liberty of an opponent group, that group
              is removed from the board.
            </p>
          </div>

          <div>
            <h3 className="text-forest-100 font-semibold mb-1">Suicide</h3>
            <p className="text-forest-300">
              You cannot play a move that would leave your own group with zero
              liberties — unless that same move captures opponent stones
              first, freeing up a liberty.
            </p>
          </div>

          <div>
            <h3 className="text-forest-100 font-semibold mb-1">Ko</h3>
            <p className="text-forest-300">
              You cannot immediately recapture a single stone that just
              captured one of yours — you must play somewhere else first.
              This prevents an endless back-and-forth.
            </p>
          </div>

          <div>
            <h3 className="text-forest-100 font-semibold mb-1">Pass &amp; ending the game</h3>
            <p className="text-forest-300">
              You may pass on any turn. When both players pass in a row, the
              game ends and we count the score.
            </p>
          </div>

          <div>
            <h3 className="text-forest-100 font-semibold mb-1">Scoring — two systems</h3>
            <p className="text-forest-300 mb-1.5">
              Pick a rule before the game starts (it locks once you place a stone).
            </p>
            <ul className="text-forest-300 space-y-1 list-disc pl-5">
              <li>
                <strong className="text-forest-100">Chinese (area):</strong> your
                stones on the board + empty points fully surrounded by your color.
                Captures don&rsquo;t score directly — they shape territory.
              </li>
              <li>
                <strong className="text-forest-100">Japanese (territory):</strong>
                {' '}empty points fully surrounded by your color + prisoners you took.
                Stones on the board don&rsquo;t score on their own.
              </li>
            </ul>
            <p className="text-forest-400 text-xs mt-1.5">
              Same game usually picks the same winner under either rule; only the
              absolute scores differ.
            </p>
          </div>

          <div>
            <h3 className="text-forest-100 font-semibold mb-1">Komi</h3>
            <p className="text-forest-300">
              White gets bonus points to compensate for moving second. Standard
              komi is <strong>7.5</strong> Chinese / <strong>6.5</strong> Japanese;
              the half-point guarantees a winner — no draws.
            </p>
          </div>

          <div>
            <h3 className="text-forest-100 font-semibold mb-1">Handicap</h3>
            <p className="text-forest-300">
              Black can start with <strong>2–9</strong> stones already placed
              on the star points to balance a game between players of different
              strength. With handicap, <strong>White plays first</strong>.
            </p>
          </div>

          <div>
            <h3 className="text-forest-100 font-semibold mb-1">Dead stones</h3>
            <p className="text-forest-300">
              Once both players pass, the game enters a <em>marking</em> phase.
              Click any stone to toggle its entire group as dead. Dead stones
              count as captures, and their points become the surrounding
              color&rsquo;s territory. Click <strong>Done</strong> to accept,
              or <strong>Resume</strong> to keep playing.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
