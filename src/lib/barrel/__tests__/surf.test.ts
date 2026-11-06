import { describe, expect, it } from 'vitest'
import {
  SPOTS,
  clampConditions,
  conditionsFromReading,
  offshoreComponent,
  openMeteoUrls,
  parseOpenMeteo,
  readingIsUsable,
  spotById,
} from 'src/lib/barrel/surf'

const pipeline = spotById('pipeline')!

describe('surf conditions mapping', () => {
  it('only knows the three fixed spots, in break-type order', () => {
    expect(SPOTS.map((s) => s.breakType)).toEqual([0, 1, 2])
    expect(spotById('pipeline')?.name).toBe('Pipeline')
    expect(spotById('https://evil.example')).toBeNull()
    expect(spotById(['pipeline'])).toBeNull()
  })

  it('splits wind into an offshore component', () => {
    expect(offshoreComponent(10, 150, 150)).toBeCloseTo(10)
    expect(offshoreComponent(10, 330, 150)).toBeCloseTo(-10)
    expect(offshoreComponent(10, 60, 150)).toBeCloseTo(0, 5)
  })

  it('maps a live reading: swell partition first, reef gain, clamped', () => {
    const r = parseOpenMeteo(
      { current: { wave_height: 3.08, wave_period: 11.65, swell_wave_height: 2.1, swell_wave_period: 13 } },
      { current: { wind_speed_10m: 5.5, wind_direction_10m: 150 } },
    )
    expect(readingIsUsable(r)).toBe(true)
    expect(conditionsFromReading(pipeline, r)).toEqual({ height: 3.2, period: 13, wind: 5.5, breakType: 0 })
  })

  it('fills missing fields from the spot and never passes NaN', () => {
    const r = parseOpenMeteo({ current: { wave_height: 'x' } }, null)
    expect(readingIsUsable(r)).toBe(false)
    const c = conditionsFromReading(pipeline, r)
    expect(c).toEqual(pipeline.typical)
    expect(clampConditions({ height: 40, period: 1, wind: Number.NaN, breakType: 7 as 0 })).toEqual({
      height: 6,
      period: 5,
      wind: 3,
      breakType: 0,
    })
  })

  it('builds upstream URLs from the spot table only', () => {
    const urls = openMeteoUrls(pipeline)
    expect(urls.marine).toMatch(/^https:\/\/marine-api\.open-meteo\.com\/v1\/marine\?latitude=21\.665&longitude=-158\.053/)
    expect(urls.weather).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/)
  })
})
