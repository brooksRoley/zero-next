import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import type { GardenState } from 'src/lib/games/tend/engine'
import { PETS, petSpots, type PetId } from 'src/lib/games/tend/pets'
import type { Cell } from 'src/lib/games/tend/plants'
import styles from './TendPets.module.css'

const C = 48 // must match TendBoard's cell size
const LINE = '#1d2a24'
const BLUSH = '#f4a3a8'

type Spot = { cell: Cell; flip: boolean }

// Same check as src/lib/motion (PR #64); switch to that import once it merges.
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const pick = <T,>(list: readonly T[]): T | undefined => list[Math.floor(Math.random() * list.length)]

/** Pika: an orange tabby, sitting. Drawn in a 48×48 cell. */
function Pika({ delay }: { delay: string }) {
  const fur = '#f0a04b'
  const stripe = '#cf7426'
  const cream = '#fde2b8'
  return (
    <g className={styles.bob} style={{ animationDelay: delay }}>
      <path className={styles.tail} style={{ animationDelay: delay }} d="M33 38c6 0 9-4 8-9" fill="none" stroke={fur} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={24} cy={35} rx={10.5} ry={8.5} fill={fur} stroke={LINE} strokeWidth={1.2} />
      <ellipse cx={24} cy={37} rx={5} ry={5} fill={cream} />
      <path d="M13.5 15.5 15.5 6l6.5 5.5Z M34.5 15.5 32.5 6 26 11.5Z" fill={fur} stroke={LINE} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M15.8 13 16.6 9l3 2.6Z M32.2 13 31.4 9l-3 2.6Z" fill="#f2b3a8" />
      <circle cx={24} cy={20.5} r={11} fill={fur} stroke={LINE} strokeWidth={1.2} />
      <path d="M21 11.5v3 M24 11v3.5 M27 11.5v3" stroke={stripe} strokeWidth={1.6} strokeLinecap="round" />
      <ellipse cx={24} cy={25} rx={5.5} ry={3.8} fill={cream} />
      <g className={styles.eyes} style={{ animationDelay: delay }}>
        <ellipse cx={19.5} cy={20.5} rx={1.6} ry={2.2} fill={LINE} />
        <ellipse cx={28.5} cy={20.5} rx={1.6} ry={2.2} fill={LINE} />
      </g>
      <circle cx={16.5} cy={24} r={1.8} fill={BLUSH} opacity={0.6} />
      <circle cx={31.5} cy={24} r={1.8} fill={BLUSH} opacity={0.6} />
      <path d="M23 23.2h2l-1 1.2Z" fill="#e0717a" />
      <path d="M22.3 25.4q1.7 1.2 1.7-.6 0 1.8 1.7.6" fill="none" stroke={LINE} strokeWidth={0.8} strokeLinecap="round" />
      <ellipse cx={20} cy={42.5} rx={2.6} ry={1.6} fill={fur} stroke={LINE} strokeWidth={1} />
      <ellipse cx={28} cy={42.5} rx={2.6} ry={1.6} fill={fur} stroke={LINE} strokeWidth={1} />
    </g>
  )
}

/** Nanu: a black-and-white tuxedo ("oreo") cat, sitting. */
function Nanu({ delay }: { delay: string }) {
  const fur = '#26262b'
  const white = '#f6f4ee'
  return (
    <g className={styles.bob} style={{ animationDelay: delay }}>
      {/* A soft grey rim so the black tail still reads against dark soil. */}
      <g className={styles.tail} style={{ animationDelay: delay }}>
        <path d="M33 38c6 0 9-4 8-9" fill="none" stroke="#5a5a63" strokeWidth={5.6} strokeLinecap="round" />
        <path d="M33 38c6 0 9-4 8-9" fill="none" stroke={fur} strokeWidth={3.6} strokeLinecap="round" />
      </g>
      <ellipse cx={24} cy={35} rx={10.5} ry={8.5} fill={fur} stroke="#111" strokeWidth={1.2} />
      <ellipse cx={24} cy={37} rx={5.2} ry={5.5} fill={white} />
      <path d="M13.5 15.5 15.5 6l6.5 5.5Z M34.5 15.5 32.5 6 26 11.5Z" fill={fur} stroke="#111" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M15.8 13 16.6 9l3 2.6Z M32.2 13 31.4 9l-3 2.6Z" fill="#e79aa3" />
      <circle cx={24} cy={20.5} r={11} fill={fur} stroke="#111" strokeWidth={1.2} />
      <path d="M24 14.5c-2 3-6 6-6.5 10.5h13c-.5-4.5-4.5-7.5-6.5-10.5Z" fill={white} />
      <g className={styles.eyes} style={{ animationDelay: delay }}>
        <ellipse cx={19.5} cy={20} rx={2} ry={2.4} fill="#c9e265" />
        <ellipse cx={28.5} cy={20} rx={2} ry={2.4} fill="#c9e265" />
        <ellipse cx={19.5} cy={20} rx={0.8} ry={1.9} fill="#111" />
        <ellipse cx={28.5} cy={20} rx={0.8} ry={1.9} fill="#111" />
      </g>
      <path d="M23 22.8h2l-1 1.2Z" fill="#e0717a" />
      <path d="M22.3 25q1.7 1.2 1.7-.6 0 1.8 1.7.6" fill="none" stroke="#444" strokeWidth={0.8} strokeLinecap="round" />
      <ellipse cx={20} cy={42.5} rx={2.6} ry={1.6} fill={white} stroke="#111" strokeWidth={1} />
      <ellipse cx={28} cy={42.5} rx={2.6} ry={1.6} fill={white} stroke="#111" strokeWidth={1} />
    </g>
  )
}

/** Nalu: a small, fluffy white dog with floppy ears. */
function Nalu({ delay }: { delay: string }) {
  const fur = '#fbfaf6'
  const shade = '#d9d3c7'
  const ear = '#efe6d6'
  return (
    <g className={styles.bob} style={{ animationDelay: delay }}>
      <g className={styles.wag}>
        <path d="M33 34c4-1 7-4 6-8" fill="none" stroke={shade} strokeWidth={5} strokeLinecap="round" />
        <path d="M33 34c4-1 7-4 6-8" fill="none" stroke={fur} strokeWidth={3.4} strokeLinecap="round" />
      </g>
      <ellipse cx={24} cy={35.5} rx={10.5} ry={8} fill={fur} stroke={shade} strokeWidth={1.4} />
      <circle cx={18} cy={11.5} r={3} fill={fur} stroke={shade} strokeWidth={1.2} />
      <circle cx={24} cy={10} r={3.2} fill={fur} stroke={shade} strokeWidth={1.2} />
      <circle cx={30} cy={11.5} r={3} fill={fur} stroke={shade} strokeWidth={1.2} />
      <circle cx={24} cy={20.5} r={10.5} fill={fur} stroke={shade} strokeWidth={1.4} />
      <ellipse cx={13.8} cy={21.5} rx={3.4} ry={6.2} transform="rotate(14 13.8 21.5)" fill={ear} stroke={shade} strokeWidth={1.2} />
      <ellipse cx={34.2} cy={21.5} rx={3.4} ry={6.2} transform="rotate(-14 34.2 21.5)" fill={ear} stroke={shade} strokeWidth={1.2} />
      <g className={styles.eyes} style={{ animationDelay: delay }}>
        <circle cx={20} cy={20} r={1.9} fill={LINE} />
        <circle cx={28} cy={20} r={1.9} fill={LINE} />
        <circle cx={20.6} cy={19.4} r={0.6} fill="#fff" />
        <circle cx={28.6} cy={19.4} r={0.6} fill="#fff" />
      </g>
      <circle cx={17} cy={24} r={1.7} fill={BLUSH} opacity={0.5} />
      <circle cx={31} cy={24} r={1.7} fill={BLUSH} opacity={0.5} />
      <ellipse cx={24} cy={24} rx={2} ry={1.5} fill={LINE} />
      <path d="M22.6 26.3q1.4 1 1.4-.4 0 1.4 1.4.4" fill="none" stroke={LINE} strokeWidth={0.8} strokeLinecap="round" />
      <path d="M23.1 27.2q.9 2.6 1.8 0Z" fill="#ef8f9a" />
      <ellipse cx={20} cy={42.5} rx={2.6} ry={1.6} fill={fur} stroke={shade} strokeWidth={1} />
      <ellipse cx={28} cy={42.5} rx={2.6} ry={1.6} fill={fur} stroke={shade} strokeWidth={1} />
    </g>
  )
}

const SPRITES: Record<PetId, (p: { delay: string }) => ReactElement> = { nalu: Nalu, pika: Pika, nanu: Nanu }
const DELAYS: Record<PetId, string> = { nalu: '0s', pika: '-0.9s', nanu: '-1.7s' }

/**
 * The garden's three residents. Each sits on open soil it likes and avoids
 * plants that are toxic to it; every so often one wanders to another spot.
 * Rendered inside TendBoard's SVG, on top of the beds.
 */
export default function TendPets({ garden, inert }: { garden: GardenState; inert: boolean }) {
  const [spots, setSpots] = useState<Partial<Record<PetId, Spot>>>({})
  const gardenRef = useRef(garden)
  gardenRef.current = garden

  // Seat (or reseat) any pet whose spot is missing or no longer open and safe.
  useEffect(() => {
    setSpots((prev) => {
      const next: Partial<Record<PetId, Spot>> = {}
      for (const pet of PETS) {
        const taken = Object.values(next).map((s) => s!.cell)
        const options = petSpots(garden, pet, taken)
        const current = prev[pet.id]
        const stillGood = current && options.some(([x, y]) => x === current.cell[0] && y === current.cell[1])
        const cell = stillGood ? current.cell : pick(options)
        if (cell) next[pet.id] = { cell, flip: stillGood ? current.flip : Math.random() < 0.5 }
      }
      return next
    })
  }, [garden])

  // Now and then, one pet wanders to another spot it likes.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const id = window.setInterval(() => {
      setSpots((prev) => {
        const pet = pick(PETS)
        if (!pet) return prev
        const taken = PETS.filter((p) => p.id !== pet.id).flatMap((p) => (prev[p.id] ? [prev[p.id]!.cell] : []))
        const cell = pick(petSpots(gardenRef.current, pet, taken))
        return cell ? { ...prev, [pet.id]: { cell, flip: cell[0] < (prev[pet.id]?.cell[0] ?? cell[0]) } } : prev
      })
    }, 6500)
    return () => window.clearInterval(id)
  }, [])

  return (
    <g pointerEvents={inert ? 'none' : undefined}>
      {PETS.map((pet) => {
        const spot = spots[pet.id]
        if (!spot) return null
        const Sprite = SPRITES[pet.id]
        const style: CSSProperties = { transform: `translate(${spot.cell[0] * C}px, ${spot.cell[1] * C}px)` }
        return (
          <g key={pet.id} className={styles.pet} style={style}>
            <title>{pet.habit}</title>
            <g transform={spot.flip ? `translate(${C} 0) scale(-1 1)` : undefined}>
              <Sprite delay={DELAYS[pet.id]} />
            </g>
          </g>
        )
      })}
    </g>
  )
}
