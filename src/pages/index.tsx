import Head from 'next/head'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import Reveal from 'src/components/Reveal'
import TiltCard from 'src/components/TiltCard'

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

export default function Home() {
  const cardBase = "group relative overflow-hidden rounded-xl border border-forest-700/40 bg-forest-900/60 text-white card-hover-border"

  return (
    <main className={`min-h-screen bg-forest-950 ${inter.className}`}>
      <Head>
        <title>Brooks Roley | Software Engineer</title>
      </Head>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest-900 via-forest-950 to-forest-900 text-white">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(255,105,180,0.12),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_70%,rgba(45,106,79,0.4),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_20%,rgba(255,184,217,0.08),transparent_40%)]" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-4 text-white animate-hero-1">
            Brooks Roley
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-forest-200 max-w-2xl mx-auto mb-6 animate-hero-2">
            Software Engineer building games, tools, and things for the&nbsp;web.
          </p>
          <p className="text-xs sm:text-sm text-candy-300/40 font-mono break-all sm:break-normal animate-hero-3" title="Regex that checks if a number (in unary) is prime">
            /^1?$|^(11+?)\1+$/
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* ── Featured (photo cards) ── */}
        <section className="py-10 sm:py-12 md:py-16">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-4 sm:mb-6">
              Featured
            </h2>
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
                    <p className="text-sm text-forest-300 mt-1">
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
                    <p className="text-sm text-forest-300 mt-1">
                      Classic strategy board game. Two players, captures, five-in-a-row.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>
          </div>
        </section>

        {/* ── Projects ── */}
        <section className="py-10 sm:py-12 md:py-16 border-t border-forest-800/60">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-4 sm:mb-6">
              Projects
            </h2>
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
                    <p className="text-sm text-forest-300 mt-1">
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
                    <p className="text-sm text-forest-300 mt-1">
                      Tower defense with cat wizards. Place towers, survive ant waves, level up.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>
          </div>
        </section>

        {/* ── Connect ── */}
        <section className="py-10 sm:py-12 md:py-16 border-t border-forest-800/60">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-4 sm:mb-6">
              Connect
            </h2>
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
                    <p className="text-sm text-forest-300 mt-1">
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
                    <p className="text-sm text-forest-300 mt-1">
                      Explore my projects and open-source work.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>

            {/* Calendly */}
            <Reveal delay={300}>
              <TiltCard>
                <Link href="https://calendly.com/brooksroley/" target="_blank" rel="noopener noreferrer" className={cardBase}>
                  <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-forest-800/40">
                    <Image src="/BRLogoTransparent.png" alt="Brooks Roley logo" width={120} height={70} className="object-contain opacity-60 card-img-hover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/50 to-transparent" />
                  </div>
                  <div className="relative px-5 pb-5 -mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      Calendly <ExternalIcon />
                    </h3>
                    <p className="text-sm text-forest-300 mt-1">
                      Schedule a time to chat.
                    </p>
                  </div>
                  <div className="tilt-highlight" />
                </Link>
              </TiltCard>
            </Reveal>
          </div>
        </section>
      </div>
    </main>
  )
}
