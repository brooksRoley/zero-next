import { useEffect, useRef } from 'react'
import { createGameTracker } from 'src/lib/analytics'

/**
 * Fires game_start on the first move and game_end when the game finishes.
 * `getStartMeta` / `getEndMeta` are read at the moment each event fires, so
 * they may close over state without being listed as dependencies.
 */
export default function useGameTracking(game, { moveCount, finished, getStartMeta, getEndMeta }) {
  const trackerRef = useRef(null)
  if (trackerRef.current === null) trackerRef.current = createGameTracker(game)

  const metaRef = useRef({})
  useEffect(() => {
    metaRef.current = { start: getStartMeta, end: getEndMeta }
  })

  useEffect(() => {
    trackerRef.current.update({ moveCount, finished }, {
      start: () => metaRef.current.start?.() ?? {},
      end: () => metaRef.current.end?.() ?? {},
    })
  }, [moveCount, finished])
}
