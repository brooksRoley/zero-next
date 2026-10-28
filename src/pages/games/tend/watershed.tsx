import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { useSoundMuted } from 'src/components/SoundToggle'
import TendNav, { SampleBanner } from 'src/components/games/TendNav'
import CrossSection from 'src/components/games/watershed/CrossSection'
import FoodWeb from 'src/components/games/watershed/FoodWeb'
import AlpinePlay from 'src/components/games/watershed/AlpinePlay'
import FarmPlay from 'src/components/games/watershed/FarmPlay'
import KelpPlay from 'src/components/games/watershed/KelpPlay'
import { Sprite } from 'src/components/games/watershed/Sprites'
import { trackGame } from 'src/lib/analytics'
import {
  playYear,
  rewindYear,
  saveKelp,
  type KelpPlay as KelpState,
  type Protection,
} from 'src/lib/games/tend/kelp'
import {
  loadAlpine,
  newAlpinePlay,
  playGenerations,
  restartAlpine,
  rewindGenerations,
  saveAlpine,
  type AlpinePlay as AlpineState,
  type Heat,
} from 'src/lib/games/tend/alpine'
import { currentPhase, type Phase } from 'src/lib/games/tend/daylight'
import { setSoundscapeTier, startSoundscape, stopSoundscape } from 'src/lib/games/tend/soundscape'
import { loadFarm, newFarmPlay, plantSeason, rewindSeason, saveFarm, type FarmPlay as FarmState } from 'src/lib/games/tend/farm'
import { browserStorage as storage, readGardenProgress, readKelp } from 'src/lib/games/tend/progress'
import {
  ROLE_LABEL,
  stepsToUnlock,
  TIERS,
  unlockedTiers,
  type Card,
  type GardenProgress,
} from 'src/lib/games/tend/watershed'
import { absoluteUrl, route } from 'src/lib/routes'

const GAME = 'tend-watershed'
const LIGHT_LABEL = { full: 'Full sunlight', dim: 'Dim: too dark for photosynthesis', none: 'No sunlight' }

function InfoCard({ eyebrow, card, tone }: { eyebrow: string; card: Card; tone: 'lesson' | 'kitchen' }) {
  const frame = tone === 'kitchen' ? 'border-amber-800/60 bg-amber-950/25' : 'border-ink-700 bg-ink-900/50'
  return (
    <section className={`rounded-xl border p-4 text-sm ${frame}`}>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-400">{eyebrow}</p>
      <h3 className="mt-1 font-semibold text-ink-100">{card.title}</h3>
      <p className="mt-1 leading-relaxed text-ink-200">{card.body}</p>
      <a href={card.source} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-ink-400 underline underline-offset-2 hover:text-ink-200">
        {card.sourceLabel}
      </a>
    </section>
  )
}

export default function WatershedPage() {
  const router = useRouter()
  const sample = router.isReady && router.query.sample === '1'
  const [progress, setProgress] = useState<GardenProgress | null>(null)
  const [kelp, setKelp] = useState<KelpState | null>(null)
  const [alpine, setAlpine] = useState<AlpineState | null>(null)
  const [farm, setFarm] = useState<FarmState | null>(null)
  const [selected, setSelected] = useState('woodland')
  const [still, setStill] = useState(false)
  const [phase, setPhase] = useState<Phase>('day')
  // The background sound is off until the player turns it on; null = they tried while the site was muted.
  const [ambient, setAmbient] = useState<boolean | null>(false)
  const muted = useSoundMuted()
  const seen = useRef(new Set<string>())
  const detail = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!router.isReady) return
    // `?tier=kelp` opens straight onto a tier, so a link can point at one.
    const asked = router.query.tier
    if (typeof asked === 'string' && TIERS.some((t) => t.id === asked)) setSelected(asked)
    setPhase(currentPhase())
    const read = readGardenProgress(sample)
    setProgress(read)
    setKelp(readKelp(sample, read.checkins))
    // The sample plays in memory only; a player's slope and farm are kept in this browser.
    setAlpine((sample ? null : loadAlpine(storage())) ?? newAlpinePlay(sample ? 3 : Date.now() % 100000))
    setFarm((sample ? null : loadFarm(storage())) ?? newFarmPlay(sample ? 7 : Date.now() % 100000))
    setStill(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [router.isReady, router.query.tier, sample])

  // Every tier is open to read; the garden decides which ones are collected.
  const collected = progress ? unlockedTiers(progress) : new Set<string>()
  const tier = TIERS.find((t) => t.id === selected) ?? TIERS[0]
  const have = collected.has(tier.id)
  const stepsLeft = progress ? stepsToUnlock(tier, progress) : 0


  const updateKelp = (next: KelpState | null) => {
    if (!next) return
    setKelp(next)
    if (!sample) saveKelp(storage(), next)
  }
  const runKelp = (to: Protection) => {
    if (!kelp) return
    const next = playYear(kelp, to, sample)
    if (next) trackGame('game_start', GAME, { tier: 'kelp', protection: to, from: kelp.protection })
    if (next?.seen.barren && !kelp.seen.barren) trackGame('game_end', GAME, { tier: 'kelp', result: 'barren' })
    updateKelp(next)
  }

  const updateAlpine = (next: AlpineState) => {
    setAlpine(next)
    if (!sample) saveAlpine(storage(), next)
  }
  const runAlpine = (heat: Heat) => {
    if (!alpine) return
    trackGame('game_start', GAME, { tier: 'alpine', heat })
    updateAlpine(playGenerations(alpine, heat))
  }
  const updateFarm = (next: FarmState) => {
    setFarm(next)
    if (!sample) saveFarm(storage(), next)
  }
  const plantFarm = (saved: number[]) => {
    if (!farm) return
    trackGame('game_start', GAME, { tier: 'valley', saved: saved.length })
    updateFarm(plantSeason(farm, saved))
  }

  // The soundscape follows the selected tier, and stops when the page goes.
  useEffect(() => {
    if (ambient) setSoundscapeTier(selected)
  }, [ambient, selected])
  useEffect(() => () => stopSoundscape(), [])
  const toggleAmbient = () => {
    if (ambient) {
      stopSoundscape()
      setAmbient(false)
    } else {
      setAmbient(startSoundscape(selected) ? true : null)
    }
  }

  // On a phone the tier's details sit below the picture, so bring them into view after a tap.
  const select = (id: string) => {
    setSelected(id)
    // A tier counts as a learning stage the first time the player opens it (not the one shown on arrival).
    if (!seen.current.has(id)) {
      seen.current.add(id)
      trackGame('tutorial_stage_complete', GAME, { tier: id })
    }
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches) {
      detail.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    }
  }

  return (
    <main className="min-h-screen bg-ink-950 font-sans text-ink-100">
      <Head>
        <title>The Watershed — Tend | Brooks Roley</title>
        <meta
          name="description"
          content="California from the alpine peaks to the deep-sea floor: who eats whom, how energy moves, and how food reaches your table. Part of Tend."
        />
        <meta property="og:title" content="The Watershed — Tend | Brooks Roley" key="og:title" />
        <meta property="og:url" content={absoluteUrl('tendWatershed')} key="og:url" />
      </Head>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
        <TendNav current="watershed" sample={sample} />
        {sample && <SampleBanner page="watershed" />}
        <header className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">The Watershed</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-300 sm:text-base">
            California from the peaks to the sea floor. Sunlight feeds the food chain from the top down; in the dark,
            marine snow and seafloor chemicals feed it from the bottom up. Every tier is open to explore. Your garden sits
            in the oak woodland, and every field note or season it weathers adds one more tier to your collection.
          </p>
        </header>

        {!progress ? (
          <p className="text-ink-400">Reading your garden…</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-2xl border border-ink-800 md:self-start">
              <CrossSection
                collected={collected}
                selected={selected}
                stepsLeft={(t) => stepsToUnlock(t, progress)}
                onSelect={select}
                phase={phase}
              />
              <div className="flex items-center justify-between gap-3 border-t border-ink-800 px-3 py-2 text-xs">
                <button
                  type="button"
                  aria-pressed={!!ambient}
                  onClick={toggleAmbient}
                  className="shrink-0 whitespace-nowrap rounded-md border border-ink-700 px-2.5 py-1 text-ink-200 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300"
                >
                  {ambient ? (muted ? 'Soundscape on (muted)' : 'Soundscape on') : 'Play the soundscape'}
                </button>
                <span className="text-ink-500">
                  {ambient === null || (ambient && muted)
                    ? 'Sound is muted for the whole site.'
                    : 'Quieter and more muffled the deeper you go.'}
                </span>
              </div>
            </div>

            <div ref={detail} className="scroll-mt-4 space-y-6 md:sticky md:top-6 md:self-start">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-ink-400">{tier.span}</p>
                <h2 className="mt-1 text-2xl font-semibold">{tier.name}</h2>
                <p className="mt-1 text-sm text-ink-400">{LIGHT_LABEL[tier.light]}</p>
              </div>

              {!have && (
                <section className="rounded-xl border border-ink-800 p-3 text-sm text-ink-300">
                  <p>
                    Not in your collection yet: {stepsLeft} more {stepsLeft === 1 ? 'milestone' : 'milestones'} brings your
                    garden here. A milestone is a new field note (a new kind of plant in full bloom) or a weathered
                    season.{' '}
                    <Link href={route('tend').href} className="text-ink-200 underline underline-offset-2">
                      Go to the garden
                    </Link>
                  </p>
                </section>
              )}

              {tier.id === 'kelp' && kelp && (
                <KelpPlay
                  play={kelp}
                  unlimited={sample}
                  still={still}
                  onRun={runKelp}
                  onRewind={() => updateKelp(rewindYear(kelp, sample))}
                />
              )}

              {tier.id === 'alpine' && alpine && (
                <AlpinePlay
                  play={alpine}
                  onRun={runAlpine}
                  onRewind={() => updateAlpine(rewindGenerations(alpine))}
                  onRestart={() => updateAlpine(restartAlpine(alpine))}
                />
              )}
              {tier.id === 'valley' && farm && (
                <FarmPlay play={farm} onPlant={plantFarm} onRewind={() => updateFarm(rewindSeason(farm))} />
              )}

              <section className="rounded-xl border border-ink-800 bg-ink-900/30 p-3">
                <FoodWeb tier={tier} still={still} />
                <p className="px-1 pb-1 pt-2 text-xs leading-relaxed text-ink-400">
                  Energy flows left to right. Fewer dots make it along each link: on average only about 10% of the
                  energy at one level reaches the next.{' '}
                  <a
                    href="https://education.nationalgeographic.org/resource/energy-flow-and-10-percent-rule/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-ink-200"
                  >
                    National Geographic
                  </a>
                  {tier.residents.some((r) => r.id === 'seep') && (
                    <> Cyan dots carry energy from seafloor chemicals instead of sunlight.</>
                  )}
                </p>
              </section>

              <ul className="space-y-3">
                {tier.residents.map((r) => (
                  <li key={r.id} className="flex gap-3 text-sm">
                    <svg viewBox="0 0 40 40" width={36} height={36} className="shrink-0" aria-hidden overflow="visible">
                      <Sprite id={r.sprite} />
                    </svg>
                    <div>
                      <p className="font-medium">
                        {r.name} <span className="font-normal text-ink-500">· {ROLE_LABEL[r.role]}</span>
                      </p>
                      <p className="text-ink-300">
                        {r.line}{' '}
                        <a href={r.source} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-500 underline underline-offset-2 hover:text-ink-300">
                          source
                        </a>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <InfoCard eyebrow="How it works" card={tier.lesson} tone="lesson" />
              {tier.kitchen && <InfoCard eyebrow="From here to the table" card={tier.kitchen} tone="kitchen" />}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
