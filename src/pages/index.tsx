import Head from 'next/head'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import Reveal from 'src/components/Reveal'
import TiltCard from 'src/components/TiltCard'
import WaterHero, { WaterText } from 'src/components/WaterHero'

const inter = Inter({ subsets: ['latin'] })

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
    <span className="font-mono text-xs text-candy-300/80 tracking-wider">{number}</span>
    <span className="h-px flex-none w-6 bg-sky-400/40" aria-hidden />
    <h2 className="text-sm font-semibold uppercase tracking-widest text-sky-100/90">
      {label}
    </h2>
  </div>
)

export default function Home() {
  const cardBase = "group relative overflow-hidden rounded-xl border border-sky-400/15 bg-void-900/50 text-white card-hover-border backdrop-blur-sm"

  return (
    <main className={`min-h-screen water-page-bg ${inter.className}`}>
      <Head>
        <title>Brooks Roley | Software Engineer</title>
      </Head>
      {/* ── Hero — interactive water ── */}
      <WaterHero>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32 text-center">
          <WaterText className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-4 text-white drop-shadow-[0_2px_16px_rgba(56,189,248,0.25)] animate-hero-1">
            Brooks Roley
          </WaterText>
          <p className="text-base sm:text-lg md:text-xl text-sky-100/90 max-w-2xl mx-auto mb-8 animate-hero-2">
            Software Engineer building games, tools, and things for the&nbsp;web.
          </p>
          <div className="flex flex-col items-center gap-5 animate-hero-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs sm:text-sm text-sky-50/90 font-mono tracking-wide backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-candy-400/70 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-candy-400" />
              </span>
              <span>Los Angeles</span>
              <span className="text-white/30">·</span>
              <span>shipping games &amp; tools</span>
            </div>
            <a
              href="#featured"
              aria-label="Scroll to featured work"
              className="group/scroll mt-2 inline-flex flex-col items-center gap-1.5 text-sky-200/70 hover:text-candy-300 transition-colors"
            >
              <span className="text-[10px] uppercase tracking-[0.25em]">Scroll</span>
              <svg className="w-4 h-4 transition-transform duration-500 group-hover/scroll:translate-y-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
          </div>
        </div>
      </WaterHero>

      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* ── Featured (photo cards) ── */}
        <section id="featured" className="py-10 sm:py-12 md:py-16">
          <Reveal>
            <SectionHeading number="01" label="Featured" />
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Resume */}
            <Reveal delay={100}>
              <TiltCard>
                <Link href="/resume" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden">
                    <Image src="/cover.png" alt="Brooks Roley" fill className="object-cover opacity-60 card-img-hover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      Resume <ArrowIcon />
                    </h3>
                    <p className="text-sm text-sky-100/70 mt-1">
                      Learn more about my experiences and background.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>

            {/* Pente */}
            <Reveal delay={200}>
              <TiltCard>
                <Link href="/posts/pente" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden">
                    <Image src="/marathon.png" alt="Marathon Celebration" fill className="object-cover opacity-40 card-img-hover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      Pente <ArrowIcon />
                    </h3>
                    <p className="text-sm text-sky-100/70 mt-1">
                      Classic strategy board game. Two players, captures, five-in-a-row.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>

            {/* Go */}
            <Reveal delay={300}>
              <TiltCard>
                <Link href="/posts/go" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#dbb878]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#1a1a1a] shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                      <span className="w-5 h-5 rounded-full bg-[#f5f5f5] shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/60 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      Go <ArrowIcon />
                    </h3>
                    <p className="text-sm text-sky-100/70 mt-1">
                      Learn the ancient territory game. 9×9, 13×13, or 19×19. Chinese rules.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>

            {/* B-Ball Tactics — hidden until game playability is ready */}
          </div>
        </section>

        {/* ── Projects ── */}
        <section className="py-10 sm:py-12 md:py-16 border-t border-sky-400/10">
          <Reveal>
            <SectionHeading number="02" label="Projects" />
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Luminous Flow */}
            <Reveal delay={100}>
              <TiltCard>
                <Link href="/posts/luminous-flow" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden">
                    <Image src="/water1.jpg" alt="Luminous Flow" fill className="object-cover opacity-50 card-img-hover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      Luminous Flow <ArrowIcon />
                    </h3>
                    <p className="text-sm text-sky-100/70 mt-1">
                      Interactive fluid art. Curl noise, light, and particle physics.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>

            {/* Nanu & Pika TD */}
            <Reveal delay={200}>
              <TiltCard>
                <Link href="/posts/nanu-pika-td" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden">
                    <Image src="/lion.jpg" alt="Nanu and Pika TD" fill className="object-cover opacity-50 card-img-hover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      Nanu &amp; Pika TD <ArrowIcon />
                    </h3>
                    <p className="text-sm text-sky-100/70 mt-1">
                      Tower defense with cat wizards. Place towers, survive ant waves, level up.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>

            {/* AWS GenAI Tracker */}
            <Reveal delay={300}>
              <TiltCard>
                <Link href="/education-tracker" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden">
                    <Image src="/mountain.jpg" alt="AWS GenAI Tracker" fill className="object-cover opacity-50 card-img-hover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      AWS GenAI Tracker <ArrowIcon />
                    </h3>
                    <p className="text-sm text-sky-100/70 mt-1">
                      Interactive study roadmap for the AWS Generative AI Developer certification.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>

            {/* NBA Explorer */}
            <Reveal delay={300}>
              <TiltCard>
                <Link href="/nba" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#0a0c10]">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                      <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                      <div className="w-3 h-3 rounded-full bg-[#f97316]" />
                      <div className="w-3 h-3 rounded-full bg-[#a855f7]" />
                      <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/60 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      NBA Explorer <ArrowIcon />
                    </h3>
                    <p className="text-sm text-forest-300 mt-1">
                      Live NBA stats, standings, player analytics, and team dashboards. Interactive node graph.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>

            {/* Basketball Data Platform */}
            <Reveal delay={400}>
              <TiltCard>
                <Link href="/basketball-platform" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-forest-800/40">
                    <Image src="/BRBaller.png" alt="Basketball Data Platform" width={140} height={70} className="object-contain opacity-60 card-img-hover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      Basketball Data Platform <ArrowIcon />
                    </h3>
                    <p className="text-sm text-sky-100/70 mt-1">
                      Full-stack analytics system. Python API, C++ WASM engine, Vue 3 game, SwiftUI iOS app.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>
          </div>
        </section>

        {/* ── Connect ── */}
        <section className="py-10 sm:py-12 md:py-16 border-t border-sky-400/10">
          <Reveal>
            <SectionHeading number="03" label="Connect" />
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {/* LinkedIn */}
            <Reveal delay={100}>
              <TiltCard>
                <Link href="https://www.linkedin.com/in/brooksroley/" target="_blank" rel="noopener noreferrer" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-forest-800/40">
                    <Image src="/BRMinimalist.png" alt="Design Icon BR" width={140} height={70} className="object-contain opacity-60 card-img-hover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/50 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      LinkedIn <ExternalIcon />
                    </h3>
                    <p className="text-sm text-sky-100/70 mt-1">
                      Let&apos;s connect and make things happen.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>

            {/* GitHub */}
            <Reveal delay={200}>
              <TiltCard>
                <Link href="https://github.com/brooksroley" target="_blank" rel="noopener noreferrer" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-forest-800/40">
                    <Image src="/BRBaller.png" alt="Brooks Roley logo" width={120} height={70} className="object-contain opacity-60 card-img-hover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/50 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      GitHub <ExternalIcon />
                    </h3>
                    <p className="text-sm text-sky-100/70 mt-1">
                      Explore my projects and open-source work.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>

            {/* Consulting route temporarily disabled
            <Reveal delay={300}>
              <TiltCard>
                <Link href="/consulting" className={cardBase}>
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
            */}

            {/* Zero Paradox */}
            <Reveal delay={400}>
              <TiltCard>
                <Link href="/zero-paradox" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#2e1065]/60">
                    <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-[#4c1d95]/60 border border-[#7c3aed]/30">
                      <span className="text-3xl font-black text-[#c4b5fd] tracking-tighter select-none">ZP</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/60 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      Zero Paradox LLC <ArrowIcon />
                    </h3>
                    <p className="text-sm text-sky-100/70 mt-1">
                      Support the work — games, tools, consulting, and nonprofits.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-sky-400/10 py-6">
          <div className="flex items-center justify-between text-xs text-sky-200/50">
            <span>&copy; {new Date().getFullYear()} Brooks Roley</span>
            <Link href="/funding" className="hover:text-candy-300 transition-colors">
              support my work
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
