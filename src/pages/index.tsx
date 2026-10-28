import dynamic from 'next/dynamic'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import Reveal from 'src/components/Reveal'
import TiltCard from 'src/components/TiltCard'
import { AVAILABILITY, HERO_SUMMARY } from 'src/lib/resume'
import { route } from 'src/lib/routes'

const PhysicsField = dynamic(() => import('src/components/PhysicsField'), {
  loading: () => <div className="physics-field-grid" />,
})

// Server-rendered: the `featured` prop carries the primary "Work with me" CTA and
// every Featured card, so this must not be ssr:false — crawlers and no-JS clients
// would see only the fallback below. matter-js and PreText are both SSR-safe (all
// browser APIs live inside effects), so the physics layer mounts as a client-side
// enhancement on top of real server HTML. Same pattern as PhysicsField above.
const PhysicsHero = dynamic(() => import('src/components/PhysicsHero'), {
  loading: () => (
    <section className="terrain-hero relative overflow-hidden text-[#E9E3D6]">
      <div className="relative z-10 mx-auto flex min-h-[74vh] max-w-6xl flex-col justify-center gap-10 px-4 py-16 sm:px-6 md:min-h-[82vh] md:flex-row md:items-center md:gap-14 md:py-20">
        <div className="max-w-2xl md:flex-[1.05]">
          <h1 className="text-[clamp(3.35rem,9vw,6.8rem)] font-extrabold leading-none text-[#E9E3D6]">Brooks Roley</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#E9E3D6]/80 sm:text-lg sm:leading-8">
            {HERO_SUMMARY}{' '}
            <span className="font-medium text-[#DED9CE]">{AVAILABILITY}</span>
          </p>
        </div>
      </div>
    </section>
  ),
})

const ArrowIcon = () => (
  <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
)

const ExternalIcon = () => (
  <svg className="w-3.5 h-3.5 opacity-40 transition-opacity duration-200 group-hover:opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
)

const SectionHeading = ({ number, label }: { number: string; label: string }) => (
  <div className="flex items-baseline gap-3 mb-5 sm:mb-7">
    <span className="font-mono text-xs tracking-wider text-[#B1ADA8]/85">{number}</span>
    <span className="h-px flex-none w-6 bg-[#DED9CE]/30" aria-hidden />
    <h2 className="text-sm font-semibold uppercase tracking-widest text-[#E9E3D6]/88">
      {label}
    </h2>
  </div>
)

export default function Home() {
  const cardBase = "group relative block overflow-hidden rounded-xl border border-[#DED9CE]/14 bg-[#2F3C50]/18 text-[#E9E3D6] card-hover-border backdrop-blur-sm"

  return (
    <main className="min-h-screen terrain-page-bg font-sans">
      <Head>
        <title>Brooks Roley | Software Engineer</title>
      </Head>
      <PhysicsHero
        featured={
          <>
            <SectionHeading number="01" label="Featured" />
            <Reveal>
              <p className="mb-6 sm:mb-8 max-w-2xl text-sm sm:text-base text-[#E9E3D6]/78 leading-relaxed">
                Selected work: a sports data platform, the game engine and tools built on it, and the rest of the games in one place.
              </p>
            </Reveal>
            <PhysicsField className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <div data-physics-item className="physics-field-item">
                <Reveal delay={100}>
                  <TiltCard>
                    <Link href={route('resume').href} className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden">
                        <Image src="/cover.png" alt="Brooks Roley" fill className="object-cover opacity-60 card-img-hover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/78 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Resume <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#E9E3D6]/68">
                          Learn more about my experiences and background.
                        </p>
                      </div>
                      <div className="tilt-highlight" />
                    </Link>
                  </TiltCard>
                </Reveal>
              </div>

              <div data-physics-item className="physics-field-item">
                <Reveal delay={200}>
                  <TiltCard>
                    <Link href={route('basketballPlatform').href} className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#552583]">
                        <Image src="/BRBaller.png" alt="Basketball Data Platform" width={140} height={70} className="object-contain opacity-70 card-img-hover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/72 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Basketball Data Platform <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#E9E3D6]/68">
                          Full-stack NBA system. Python API, C++ WASM engine, Vue 3 game, SwiftUI iOS.
                        </p>
                      </div>
                      <div className="tilt-highlight" />
                    </Link>
                  </TiltCard>
                </Reveal>
              </div>

              <div data-physics-item className="physics-field-item">
                <Reveal delay={300}>
                  <TiltCard>
                    <Link href={route('hardwood').href} className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#552583]">
                        <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#E9E3D6]/70">Engine · Client · Launcher</span>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/72 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Hardwood Autochess <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#E9E3D6]/68">
                          An NBA auto-battler: a C++ engine compiled to WebAssembly under a Vue 3 client, with a desktop launcher that ships only the chunks that changed.
                        </p>
                      </div>
                      <div className="tilt-highlight" />
                    </Link>
                  </TiltCard>
                </Reveal>
              </div>

              <div data-physics-item className="physics-field-item">
                <Reveal delay={400}>
                  <TiltCard>
                    <Link href={route('tradeMachine').href} className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#141F30]">
                        <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#E9E3D6]/70">Payroll · Cap · Aprons</span>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/72 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Trade Machine <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#E9E3D6]/68">
                          NBA salary-cap explorer — build trades, test CBA legality, and see the cap math for 2026-27.
                        </p>
                      </div>
                      <div className="tilt-highlight" />
                    </Link>
                  </TiltCard>
                </Reveal>
              </div>

              <div data-physics-item className="physics-field-item">
                <Reveal delay={500}>
                  <TiltCard>
                    <Link href={route('nba').href} className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#141F30]">
                        <div className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-full bg-[#DED9CE]" />
                          <div className="h-3 w-3 rounded-full bg-[#E9E3D6]" />
                          <div className="h-3 w-3 rounded-full bg-[#B1ADA8]" />
                          <div className="h-3 w-3 rounded-full bg-[#966F2F]" />
                          <div className="h-3 w-3 rounded-full bg-[#2F3C50]" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/72 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          NBA Explorer <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#E9E3D6]/68">
                          Live NBA stats, standings, player analytics, and team dashboards. Interactive node graph.
                        </p>
                      </div>
                      <div className="tilt-highlight" />
                    </Link>
                  </TiltCard>
                </Reveal>
              </div>

              <div data-physics-item className="physics-field-item">
                <Reveal delay={600}>
                  <TiltCard>
                    <Link href={route('theater').href} className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-brass-900 via-ink-900 to-ink-950">
                        <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#E9E3D6]/70">Every game, one stage</span>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/72 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          The Zero Theater <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#E9E3D6]/68">
                          Every game on this site, staged as a production — duels, trials, seasons. Admission free.
                        </p>
                      </div>
                      <div className="tilt-highlight" />
                    </Link>
                  </TiltCard>
                </Reveal>
              </div>
            </PhysicsField>
          </>
        }
      />

      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* ── Projects ── */}
        <section className="border-t border-[#DED9CE]/10 py-10 sm:py-12 md:py-16">
          <Reveal>
            <SectionHeading number="02" label="Projects" />
          </Reveal>
          <PhysicsField className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            {/* The Rig Report */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={100}>
                <TiltCard>
                  <Link href={route('rigReport').href} className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#141F30]">
                      <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#E9E3D6]/70">Implied odds · The vig</span>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/72 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        The Rig Report <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#E9E3D6]/68">
                        A satirical NBA &ldquo;rigging&rdquo; inspector that teaches real odds math — the vig, base rates, line movement.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

            {/* Model Arena */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={200}>
                <TiltCard>
                  <Link href={route('modelArena').href} className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#2F3C50]/34">
                      <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#E9E3D6]/70">Blind A/B · Latency</span>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/72 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        Model Arena <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#E9E3D6]/68">
                        Compare AI models side by side. Blind battles, speed stats, leaderboard.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

            {/* Luminous Flow */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={300}>
                <TiltCard>
                  <Link href={route('luminousFlow').href} className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden">
                      <Image src="/water1.jpg" alt="Luminous Flow" fill className="object-cover opacity-50 card-img-hover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/78 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        Luminous Flow <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#E9E3D6]/68">
                        Interactive fluid art. Curl noise, light, and particle physics.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

          </PhysicsField>
        </section>

        {/* ── Connect ── */}
        <section className="border-t border-[#DED9CE]/10 py-10 sm:py-12 md:py-16">
          <Reveal>
            <SectionHeading number="03" label="Connect" />
          </Reveal>
          <PhysicsField className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            {/* LinkedIn */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={100}>
                <TiltCard>
                  <Link href={route('linkedin').href} target="_blank" rel="noopener noreferrer" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#2F3C50]/34">
                      <Image src="/BRMinimalist.png" alt="Design Icon BR" width={140} height={70} className="object-contain opacity-60 card-img-hover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/68 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        LinkedIn <ExternalIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#E9E3D6]/68">
                        Message me on LinkedIn.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

            {/* GitHub */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={200}>
                <TiltCard>
                  <Link href={route('github').href} target="_blank" rel="noopener noreferrer" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#2F3C50]/34">
                      <Image src="/BRBaller.png" alt="Brooks Roley logo" width={120} height={70} className="object-contain opacity-60 card-img-hover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/68 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        GitHub <ExternalIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#E9E3D6]/68">
                        Explore my projects and open-source work.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

          </PhysicsField>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-[#DED9CE]/10 py-6">
          <div className="flex items-center justify-between text-xs text-[#E9E3D6]/46">
            <span>&copy; {new Date().getFullYear()} Brooks Roley</span>
            <Link href={route('consulting').href} className="transition-colors hover:text-[#DED9CE]">
              Selected work
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
