import { describe, expect, it } from 'vitest'
import { createGameTracker } from 'src/lib/analytics'
import { waveTrackerState } from 'src/lib/barrel/session'

describe('one wave is one game', () => {
  it('counts a wave from the pop-up to the result card, and not an idle miss', () => {
    const events: string[] = []
    const t = createGameTracker('barrel', (e) => events.push(e), () => 0)
    const feed = (state: number, outcome = 0) => t.update(waveTrackerState({ state, outcome }))
    feed(0) // paddling
    feed(4, 4) // missed: never tried
    expect(events).toEqual([])
    feed(0)
    feed(1) // riding
    feed(1)
    feed(3, 1) // done, kick out
    feed(3, 1)
    expect(events).toEqual(['game_start', 'game_end'])
    feed(0)
    feed(2) // wipeout on the pop-up
    feed(3, 3)
    expect(events).toEqual(['game_start', 'game_end', 'game_start', 'game_end'])
  })
})
