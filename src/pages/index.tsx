import dynamic from 'next/dynamic'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import Reveal from 'src/components/Reveal'
import TiltCard from 'src/components/TiltCard'

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
    <section className="terrain-hero relative overflow-hidden text-[#DADBD9]">
      <div className="relative z-10 mx-auto flex min-h-[74vh] max-w-6xl flex-col justify-center gap-10 px-4 py-16 sm:px-6 md:min-h-[82vh] md:flex-row md:items-center md:gap-14 md:py-20">
        <div className="max-w-2xl md:flex-[1.05]">
          <h1 className="text-[clamp(3.35rem,9vw,6.8rem)] font-extrabold leading-none text-[#DADBD9]">Brooks Roley</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#DADBD9]/80 sm:text-lg sm:leading-8">
            Software engineer building games, tools, and responsive web systems with
            a bias toward fast feedback, tactile motion, and layered interfaces.
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
    <span className="font-mono text-xs tracking-wider text-[#B9968D]/85">{number}</span>
    <span className="h-px flex-none w-6 bg-[#C5E7EA]/30" aria-hidden />
    <h2 className="text-sm font-semibold uppercase tracking-widest text-[#DADBD9]/88">
      {label}
    </h2>
  </div>
)

export default function Home() {
  const cardBase = "group relative overflow-hidden rounded-xl border border-[#C5E7EA]/14 bg-[#415557]/18 text-[#DADBD9] card-hover-border backdrop-blur-sm"

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
              <div className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-2xl text-sm sm:text-base text-[#DADBD9]/78 leading-relaxed">
                  Full-stack engineer — React, TypeScript, sports tech, games.
                  <span className="text-[#DADBD9]/88"> Available for consulting.</span>
                </p>
                <Link
                  href="/consulting"
                  className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#B27236] bg-[#B27236]/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-lg shadow-[#B27236]/20 transition-colors hover:bg-[#B27236]/85 sm:self-auto"
                >
                  <span>Work with me</span>
                  <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">&rarr;</span>
                </Link>
              </div>
            </Reveal>
            <PhysicsField className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <div data-physics-item className="physics-field-item">
                <Reveal delay={100}>
                  <TiltCard>
                    <Link href="/resume" className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden">
                        <Image src="/cover.png" alt="Brooks Roley" fill className="object-cover opacity-60 card-img-hover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/78 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Resume <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#DADBD9]/68">
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
                    <Link href="/posts/pente" className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden">
                        <Image src="/marathon.png" alt="Marathon Celebration" fill className="object-cover opacity-40 card-img-hover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/78 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Pente <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#DADBD9]/68">
                          Classic strategy board game. Two players, captures, five-in-a-row.
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
                    <Link href="/posts/go" className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#B9968D]">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#1a1a1a] shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                          <span className="w-5 h-5 rounded-full bg-[#f5f5f5] shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Go <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#DADBD9]/68">
                          Learn the ancient territory game. 9×9, 13×13, or 19×19. Chinese rules.
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
                    <Link href="/tools/chat" className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#415557]/34">
                        <div className="flex items-center gap-2 text-2xl opacity-60">
                          <span>🎭</span><span>🤖</span><span>🧙</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Chat Sandbox <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#DADBD9]/68">
                          Build a cast of AI characters. Pick their models, give them roles, watch them argue.
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
                    <Link href="/tools/model-arena" className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#415557]/34">
                        <div className="flex items-center gap-3 text-2xl opacity-60">
                          <span>&#x2694;&#xFE0F;</span><span>&#x1F916;</span><span>&#x1F3C6;</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Model Arena <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#DADBD9]/68">
                          Compare AI models side by side. Blind battles, speed stats, leaderboard.
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
                    <Link href="/basketball-platform" className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#552583]">
                        <Image src="/BRBaller.png" alt="Basketball Data Platform" width={140} height={70} className="object-contain opacity-70 card-img-hover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Basketball Data Platform <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#DADBD9]/68">
                          Full-stack NBA system. Python API, C++ WASM engine, Vue 3 game, SwiftUI iOS.
                        </p>
                      </div>
                      <div className="tilt-highlight" />
                    </Link>
                  </TiltCard>
                </Reveal>
              </div>

              <div data-physics-item className="physics-field-item">
                <Reveal delay={700}>
                  <TiltCard>
                    <Link
                      href="/consulting"
                      className="group relative overflow-hidden rounded-xl border border-candy-500/40 bg-[#415557]/18 text-[#DADBD9] card-hover-border backdrop-blur-sm ring-1 ring-candy-500/15"
                    >
                      <span className="absolute right-3 top-3 z-10 rounded-full bg-candy-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg">
                        Hire me
                      </span>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-forest-800/40">
                        <Image src="/BRLogoTransparent.png" alt="Brooks Roley logo" width={120} height={70} className="object-contain opacity-60 card-img-hover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/50 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Consulting <ArrowIcon />
                        </h3>
                        <p className="text-sm text-sky-100/70 mt-1">
                          Strategy sessions, dev sprints, and fractional CTO engagements.
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
        <section className="border-t border-[#C5E7EA]/10 py-10 sm:py-12 md:py-16">
          <Reveal>
            <SectionHeading number="02" label="Projects" />
          </Reveal>
          <PhysicsField className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            {/* Luminous Flow */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={100}>
                <TiltCard>
                  <Link href="/posts/luminous-flow" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden">
                      <Image src="/water1.jpg" alt="Luminous Flow" fill className="object-cover opacity-50 card-img-hover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/78 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        Luminous Flow <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#DADBD9]/68">
                        Interactive fluid art. Curl noise, light, and particle physics.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

            {/* Nanu & Pika TD */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={200}>
                <TiltCard>
                  <Link href="/posts/nanu-pika-td" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden">
                      <Image src="/lion.jpg" alt="Nanu and Pika TD" fill className="object-cover opacity-50 card-img-hover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/78 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        Nanu &amp; Pika TD <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#DADBD9]/68">
                        Tower defense with cat wizards. Place towers, survive ant waves, level up.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

            {/* NBA Explorer */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={300}>
                <TiltCard>
                  <Link href="/nba" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#1A2123]">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-[#C5E7EA]" />
                        <div className="h-3 w-3 rounded-full bg-[#DADBD9]" />
                        <div className="h-3 w-3 rounded-full bg-[#B9968D]" />
                        <div className="h-3 w-3 rounded-full bg-[#B27236]" />
                        <div className="h-3 w-3 rounded-full bg-[#415557]" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        NBA Explorer <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#DADBD9]/68">
                        Live NBA stats, standings, player analytics, and team dashboards. Interactive node graph.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

            {/* The Rig Report */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={400}>
                <TiltCard>
                  <Link href="/tools/rig-report" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#1A2123]">
                      <div className="flex items-center gap-3 text-2xl opacity-60">
                        <span>&#x1F575;&#xFE0F;</span><span>&#x1F3C0;</span><span>&#x1F4C9;</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        The Rig Report <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#DADBD9]/68">
                        A satirical NBA &ldquo;rigging&rdquo; inspector that teaches real odds math — the vig, base rates, line movement.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

            {/* Hardwood Autochess */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={500}>
                <TiltCard>
                  <Link href="/games/hardwood" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#552583]">
                      <div className="flex items-center gap-3 text-2xl opacity-70">
                        <span>&#x1F3C0;</span><span>&#x265F;&#xFE0F;</span><span>&#x1F451;</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        Hardwood Autochess <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#DADBD9]/68">
                        NBA auto-battler. Draft a squad, place your board, fight ghost lineups over 10 rounds.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

            {/* Pass & Cut */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={520}>
                <TiltCard>
                  <Link href="/games/pass-and-cut" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#1d4ed8] via-[#1e3a8a] to-[#0f172a]">
                      <div className="flex items-center gap-3 text-2xl opacity-70">
                        <span>&#x1F3C0;</span><span>&#x1F517;</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        Pass &amp; Cut <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#DADBD9]/68">
                        A graph-theory basketball puzzle — sever the defense before it cuts your passing lanes.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

            {/* Read & React */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={560}>
                <TiltCard>
                  <Link href="/games/read-and-react" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#552583] via-[#3b1a5c] to-[#0f172a]">
                      <div className="flex items-center gap-3 text-2xl opacity-70">
                        <span>&#x1F3C0;</span><span>&#x1F9E0;</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        Read &amp; React <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#DADBD9]/68">
                        A game-theory EV matrix — read the defense, pick the play, beat the minimax.
                      </p>
                    </div>
                    <div className="tilt-highlight" />
                  </Link>
                </TiltCard>
              </Reveal>
            </div>

            {/* The Zero Theater */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={600}>
                <TiltCard>
                  <Link href="/theater" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-candy-900 via-forest-900 to-forest-950">
                      <div className="flex items-center gap-3 text-2xl opacity-70">
                        <span>&#x1F3AD;</span><span>&#x2728;</span><span>&#x1F3AB;</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        The Zero Theater <ArrowIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#DADBD9]/68">
                        Every game on this site, staged as a production — duels, trials, seasons. Admission free.
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
        <section className="border-t border-[#C5E7EA]/10 py-10 sm:py-12 md:py-16">
          <Reveal>
            <SectionHeading number="03" label="Connect" />
          </Reveal>
          <PhysicsField className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            {/* LinkedIn */}
            <div data-physics-item className="physics-field-item">
              <Reveal delay={100}>
                <TiltCard>
                  <Link href="https://www.linkedin.com/in/brooksroley/" target="_blank" rel="noopener noreferrer" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#415557]/34">
                      <Image src="/BRMinimalist.png" alt="Design Icon BR" width={140} height={70} className="object-contain opacity-60 card-img-hover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/68 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        LinkedIn <ExternalIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#DADBD9]/68">
                        Let&apos;s connect and make things happen.
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
                  <Link href="https://github.com/brooksroley" target="_blank" rel="noopener noreferrer" className={cardBase}>
                    <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#415557]/34">
                      <Image src="/BRBaller.png" alt="Brooks Roley logo" width={120} height={70} className="object-contain opacity-60 card-img-hover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/68 to-transparent" />
                    </div>
                    <div className="relative px-5 pb-5 -mt-8">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        GitHub <ExternalIcon />
                      </h3>
                      <p className="mt-1 text-sm text-[#DADBD9]/68">
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
        <footer className="border-t border-[#C5E7EA]/10 py-6">
          <div className="flex items-center justify-between text-xs text-[#DADBD9]/46">
            <span>&copy; {new Date().getFullYear()} Brooks Roley</span>
            <Link href="/funding" className="transition-colors hover:text-[#C5E7EA]">
              support my work
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
