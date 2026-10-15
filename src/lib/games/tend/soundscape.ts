import { getAudioContext } from 'src/lib/ui/audioContext'
import { PENTATONIC } from './sounds'
import { SEA_LEVEL_INDEX, TIERS } from './watershed'

/**
 * A quiet sound bed for each Watershed tier, all made in the browser: wind on
 * the peaks, birds in the woodland, surf at the tidepools, a low hum in the
 * deep. Everything passes through one low-pass filter that closes as you go
 * down, so the deeper the tier, the more muffled it sounds.
 *
 * Off until the player turns it on, and silent under the site-wide mute.
 */

export type Layer = 'wind' | 'birds' | 'surf' | 'hum'
export const LAYERS: Layer[] = ['wind', 'birds', 'surf', 'hum']

/** How loud each layer is in each tier, from 0 to 1. */
export const MIX: Record<string, Record<Layer, number>> = {
  alpine: { wind: 1, birds: 0, surf: 0, hum: 0 },
  subalpine: { wind: 0.7, birds: 0.5, surf: 0, hum: 0 },
  woodland: { wind: 0.25, birds: 1, surf: 0, hum: 0 },
  valley: { wind: 0.35, birds: 0.5, surf: 0, hum: 0 },
  coast: { wind: 0.2, birds: 0.15, surf: 1, hum: 0 },
  kelp: { wind: 0, birds: 0, surf: 0.7, hum: 0.3 },
  open: { wind: 0, birds: 0, surf: 0.4, hum: 0.6 },
  twilight: { wind: 0, birds: 0, surf: 0.1, hum: 0.9 },
  deep: { wind: 0, birds: 0, surf: 0, hum: 1 },
}

/** The filter's cutoff for a tier: wide open on land, closing with each step below the surface. */
export function cutoffFor(tierId: string): number {
  const i = TIERS.findIndex((t) => t.id === tierId)
  const below = Math.max(0, i - SEA_LEVEL_INDEX + 1)
  return Math.round(9000 / 2 ** (below * 1.15))
}

const LEVEL = 0.12
const FADE = 1.2

type Bed = {
  ctx: AudioContext
  out: GainNode
  filter: BiquadFilterNode
  layers: Record<Layer, GainNode>
  sources: AudioScheduledSourceNode[]
  birdTimer: number | null
  tier: string
}

let bed: Bed | null = null

function loopedNoise(ctx: AudioContext, seconds = 4): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let brown = 0
  for (let i = 0; i < data.length; i++) {
    // Brown-ish noise: softer and rounder than white noise.
    brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02
    data[i] = brown * 3.5
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  return source
}

/** A slow swell, so wind gusts and waves come and go. */
function swell(ctx: AudioContext, target: AudioParam, rate: number, depth: number): OscillatorNode {
  const lfo = ctx.createOscillator()
  lfo.frequency.value = rate
  const amount = ctx.createGain()
  amount.gain.value = depth
  lfo.connect(amount).connect(target)
  lfo.start()
  return lfo
}

function chirp(b: Bed) {
  const { ctx } = b
  const now = ctx.currentTime
  const base = PENTATONIC[5 + Math.floor(Math.random() * 5)] * 2
  const notes = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < notes; i++) {
    const at = now + i * 0.09
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(base, at)
    osc.frequency.exponentialRampToValueAtTime(base * 1.25, at + 0.06)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(0.25, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.08)
    osc.connect(g).connect(b.layers.birds)
    osc.start(at)
    osc.stop(at + 0.1)
  }
}

function build(ctx: AudioContext, tier: string): Bed {
  const out = ctx.createGain()
  out.gain.value = 0
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = cutoffFor(tier)
  filter.connect(out).connect(ctx.destination)

  const layers = Object.fromEntries(
    LAYERS.map((l) => {
      const g = ctx.createGain()
      g.gain.value = MIX[tier]?.[l] ?? 0
      g.connect(filter)
      return [l, g]
    }),
  ) as Record<Layer, GainNode>

  const sources: AudioScheduledSourceNode[] = []

  // Wind: band-passed noise with slow gusts.
  const wind = loopedNoise(ctx)
  const windBand = ctx.createBiquadFilter()
  windBand.type = 'bandpass'
  windBand.frequency.value = 500
  windBand.Q.value = 0.7
  const windGust = ctx.createGain()
  windGust.gain.value = 0.6
  wind.connect(windBand).connect(windGust).connect(layers.wind)
  sources.push(wind, swell(ctx, windGust.gain, 0.09, 0.4))

  // Surf: low noise that swells and falls like waves.
  const surf = loopedNoise(ctx)
  const surfLow = ctx.createBiquadFilter()
  surfLow.type = 'lowpass'
  surfLow.frequency.value = 900
  const surfSwell = ctx.createGain()
  surfSwell.gain.value = 0.55
  surf.connect(surfLow).connect(surfSwell).connect(layers.surf)
  sources.push(surf, swell(ctx, surfSwell.gain, 0.13, 0.45))

  // Hum: two low notes a fifth apart (C2 and G2), breathing slowly.
  for (const f of [PENTATONIC[0] / 4, PENTATONIC[3] / 4]) {
    const osc = ctx.createOscillator()
    osc.frequency.value = f
    const g = ctx.createGain()
    g.gain.value = 0.35
    osc.connect(g).connect(layers.hum)
    osc.start()
    sources.push(osc, swell(ctx, g.gain, 0.05, 0.15))
  }

  wind.start()
  surf.start()

  const b: Bed = { ctx, out, filter, layers, sources, birdTimer: null, tier }
  b.birdTimer = window.setInterval(() => {
    // While the site is muted the context is suspended; scheduling chirps then would queue them all for unmute.
    if (b.ctx.state !== 'running') return
    if (b.layers.birds.gain.value > 0.05 && Math.random() < 0.45) chirp(b)
  }, 900)
  return b
}

/** Start the sound bed on a tier. Does nothing without Web Audio, or while the site is muted. */
export function startSoundscape(tier: string): boolean {
  try {
    if (bed) {
      setSoundscapeTier(tier)
      return true
    }
    const ctx = getAudioContext()
    if (!ctx) return false
    bed = build(ctx, tier)
    bed.out.gain.setValueAtTime(0, ctx.currentTime)
    bed.out.gain.linearRampToValueAtTime(LEVEL, ctx.currentTime + FADE)
    return true
  } catch {
    bed = null
    return false
  }
}

/** Crossfade to another tier's mix and depth. */
export function setSoundscapeTier(tier: string) {
  if (!bed || bed.tier === tier) return
  const now = bed.ctx.currentTime
  for (const l of LAYERS) bed.layers[l].gain.linearRampToValueAtTime(MIX[tier]?.[l] ?? 0, now + FADE)
  bed.filter.frequency.exponentialRampToValueAtTime(cutoffFor(tier), now + FADE)
  bed.tier = tier
}

export function stopSoundscape() {
  if (!bed) return
  const b = bed
  bed = null
  try {
    const now = b.ctx.currentTime
    b.out.gain.linearRampToValueAtTime(0, now + 0.4)
    if (b.birdTimer) window.clearInterval(b.birdTimer)
    window.setTimeout(() => {
      b.sources.forEach((s) => {
        try {
          s.stop()
        } catch {
          /* already stopped */
        }
      })
      b.out.disconnect()
    }, 500)
  } catch {
    /* context gone */
  }
}
