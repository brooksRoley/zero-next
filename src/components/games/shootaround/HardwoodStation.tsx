/**
 * The last station: one real round of Hardwood. Hardwood runs as its own app at
 * /hardwood on this origin and counts each fight in localStorage
 * (`tactics_mastery`); this station notes that count when it opens and finishes
 * when the count goes up. A `storage` event fires here the moment Hardwood writes
 * in another tab, and a slow poll covers the same tab coming back into focus.
 */
import { useEffect, useRef, useState } from 'react'
import { track } from 'src/lib/analytics'
import {
  HARDWOOD_MASTERY_KEY,
  hardwoodFights,
  playedHardwood,
  type DayRecord,
  type Outcome,
} from 'src/lib/games/shootaround/progress'
import { GOLD, Lesson } from './Stations'

const POLL_MS = 2000

function readFights(): number {
  try {
    return hardwoodFights(window.localStorage.getItem(HARDWOOD_MASTERY_KEY))
  } catch {
    return 0
  }
}

type Props = {
  rec: DayRecord
  finished: boolean
  onBaseline: (fights: number) => void
  onDone: (outcome: Outcome) => void
}

export default function HardwoodStation({ rec, finished, onBaseline, onDone }: Props) {
  const [opened, setOpened] = useState(false)
  const doneRef = useRef(finished)
  doneRef.current = finished

  // Note Hardwood's fight count the first time today's station opens.
  useEffect(() => {
    if (!finished && rec.hardwoodBaseline === null) onBaseline(readFights())
  }, [finished, rec.hardwoodBaseline, onBaseline])

  // Finish as soon as Hardwood has started a fight since then.
  useEffect(() => {
    if (finished || rec.hardwoodBaseline === null) return
    const check = () => {
      if (!doneRef.current && playedHardwood(rec, readFights())) {
        doneRef.current = true
        onDone('solved')
      }
    }
    check()
    const id = window.setInterval(check, POLL_MS)
    const onStorage = (e: StorageEvent) => {
      if (e.key === HARDWOOD_MASTERY_KEY) check()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [finished, rec, onDone])

  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-200">
        Now use all four in the real game. <strong className="text-white">Play one round of Hardwood</strong>: draft under the 10G
        cap, place your players on the court, pick an offense and a coverage, and start the fight. This station finishes on its own
        when the fight starts.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-ink-200">
        <li>
          <span style={{ color: GOLD }}>Shop:</span> the copies badge on each card is your hash map. Three makes a ★★.
        </li>
        <li>
          <span style={{ color: GOLD }}>Gold:</span> every signing is a knapsack choice, and saved gold earns interest.
        </li>
        <li>
          <span style={{ color: GOLD }}>Court:</span> spacing is a graph. Give the ball more than one way to the rim.
        </li>
        <li>
          <span style={{ color: GOLD }}>Schemes:</span> your offense against their coverage is a cell in a payoff matrix.
        </li>
      </ul>
      {!finished && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href="/hardwood"
            target="_blank"
            rel="noopener"
            onClick={() => {
              setOpened(true)
              track('cta_click', { page: '/games/shootaround', metadata: { location: 'shootaround_hardwood' }, beacon: true })
            }}
            className="inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-bold text-ink-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ background: GOLD }}
          >
            Open Hardwood ↗
          </a>
          <p role="status" aria-live="polite" className="text-sm text-ink-300">
            {opened ? 'Waiting for your first fight… come back to this tab when it starts.' : 'It opens in a new tab.'}
          </p>
        </div>
      )}
      {!finished && opened && (
        <button
          type="button"
          onClick={() => onDone('shown')}
          className="mt-3 text-xs text-ink-400 underline underline-offset-2 hover:text-ink-200"
        >
          Played it in another browser? Mark it done
        </button>
      )}
      {finished && (
        <Lesson title="Round played">
          <p>
            That&apos;s the shootaround. Hardwood is where the four ideas meet: a shop you count, a cap you budget, a court you
            connect, and a scheme you read. Tomorrow brings new boards.
          </p>
        </Lesson>
      )}
    </div>
  )
}
