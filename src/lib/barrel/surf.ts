/**
 * BARREL — real surf conditions in, game conditions out.
 *
 * The WASM game takes SetGlobalSurfConditions(height, period, wind, breakType).
 * This module turns an Open-Meteo marine + wind reading for one of three fixed
 * spots into those four numbers. It is a game model, not a forecast: it keeps
 * the real relationships (bigger, longer-period swell is more powerful; wind
 * blowing from land is offshore and makes the wave hollower) and clamps to the
 * range the physics is tuned for.
 *
 * Pure: no fetch, no Date. The API route does the I/O.
 */

export type SpotId = 'pipeline' | 'teahupoo' | 'skeleton-bay'

export type Spot = {
  id: SpotId
  name: string
  /** Index passed to SetGlobalSurfConditions (matches barrel::BreakType). */
  breakType: 0 | 1 | 2
  latitude: number
  longitude: number
  /** Compass bearing the wind blows FROM when it is straight offshore. */
  offshoreFrom: number
  /** Open-ocean swell height to breaking face height: reefs focus and lift it. */
  faceGain: number
  /** Played when there is no live reading. Typical good-day numbers. */
  typical: GameConditions
  blurb: string
}

export type GameConditions = {
  height: number // breaking face height, m (1..6)
  period: number // s (5..22)
  wind: number // offshore component, m/s (negative = onshore, -15..15)
  breakType: 0 | 1 | 2
}

export type SurfReading = {
  waveHeight: number | null // m, significant height
  wavePeriod: number | null // s
  swellHeight: number | null
  swellPeriod: number | null
  windSpeed: number | null // m/s
  windFrom: number | null // degrees, meteorological (where it blows from)
}

export const SPOTS: readonly Spot[] = [
  {
    id: 'pipeline',
    name: 'Pipeline',
    breakType: 0,
    latitude: 21.665,
    longitude: -158.053,
    offshoreFrom: 150,
    faceGain: 1.5,
    typical: { height: 3.2, period: 14, wind: 4, breakType: 0 },
    blurb: 'Hollow and fast over a shallow reef. The biggest tubes and the hardest wipeouts.',
  },
  {
    id: 'teahupoo',
    name: "Teahupo'o",
    breakType: 1,
    latitude: -17.847,
    longitude: -149.267,
    offshoreFrom: 40,
    faceGain: 1.4,
    typical: { height: 3.0, period: 15, wind: 3, breakType: 1 },
    blurb: 'Thick lip, a face that sucks below sea level. Make the drop, bottom turn at once.',
  },
  {
    id: 'skeleton-bay',
    name: 'Skeleton Bay',
    breakType: 2,
    latitude: -22.69,
    longitude: 14.52,
    offshoreFrom: 120,
    faceGain: 1.2,
    typical: { height: 2.2, period: 13, wind: 6, breakType: 2 },
    blurb: 'A sand-bottom left that runs and runs. Match its speed and the tube goes on for seconds.',
  },
] as const

export function spotById(id: unknown): Spot | null {
  return SPOTS.find((s) => s.id === id) ?? null
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** The signed offshore component of a wind: + offshore, - onshore. */
export function offshoreComponent(speed: number, fromDeg: number, offshoreFrom: number): number {
  const diff = ((fromDeg - offshoreFrom) * Math.PI) / 180
  return speed * Math.cos(diff)
}

/** Same clamps as barrel::sanitizeConditions, so the page shows what the game plays. */
export function clampConditions(c: GameConditions): GameConditions {
  return {
    height: finite(c.height) ? clamp(c.height, 1, 6) : 2.6,
    period: finite(c.period) ? clamp(c.period, 5, 22) : 13,
    wind: finite(c.wind) ? clamp(c.wind, -15, 15) : 3,
    breakType: c.breakType === 1 || c.breakType === 2 ? c.breakType : 0,
  }
}

/**
 * A reading for a spot to game conditions. Prefers the swell partition (the
 * groundswell that actually breaks on the reef) over combined sea state, and
 * falls back to the spot's typical value for any field that is missing.
 */
export function conditionsFromReading(spot: Spot, r: SurfReading): GameConditions {
  const height = finite(r.swellHeight) && r.swellHeight > 0.2 ? r.swellHeight : r.waveHeight
  const period = finite(r.swellPeriod) && r.swellPeriod > 0 ? r.swellPeriod : r.wavePeriod
  const wind =
    finite(r.windSpeed) && finite(r.windFrom) ? offshoreComponent(r.windSpeed, r.windFrom, spot.offshoreFrom) : null
  return clampConditions({
    height: finite(height) ? round1(height * spot.faceGain) : spot.typical.height,
    period: finite(period) ? round1(period) : spot.typical.period,
    wind: wind === null ? spot.typical.wind : round1(wind),
    breakType: spot.breakType,
  })
}

const round1 = (v: number) => Math.round(v * 10) / 10

function firstNumber(v: unknown): number | null {
  if (finite(v)) return v
  return null
}

/** Pulls the `current` block out of Open-Meteo's marine and forecast responses. */
export function parseOpenMeteo(marine: unknown, weather: unknown): SurfReading {
  const m = (marine as { current?: Record<string, unknown> } | null)?.current ?? {}
  const w = (weather as { current?: Record<string, unknown> } | null)?.current ?? {}
  return {
    waveHeight: firstNumber(m.wave_height),
    wavePeriod: firstNumber(m.wave_period),
    swellHeight: firstNumber(m.swell_wave_height),
    swellPeriod: firstNumber(m.swell_wave_period),
    windSpeed: firstNumber(w.wind_speed_10m),
    windFrom: firstNumber(w.wind_direction_10m),
  }
}

/** True when the reading has at least a height and a period to play from. */
export function readingIsUsable(r: SurfReading): boolean {
  return (finite(r.swellHeight) || finite(r.waveHeight)) && (finite(r.swellPeriod) || finite(r.wavePeriod))
}

/** The server builds these URLs; nothing from the client goes into them. */
export function openMeteoUrls(spot: Spot): { marine: string; weather: string } {
  const loc = `latitude=${spot.latitude}&longitude=${spot.longitude}`
  return {
    marine: `https://marine-api.open-meteo.com/v1/marine?${loc}&current=wave_height,wave_period,swell_wave_height,swell_wave_period`,
    weather: `https://api.open-meteo.com/v1/forecast?${loc}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`,
  }
}

export type ConditionsResponse = {
  spot: SpotId
  source: 'live' | 'typical'
  conditions: GameConditions
  reading: SurfReading | null
  fetchedAt: string
}
