import { getAudioContext } from 'src/lib/ui/audioContext'
import type { PlantKind } from './plants'

/**
 * Tend's sounds, all synthesised in the browser. Every pitched note comes
 * from one C major pentatonic scale (C D E G A), which has no semitone steps,
 * so sounds that overlap never clash. Nothing plays until the player clicks,
 * and the site-wide mute silences all of it.
 */

/** C major pentatonic, C4 up to A5, in Hz. */
export const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0] as const

/** Each plant has its own note, so a garden planted over a week plays a little tune. */
const PLANT_NOTE: Record<PlantKind, number> = { oak: 0, vine: 1, moonflower: 2, sunflower: 3, fern: 4 }

export function noteFor(kind: PlantKind): number {
  return PENTATONIC[PLANT_NOTE[kind] + 5]
}

/** A rising music-box phrase: one note per seed earned, plus a first note, so an empty day still plays two. */
export function checkInPhrase(seeds: number): number[] {
  const length = Math.min(PENTATONIC.length - 4, Math.max(2, seeds + 1))
  return PENTATONIC.slice(4, 4 + length)
}

/** The gentle "nuh-uh" of a spot that doesn't fit: two soft notes, falling. */
export const REFUSE_NOTES = [PENTATONIC[2], PENTATONIC[0]] as const

/** The pets' voices, start and end pitch: a "boof" falls from G3 to C3, a "mrrp" rises from E4 to G4. */
export const PET_NOTES = { boof: [196.0, 130.81], mrrp: [329.63, 392.0] } as const

/** A first bloom: a quick sparkle at the top of the scale. */
export const BLOOM_NOTES = [PENTATONIC[6], PENTATONIC[7], PENTATONIC[8], PENTATONIC[9]] as const

type Ctx = AudioContext

function tone(ctx: Ctx, freq: number, at: number, length: number, peak: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(peak, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.001, at + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

function noise(ctx: Ctx, at: number, length: number, peak: number, filter: BiquadFilterType, freq: number) {
  const size = Math.ceil(ctx.sampleRate * length)
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size) ** 4
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const shape = ctx.createBiquadFilter()
  shape.type = filter
  shape.frequency.value = freq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + length)
  source.connect(shape).connect(gain).connect(ctx.destination)
  source.start(at)
  source.stop(at + length)
}

/** Soil settling: a low, muffled thump. */
function thump(ctx: Ctx, at: number) {
  noise(ctx, at, 0.09, 0.22, 'lowpass', 420)
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(150, at)
  osc.frequency.exponentialRampToValueAtTime(60, at + 0.1)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.18, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.12)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + 0.14)
}

/** A pitch that slides from one note to another, for the pets' voices. */
function slide(ctx: Ctx, from: number, to: number, at: number, length: number, peak: number, type: OscillatorType, wobble = 0) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + length * 0.8)
  if (wobble) {
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = 22
    depth.gain.value = wobble
    lfo.connect(depth).connect(osc.frequency)
    lfo.start(at)
    lfo.stop(at + length)
  }
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(peak, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, at + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

/** A purr: low noise pulsing about 25 times a second. */
function purr(ctx: Ctx, at: number) {
  const length = 0.9
  const size = Math.ceil(ctx.sampleRate * length)
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < size; i++) {
    const t = i / ctx.sampleRate
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * 25 * t)
    const envelope = Math.sin((Math.PI * i) / size)
    data[i] = (Math.random() * 2 - 1) * pulse * envelope
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const shape = ctx.createBiquadFilter()
  shape.type = 'lowpass'
  shape.frequency.value = 320
  const gain = ctx.createGain()
  gain.gain.value = 0.3
  source.connect(shape).connect(gain).connect(ctx.destination)
  source.start(at)
}

function play(draw: (ctx: Ctx, now: number) => void) {
  try {
    const ctx = getAudioContext()
    if (ctx) draw(ctx, ctx.currentTime)
  } catch {
    /* Web Audio unsupported or blocked: the game is silent, not broken */
  }
}

export const tendSounds = {
  place: (kind: PlantKind) =>
    play((ctx, now) => {
      thump(ctx, now)
      tone(ctx, noteFor(kind), now + 0.03, 0.45, 0.12, 'triangle')
    }),
  rotate: () => play((ctx, now) => noise(ctx, now, 0.025, 0.16, 'highpass', 2600)),
  refuse: () =>
    play((ctx, now) => REFUSE_NOTES.forEach((f, i) => tone(ctx, f, now + i * 0.11, 0.16, 0.08, 'triangle'))),
  compost: () => play((ctx, now) => thump(ctx, now)),
  checkIn: (seeds: number) =>
    play((ctx, now) =>
      checkInPhrase(seeds).forEach((f, i) => {
        tone(ctx, f, now + i * 0.13, 0.7, 0.09, 'sine')
        tone(ctx, f * 2, now + i * 0.13, 0.35, 0.025, 'sine')
      }),
    ),
  bloom: () => play((ctx, now) => BLOOM_NOTES.forEach((f, i) => tone(ctx, f, now + i * 0.06, 0.5, 0.06, 'sine'))),
  /** Nalu says "boof"; Pika trills "mrrp"; Nanu purrs. */
  pet: (species: 'dog' | 'cat', id: string) =>
    play((ctx, now) => {
      if (species === 'dog') {
        slide(ctx, PET_NOTES.boof[0], PET_NOTES.boof[1], now, 0.18, 0.2, 'triangle')
        noise(ctx, now, 0.06, 0.08, 'lowpass', 900)
      } else if (id === 'nanu') {
        purr(ctx, now)
      } else {
        slide(ctx, PET_NOTES.mrrp[0], PET_NOTES.mrrp[1], now, 0.28, 0.07, 'sine', 18)
      }
    }),
}
