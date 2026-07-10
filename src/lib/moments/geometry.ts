/**
 * Court geometry for the Playoff Moments puzzles ("the frozen second").
 *
 * Coordinate system: feet, offensive half court. x runs sideline to sideline
 * (0-50), y runs baseline (0) to half court (47). The hoop sits at (25, 5.25).
 *
 * The whole puzzle is two disks racing each other:
 *   - the protagonist can reach any spot within speed × timeLeft of their start
 *   - each defender contests any spot within speed × defenderTime + arm reach
 * Spot quality = shot value of the zone × how late the closest defender is.
 * Zone values are hand-tuned PPP-ish numbers for now; the Phase-2 shot-chart
 * ingest (real xPPS per zone) is designed to replace ZONE_VALUES wholesale.
 */

export type Vec = { x: number; y: number }
export type Actor = { name: string; pos: Vec; speed: number } // speed in ft/s

export type Moment = {
  id: string
  title: string
  date: string
  series: string
  clock: string
  kind: 'shape' | 'deny'
  story: string
  question: string
  epilogue: string
  protagonist: Actor
  /** Seconds the protagonist has to relocate before the release. */
  timeLeft: number
  /** Seconds the defense gets to react to the chosen spot (always shorter). */
  defenderTime: number
  defenders: Actor[]
  teammates: Actor[]
  historicalSpot: Vec
  /** deny puzzles only: the point that must be covered (the ball's arrival). */
  denyPoint?: Vec
}

export type Grade = 'A' | 'B' | 'C' | 'D'

export type GradeResult = {
  grade: Grade
  lesson: string
  /** Chosen-spot quality / best-spot quality (shape puzzles). */
  ratio: number
  best: Vec
  historicalMatch: boolean
}

export const COURT_W = 50
export const COURT_H = 47
export const HOOP: Vec = { x: 25, y: 5.25 }
export const ARM_REACH = 3.5
export const THREE_ARC = 23.75
export const THREE_CORNER = 22
/** y where the 23.75ft arc meets the 22ft corner line. */
export const CORNER_BREAK_Y = 14
export const HISTORY_RADIUS = 4 // ft — "that's the spot history chose"

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function inBounds(p: Vec): boolean {
  // 1.5ft margin: a shooter's feet need real floor, not the sideline paint.
  return p.x >= 1.5 && p.x <= COURT_W - 1.5 && p.y >= 1.5 && p.y <= COURT_H
}

export function isThree(p: Vec): boolean {
  if (p.y <= CORNER_BREAK_Y) return Math.abs(p.x - HOOP.x) >= THREE_CORNER
  return dist(p, HOOP) >= THREE_ARC
}

const ZONE_VALUES = {
  rim: 1.3,
  corner3: 1.2,
  arc3: 1.05,
  paint: 0.95,
  mid: 0.8,
} as const

export type Zone = keyof typeof ZONE_VALUES

export function zoneOf(p: Vec): Zone {
  if (dist(p, HOOP) <= 4.5) return 'rim'
  if (isThree(p)) return p.y <= CORNER_BREAK_Y ? 'corner3' : 'arc3'
  if (Math.abs(p.x - HOOP.x) <= 8 && p.y <= 19) return 'paint'
  return 'mid'
}

export function zoneValue(p: Vec): number {
  // Beyond a normal three, value decays toward zero: a 35-footer is a prayer,
  // not a shape. Linear falloff from 25ft, gone by 40ft.
  const d = dist(p, HOOP)
  const deep = d > 25 ? Math.max(0, 1 - (d - 25) / 15) : 1
  return ZONE_VALUES[zoneOf(p)] * deep
}

/**
 * How late the closest defender is to a contest at `spot`, in seconds.
 * Positive = the shot is clean; negative = a hand arrives first.
 */
export function contestSlack(spot: Vec, defenders: Actor[], defenderTime: number): number {
  let slack = Infinity
  for (const d of defenders) {
    const closeTime = Math.max(0, dist(d.pos, spot) - ARM_REACH) / d.speed
    slack = Math.min(slack, closeTime - defenderTime)
  }
  return slack
}

/** Map defender slack to a 0.05–1 openness multiplier (linear between ±0.5s). */
export function openness(slack: number): number {
  const t = Math.max(0, Math.min(1, (slack + 0.5) / 1.0))
  return 0.05 + t * 0.95
}

export function reachable(spot: Vec, protagonist: Actor, timeLeft: number): boolean {
  return dist(protagonist.pos, spot) <= protagonist.speed * timeLeft + 0.25
}

export function spotQuality(spot: Vec, moment: Moment): number {
  if (!inBounds(spot)) return 0
  return zoneValue(spot) * openness(contestSlack(spot, moment.defenders, moment.defenderTime))
}

/** Grid-search the best reachable spot at 1ft resolution. */
export function solveBest(moment: Moment): { spot: Vec; quality: number } {
  let best: Vec = moment.protagonist.pos
  let bestQ = -1
  for (let x = 1; x <= COURT_W - 1; x++) {
    for (let y = 1; y <= COURT_H - 1; y++) {
      const p = { x, y }
      if (!reachable(p, moment.protagonist, moment.timeLeft)) continue
      const q = spotQuality(p, moment)
      if (q > bestQ) {
        bestQ = q
        best = p
      }
    }
  }
  return { spot: best, quality: bestQ }
}

const SHAPE_LESSONS: Record<Grade, string> = {
  A: 'You read the shape: the one pocket the closing speeds can’t erase in time.',
  B: 'Good geometry — a slightly deeper cut or wider angle buys a cleaner look.',
  C: 'Playable, but a defender’s disk covers most of that spot. The floor had a better answer.',
  D: 'The defense arrives before the ball does. Find where their reach ends, not where the ball starts.',
}

const DENY_LESSONS: Record<Grade, string> = {
  A: 'You ran to where the ball must end, not where it is. That’s the whole trick.',
  B: 'Close — you reach the play, but from an angle that gives the shooter the glass.',
  C: 'You chased the man. The man isn’t the threat; the release point is.',
  D: 'By the time you arrive, the ball has already left. Intercept the future, not the present.',
}

function gradeDeny(spot: Vec, moment: Moment): GradeResult {
  const target = moment.denyPoint as Vec
  const canReach = reachable(spot, moment.protagonist, moment.timeLeft) && inBounds(spot)
  const d = dist(spot, target)
  let grade: Grade
  if (!canReach) grade = 'D'
  else if (d <= 4) grade = 'A'
  else if (d <= 8) grade = 'B'
  else if (d <= 14) grade = 'C'
  else grade = 'D'
  return {
    grade,
    lesson: canReach ? DENY_LESSONS[grade] : 'That spot is beyond your legs — the clock wins the race.',
    ratio: canReach ? Math.max(0, 1 - d / 20) : 0,
    best: target,
    historicalMatch: dist(spot, moment.historicalSpot) <= HISTORY_RADIUS,
  }
}

export function gradeSpot(spot: Vec, moment: Moment): GradeResult {
  if (moment.kind === 'deny') return gradeDeny(spot, moment)

  if (!inBounds(spot)) {
    return {
      grade: 'D',
      lesson: 'Heel on the line. The greatest corner three ever taken was famous for exactly not doing this.',
      ratio: 0,
      best: solveBest(moment).spot,
      historicalMatch: false,
    }
  }
  if (!reachable(spot, moment.protagonist, moment.timeLeft)) {
    return {
      grade: 'D',
      lesson: 'That spot is beyond your legs — the clock wins the race.',
      ratio: 0,
      best: solveBest(moment).spot,
      historicalMatch: false,
    }
  }
  const { spot: best, quality: bestQ } = solveBest(moment)
  const q = spotQuality(spot, moment)
  const ratio = bestQ > 0 ? q / bestQ : 0
  const grade: Grade = ratio >= 0.9 ? 'A' : ratio >= 0.75 ? 'B' : ratio >= 0.55 ? 'C' : 'D'
  return {
    grade,
    lesson: SHAPE_LESSONS[grade],
    ratio,
    best,
    historicalMatch: dist(spot, moment.historicalSpot) <= HISTORY_RADIUS,
  }
}
