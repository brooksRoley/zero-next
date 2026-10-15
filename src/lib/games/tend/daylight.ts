/**
 * The garden keeps the real clock: dawn, day, golden hour and night tint the
 * board, and the Watershed's sky matches. Hours are local time.
 */

export type Phase = 'dawn' | 'day' | 'golden' | 'night'

/** Where each phase starts, in local hours (fractional is fine). */
export const PHASE_STARTS: { phase: Phase; from: number }[] = [
  { phase: 'dawn', from: 5 },
  { phase: 'day', from: 7.5 },
  { phase: 'golden', from: 17.5 },
  { phase: 'night', from: 19.5 },
]

export function phaseAt(hour: number): Phase {
  const h = ((hour % 24) + 24) % 24
  let phase: Phase = 'night'
  for (const p of PHASE_STARTS) if (h >= p.from) phase = p.phase
  return phase
}

export function phaseOf(date: Date): Phase {
  return phaseAt(date.getHours() + date.getMinutes() / 60)
}

/** The tint laid over the scene for each phase: a colour and how strongly. Day is untinted. */
export const PHASE_TINT: Record<Phase, { color: string; opacity: number }> = {
  dawn: { color: '#ff9e7a', opacity: 0.1 },
  day: { color: '#000000', opacity: 0 },
  golden: { color: '#ffae42', opacity: 0.14 },
  night: { color: '#06102a', opacity: 0.5 },
}

export const PHASE_LABEL: Record<Phase, string> = {
  dawn: 'Dawn',
  day: 'Day',
  golden: 'Golden hour',
  night: 'Night: the datura is open',
}

/**
 * The phase to draw now. Outside production, `?hour=21` sets the clock so
 * night can be tried at noon.
 */
export function currentPhase(search = typeof window === 'undefined' ? '' : window.location.search): Phase {
  if (process.env.NODE_ENV !== 'production') {
    const hour = new URLSearchParams(search).get('hour')
    if (hour && /^\d{1,2}(\.\d+)?$/.test(hour)) return phaseAt(Number(hour))
  }
  return phaseOf(new Date())
}
