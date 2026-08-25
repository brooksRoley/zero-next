import { describe, it, expect } from 'vitest'
import {
  ALTITUDE_ZONES,
  STARTING_ELO,
  MIN_ELO,
  MAX_ELO,
  getZone,
  getAltitudePercent,
  calculateEloChange,
  calculatePuzzleEloChange,
} from '../elo'

// All expected numbers below are derived by hand from the standard ELO
// formula documented in elo.js:
//
//   expected = 1 / (1 + 10^((opponentElo - playerElo) / 400))
//   change   = round(K * (score - expected))
//
// and, for calculatePuzzleEloChange, from the attempts/hint penalties and
// speed-bonus rules read out of the source (attempts penalty floor 0.3,
// hint penalty floor 0.2, speed bonus window 30000ms / cap 0.3, gated on
// puzzleRating >= playerElo). Nothing here was derived by running the code
// and copying its output back.

describe('calculateEloChange', () => {
  it('gives zero change for a draw between equal ratings', () => {
    // expected = 1/(1+10^0) = 0.5; K*(0.5-0.5) = 0
    expect(calculateEloChange(1000, 1000, 0.5, 20)).toBe(0)
  })

  it('awards K/2 for a win between equal ratings', () => {
    // K*(1 - 0.5) = 20*0.5 = 10
    expect(calculateEloChange(1000, 1000, 1, 20)).toBe(10)
  })

  it('deducts K/2 for a loss between equal ratings', () => {
    // K*(0 - 0.5) = -10
    expect(calculateEloChange(1000, 1000, 0, 20)).toBe(-10)
  })

  it('defaults K to 20 when omitted', () => {
    expect(calculateEloChange(1000, 1000, 1)).toBe(10)
  })

  it('applies a custom K-factor (K=16, equal ratings, loss)', () => {
    // K*(0-0.5) = 16*-0.5 = -8
    expect(calculateEloChange(1000, 1000, 0, 16)).toBe(-8)
  })

  it('applies a custom K-factor (K=32, equal ratings, win)', () => {
    // K*(1-0.5) = 32*0.5 = 16
    expect(calculateEloChange(1000, 1000, 1, 32)).toBe(16)
  })

  it('awards a small change when a 400-point favorite wins as expected', () => {
    // expected = 1/(1+10^(-1)) = 1/1.1 = 0.909090909...
    // K*(1-0.909090909) = 20*0.090909091 = 1.818... -> rounds to 2
    expect(calculateEloChange(1600, 1200, 1, 20)).toBe(2)
  })

  it('deducts heavily when a 400-point favorite loses (upset)', () => {
    // K*(0-0.909090909) = -18.1818... -> rounds to -18
    expect(calculateEloChange(1600, 1200, 0, 20)).toBe(-18)
  })

  it('awards heavily when a 400-point underdog wins (upset)', () => {
    // expected = 1/(1+10^1) = 1/11 = 0.090909091
    // K*(1-0.090909091) = 18.1818... -> rounds to 18
    expect(calculateEloChange(1200, 1600, 1, 20)).toBe(18)
  })

  it('deducts only a little when a 400-point underdog loses as expected', () => {
    // K*(0-0.090909091) = -1.818... -> rounds to -2
    expect(calculateEloChange(1200, 1600, 0, 20)).toBe(-2)
  })

  it('rounds a huge favorite win (1200-point gap) down to zero change', () => {
    // expected = 1/(1+10^-3) = 0.999000999...
    // K*(1-0.999000999) = 0.01998... -> rounds to 0
    expect(calculateEloChange(2000, 800, 1, 20)).toBe(0)
  })

  it('deducts nearly the full K for a huge favorite loss (1200-point gap)', () => {
    // K*(0-0.999000999) = -19.98... -> rounds to -20
    expect(calculateEloChange(2000, 800, 0, 20)).toBe(-20)
  })

  it('awards nearly the full K for a huge underdog win (1200-point gap)', () => {
    // expected = 1/(1+10^3) = 0.000999000999...
    // K*(1-0.000999) = 19.98... -> rounds to 20
    expect(calculateEloChange(800, 2000, 1, 20)).toBe(20)
  })

  it('rounds a huge underdog loss (1200-point gap) down to (negative) zero change', () => {
    // K*(0-0.000999000999) = -0.01998... -> Math.round rounds this to -0,
    // not +0, because JS Math.round preserves sign on magnitudes < 0.5.
    // This documents real behavior of the implementation, not a bug: -0
    // and 0 are numerically equal (=== / for arithmetic purposes) but the
    // exact bit pattern is worth pinning down since callers add this to a
    // running total.
    const result = calculateEloChange(800, 2000, 0, 20)
    expect(result).toBe(-0)
    expect(result === 0).toBe(true)
  })

  it('does not clamp or validate an out-of-range score (score=2 is treated literally)', () => {
    // The function performs no validation on `score` — a caller passing a
    // nonsensical score outside [0,1] just gets the arithmetic result.
    // K*(2-0.5) = 20*1.5 = 30
    expect(calculateEloChange(1000, 1000, 2, 20)).toBe(30)
  })

  it('propagates NaN for a non-numeric rating rather than throwing', () => {
    expect(Number.isNaN(calculateEloChange(NaN, 1000, 1, 20))).toBe(true)
  })
})

describe('calculatePuzzleEloChange', () => {
  describe('failed puzzles', () => {
    it('always uses K=16 and score=0 regardless of attempts/hint when solved is false', () => {
      // Same math as calculateEloChange(1000, 1000, 0, 16) = -8
      expect(calculatePuzzleEloChange(1000, 1000, false, 0, false, undefined)).toBe(-8)
      // attempts/hint arguments are ignored on the failure path
      expect(calculatePuzzleEloChange(1000, 1000, false, 5, true, undefined)).toBe(-8)
    })

    it('deducts more from a favorite who fails an easier puzzle', () => {
      // expected = 1/(1+10^((1000-1200)/400)) = 1/(1+10^-0.5) = 0.759746927...
      // K*(0-0.759746927) = 16*-0.759746927 = -12.1559... -> rounds to -12
      expect(calculatePuzzleEloChange(1200, 1000, false, 0, false, undefined)).toBe(-12)
    })
  })

  describe('solved with no penalties', () => {
    it('uses a full score of 1.0 with K=20 when attempts=0 and no hint', () => {
      // calculateEloChange(1000, 1000, 1, 20) = 10
      expect(calculatePuzzleEloChange(1000, 1000, true, 0, false, undefined)).toBe(10)
    })
  })

  describe('attempts penalty', () => {
    it('reduces score by 0.15 per attempt (attempts=1 -> score 0.85)', () => {
      // K*(0.85-0.5) = 20*0.35 = 7
      expect(calculatePuzzleEloChange(1000, 1000, true, 1, false, undefined)).toBe(7)
    })

    it('reduces score by 0.15 per attempt (attempts=3 -> score 0.55)', () => {
      // K*(0.55-0.5) = 20*0.05 = 1
      expect(calculatePuzzleEloChange(1000, 1000, true, 3, false, undefined)).toBe(1)
    })

    it('does not yet floor at attempts=4 (score=0.4, above the 0.3 floor)', () => {
      // K*(0.4-0.5) = 20*-0.1 = -2
      expect(calculatePuzzleEloChange(1000, 1000, true, 4, false, undefined)).toBe(-2)
    })

    it('floors the penalty at 0.3 starting at attempts=5 (raw would be 0.25)', () => {
      // max(0.3, 1-0.75) = 0.3; K*(0.3-0.5) = 20*-0.2 = -4
      expect(calculatePuzzleEloChange(1000, 1000, true, 5, false, undefined)).toBe(-4)
    })

    it('stays at the 0.3 floor for even more attempts (attempts=10)', () => {
      // max(0.3, 1-1.5) = max(0.3, -0.5) = 0.3 -> same -4 as attempts=5
      expect(calculatePuzzleEloChange(1000, 1000, true, 10, false, undefined)).toBe(-4)
    })

    it('applies no penalty for nonsensical negative attempts (attempts>0 guard fails)', () => {
      // -1 > 0 is false, so the attempts branch is skipped entirely -> same
      // as the zero-attempts baseline (10), not some negative-penalty math.
      expect(calculatePuzzleEloChange(1000, 1000, true, -1, false, undefined)).toBe(10)
    })
  })

  describe('hint penalty', () => {
    it('multiplies the (unpenalized) score by 0.6 when attempts=0', () => {
      // 1.0*0.6 = 0.6; K*(0.6-0.5) = 20*0.1 = 2
      expect(calculatePuzzleEloChange(1000, 1000, true, 0, true, undefined)).toBe(2)
    })

    it('stacks with the attempts penalty (attempts=1 -> 0.85*0.6=0.51)', () => {
      // K*(0.51-0.5) = 20*0.01 = 0.2 -> rounds to 0
      expect(calculatePuzzleEloChange(1000, 1000, true, 1, true, undefined)).toBe(0)
    })

    it('stacks with the attempts penalty (attempts=3 -> 0.55*0.6=0.33)', () => {
      // K*(0.33-0.5) = 20*-0.17 = -3.4 -> rounds to -3
      expect(calculatePuzzleEloChange(1000, 1000, true, 3, true, undefined)).toBe(-3)
    })

    it('does not yet floor at attempts=4 (0.4*0.6=0.24, above the 0.2 floor)', () => {
      // K*(0.24-0.5) = 20*-0.26 = -5.2 -> rounds to -5
      expect(calculatePuzzleEloChange(1000, 1000, true, 4, true, undefined)).toBe(-5)
    })

    it('floors the hint penalty at 0.2 once the attempts floor is active (attempts=5: 0.3*0.6=0.18)', () => {
      // max(0.2, 0.18) = 0.2; K*(0.2-0.5) = 20*-0.3 = -6
      expect(calculatePuzzleEloChange(1000, 1000, true, 5, true, undefined)).toBe(-6)
    })
  })

  describe('speed bonus', () => {
    it('only applies when puzzleRating >= playerElo (harder puzzle, instant solve)', () => {
      // puzzleRating(1200) >= playerElo(1000): bonus applies.
      // expected = 1/(1+10^0.5) = 0.240252676...
      // raw = (30000-0)/30000 = 1 -> capped at MAX_SPEED_BONUS 0.3
      // score = 1.0 * 1.3 = 1.3
      // K*(1.3-0.240252676) = 20*1.059747324 = 21.1949... -> rounds to 21
      expect(calculatePuzzleEloChange(1000, 1200, true, 0, false, 0)).toBe(21)
    })

    it('does NOT apply when the puzzle is easier than the player (puzzleRating < playerElo)', () => {
      // puzzleRating(1000) < playerElo(1200): bonus branch is skipped even
      // though solveTimeMs=0 would otherwise earn the max bonus.
      // expected = 1/(1+10^-0.5) = 0.759746927...
      // score stays 1.0 -> K*(1-0.759746927) = 20*0.240252676 = 4.805... -> 5
      expect(calculatePuzzleEloChange(1200, 1000, true, 0, false, 0)).toBe(5)
    })

    it('applies exactly at the puzzleRating === playerElo boundary ("at or above")', () => {
      // Equal ratings qualify (>=), so the instant solve gets the full
      // capped bonus: score = 1.0 * 1.3 = 1.3
      // expected = 0.5; K*(1.3-0.5) = 20*0.8 = 16
      expect(calculatePuzzleEloChange(1000, 1000, true, 0, false, 0)).toBe(16)
    })

    it('caps the bonus at +30% even well inside the decay window (t=21000ms, raw=0.3)', () => {
      // raw = (30000-21000)/30000 = 0.3 -> exactly at the cap, same result
      // as the instant solve (t=0) for this rating pair: 21
      expect(calculatePuzzleEloChange(1000, 1200, true, 0, false, 21000)).toBe(21)
    })

    it('decays linearly below the cap once inside the last 9s of the window (t=25000ms)', () => {
      // raw = (30000-25000)/30000 = 0.166666...  (below the 0.3 cap, so the
      // linear decay actually shows up here)
      // score = 1 * 1.166666... = 1.166666...
      // K*(1.166666-0.240252676) = 20*0.926413991 = 18.528... -> rounds to 19
      expect(calculatePuzzleEloChange(1000, 1200, true, 0, false, 25000)).toBe(19)
    })

    it('gives zero bonus exactly at the 30-second window edge', () => {
      // raw = (30000-30000)/30000 = 0; score stays 1.0
      // K*(1-0.240252676) = 20*0.759747324 = 15.1949... -> rounds to 15
      expect(calculatePuzzleEloChange(1000, 1200, true, 0, false, 30000)).toBe(15)
    })

    it('clamps the bonus to zero (not negative) beyond the window (t=30001ms)', () => {
      // raw would be slightly negative; Math.max(0, ...) clamps it to 0,
      // giving the identical result to the t=30000 boundary: 15
      expect(calculatePuzzleEloChange(1000, 1200, true, 0, false, 30001)).toBe(15)
    })

    it('skips the bonus entirely for a negative solveTimeMs (guarded by the >=0 check)', () => {
      // solveTimeMs=-100 fails the `solveTimeMs >= 0` guard, so the whole
      // branch is skipped -> same baseline as no solveTimeMs at all: 15
      expect(calculatePuzzleEloChange(1000, 1200, true, 0, false, -100)).toBe(15)
    })

    it('skips the bonus when solveTimeMs is a non-number (typeof guard), even if numerically valid', () => {
      // "0" is not `typeof === 'number'`, so the bonus branch never runs,
      // even though Number("0") would satisfy `>= 0`.
      expect(calculatePuzzleEloChange(1000, 1200, true, 0, false, '0')).toBe(15)
    })

    it('skips the bonus when solveTimeMs is NaN (typeof number, but NaN >= 0 is false)', () => {
      expect(calculatePuzzleEloChange(1000, 1200, true, 0, false, NaN)).toBe(15)
    })

    it('stacks attempts penalty + hint penalty + capped speed bonus together', () => {
      // attempts=2: max(0.3, 1-0.3) = 0.7
      // hint: max(0.2, 0.7*0.6) = max(0.2, 0.42) = 0.42
      // speed: puzzleRating(1200) >= playerElo(1000); raw=(30000-10000)/30000=0.6667,
      //        capped at 0.3 -> score = 0.42*1.3 = 0.546
      // expected = 0.240252676; K*(0.546-0.240252676) = 20*0.305747324 = 6.1149... -> 6
      expect(calculatePuzzleEloChange(1000, 1200, true, 2, true, 10000)).toBe(6)
    })
  })
})

describe('getZone', () => {
  // Zone boundaries (min values): 0, 800, 1000, 1200, 1400, 1600, 1800.
  // getZone treats each zone's `min` as inclusive and belongs to the
  // *higher* zone at the exact boundary value.
  it('returns Trailhead below the lowest boundary, including negative ELO', () => {
    expect(getZone(-500).name).toBe('Trailhead')
    expect(getZone(0).name).toBe('Trailhead')
    expect(getZone(799).name).toBe('Trailhead')
  })

  it('crosses into Forest Path exactly at 800', () => {
    expect(getZone(800).name).toBe('Forest Path')
    expect(getZone(999).name).toBe('Forest Path')
  })

  it('crosses into Ridge Line exactly at 1000', () => {
    expect(getZone(1000).name).toBe('Ridge Line')
    expect(getZone(1199).name).toBe('Ridge Line')
  })

  it('crosses into Alpine Zone exactly at 1200', () => {
    expect(getZone(1200).name).toBe('Alpine Zone')
    expect(getZone(1399).name).toBe('Alpine Zone')
  })

  it('crosses into Snow Field exactly at 1400', () => {
    expect(getZone(1400).name).toBe('Snow Field')
    expect(getZone(1599).name).toBe('Snow Field')
  })

  it('crosses into Summit Push exactly at 1600', () => {
    expect(getZone(1600).name).toBe('Summit Push')
    expect(getZone(1799).name).toBe('Summit Push')
  })

  it('crosses into Peak exactly at 1800 and stays there above MAX_ELO', () => {
    expect(getZone(1800).name).toBe('Peak')
    expect(getZone(2400).name).toBe('Peak')
    expect(getZone(3000).name).toBe('Peak')
  })

  it('is consistent with the ALTITUDE_ZONES table shape', () => {
    expect(ALTITUDE_ZONES).toHaveLength(7)
    expect(ALTITUDE_ZONES[0].name).toBe('Trailhead')
    expect(ALTITUDE_ZONES[ALTITUDE_ZONES.length - 1].name).toBe('Peak')
  })

  it('falls back to the first zone for non-numeric input rather than throwing', () => {
    // NaN/undefined fail every `elo >= zone.min` comparison, so the loop
    // never returns early and the function falls through to
    // ALTITUDE_ZONES[0] (Trailhead) as its documented fallback.
    expect(getZone(NaN).name).toBe('Trailhead')
    expect(getZone(undefined).name).toBe('Trailhead')
  })
})

describe('getAltitudePercent', () => {
  it('is 0% at MIN_ELO and 100% at MAX_ELO', () => {
    expect(getAltitudePercent(MIN_ELO)).toBeCloseTo(0, 10)
    expect(getAltitudePercent(MAX_ELO)).toBeCloseTo(100, 10)
  })

  it('is 50% at the midpoint of the range', () => {
    // (1400-400)/(2400-400)*100 = 1000/2000*100 = 50
    expect(getAltitudePercent(1400)).toBeCloseTo(50, 10)
  })

  it('clamps below MIN_ELO to 0%', () => {
    expect(getAltitudePercent(200)).toBeCloseTo(0, 10)
    // one point below MIN_ELO: still clamped to exactly 0
    expect(getAltitudePercent(MIN_ELO - 1)).toBeCloseTo(0, 10)
  })

  it('clamps above MAX_ELO to 100%', () => {
    expect(getAltitudePercent(3000)).toBeCloseTo(100, 10)
    // one point above MAX_ELO: still clamped to exactly 100
    expect(getAltitudePercent(MAX_ELO + 1)).toBeCloseTo(100, 10)
  })

  it('computes the correct percent just inside each clamp boundary', () => {
    // (401-400)/2000*100 = 0.05
    expect(getAltitudePercent(MIN_ELO + 1)).toBeCloseTo(0.05, 10)
    // (2399-400)/2000*100 = 99.95
    expect(getAltitudePercent(MAX_ELO - 1)).toBeCloseTo(99.95, 10)
  })

  it('returns NaN for non-numeric input rather than throwing', () => {
    // Math.min/Math.max propagate NaN, so garbage input surfaces as NaN
    // instead of silently coercing to 0 or crashing.
    expect(Number.isNaN(getAltitudePercent(NaN))).toBe(true)
    expect(Number.isNaN(getAltitudePercent(undefined))).toBe(true)
  })
})

describe('module constants', () => {
  it('exposes the documented rating bounds and starting ELO', () => {
    expect(MIN_ELO).toBe(400)
    expect(MAX_ELO).toBe(2400)
    expect(STARTING_ELO).toBe(800)
  })

  it('does NOT clamp calculateEloChange/calculatePuzzleEloChange results to MIN_ELO/MAX_ELO itself', () => {
    // Clamping is the caller's responsibility (see usePlayerProfile.js and
    // api/pente/puzzle-attempts.js, which both do
    // Math.max(MIN_ELO, Math.min(MAX_ELO, elo + delta)) after calling into
    // this module). Neither calculateEloChange nor calculatePuzzleEloChange
    // reference MIN_ELO/MAX_ELO at all, so a delta can push a hypothetical
    // resulting rating out of bounds and this module will not stop it.
    // Concretely: a player already sitting at MAX_ELO who wins an even game
    // still gets awarded +10 (same math as any other equal-rating win),
    // which would carry them to 2410 — past MAX_ELO — if a caller naively
    // applied it without clamping.
    const deltaAtCeiling = calculateEloChange(MAX_ELO, MAX_ELO, 1, 20)
    expect(deltaAtCeiling).toBe(10)
    expect(MAX_ELO + deltaAtCeiling).toBeGreaterThan(MAX_ELO)

    // Likewise a player below MIN_ELO is accepted and computed on as-is —
    // the function neither rejects nor clamps the input rating.
    expect(calculateEloChange(100, 100, 1, 20)).toBe(10)
  })
})
