import dynamic from 'next/dynamic'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import Reveal from 'src/components/Reveal'
import TiltCard from 'src/components/TiltCard'
import { AVAILABILITY, HERO_SUMMARY } from 'src/lib/resume'
import { route } from 'src/lib/routes'
import { glintStyle } from 'src/lib/ember/weather'

const PhysicsField = dynamic(() => import('src/components/PhysicsField'), {
  loading: () => <div className="physics-field-grid" />,
})

// Server-rendered: the `featured` prop carries the primary "Work with me" CTA and
// every Featured card, so this must not be ssr:false — crawlers and no-JS clients
// would see only the fallback below. matter-js and EmberText are both SSR-safe (all
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

// A card title takes one brass pass when its card is hovered or focused (Ember glint).
const CardTitle = ({ children }: { children: string }) => (
  <span className="ember-glint" style={glintStyle(children)}>{children}</span>
)

const cardBase = "group relative block overflow-hidden rounded-xl border border-[#DED9CE]/14 bg-[#2F3C50]/18 text-[#E9E3D6] card-hover-border backdrop-blur-sm"

// One card: art on top, title and one line below. `art` is the top panel's content;
// `artClass` its background. External links get the external icon and a new tab.
const Card = ({ href, title, line, art, artClass = 'bg-[#141F30]', external = false, delay }: {
  href: string
  title: string
  line: string
  art: ReactNode
  artClass?: string
  external?: boolean
  delay: number
}) => (
  <div data-physics-item className="physics-field-item">
    <Reveal delay={delay}>
      <TiltCard>
        <Link
          href={href}
          className={cardBase}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <div className={`aspect-[2.2/1] relative overflow-hidden flex items-center justify-center ${artClass}`}>
            {art}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A2638] via-[#1A2638]/72 to-transparent" />
          </div>
          <div className="relative px-5 pb-5 -mt-8">
            <h4 className="text-xl font-semibold flex items-center gap-2">
              <CardTitle>{title}</CardTitle> {external ? <ExternalIcon /> : <ArrowIcon />}
            </h4>
            <p className="mt-1 text-sm text-[#E9E3D6]/68">{line}</p>
          </div>
          <div className="tilt-highlight" />
        </Link>
      </TiltCard>
    </Reveal>
  </div>
)

const ArtLabel = ({ children }: { children: string }) => (
  <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#E9E3D6]/70">{children}</span>
)

// A lane names which kind of role the cards under it speak to.
const Lane = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="mt-8 first:mt-0">
    <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[#B1ADA8]/85">{label}</h3>
    <PhysicsField className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">{children}</PhysicsField>
  </div>
)

const EMAIL = 'brooksroley@gmail.com'

export default function Home() {
  return (
    <main className="min-h-screen terrain-page-bg font-sans">
      <Head>
        <title>Brooks Roley | Software Engineer</title>
      </Head>
      <PhysicsHero
        featured={
          <>
            <SectionHeading number="01" label="Work" />
            <Reveal>
              <p className="mb-6 sm:mb-8 max-w-2xl text-sm sm:text-base text-[#E9E3D6]/78 leading-relaxed">
                Two kinds of interface work: game clients, and products people rely on every day.
              </p>
            </Reveal>

            <Lane label="Game client & UI">
              <Card
                href={route('hardwood').href}
                title="Hardwood Autochess"
                line="A C++ engine compiled to WebAssembly under a Vue 3 client, and an Electron launcher that ships a one-line change as 16 KB of a 1.07 MB build."
                art={<ArtLabel>Engine · Client · Launcher</ArtLabel>}
                artClass="bg-[#552583]"
                delay={100}
              />
              <Card
                href={route('basketballPlatform').href}
                title="Basketball Data Platform"
                line="One system across four codebases: a Python API, the C++/WASM engine, a Vue 3 game and a SwiftUI iOS app."
                art={<Image src="/BRBaller.png" alt="" width={140} height={70} className="object-contain opacity-70 card-img-hover" />}
                artClass="bg-[#2F3C50]/34"
                delay={200}
              />
            </Lane>

            <Lane label="Product web">
              <Card
                href={route('resume').href}
                title="Ten years of product UI"
                line="Grove, Zoox, Zipongo and SigFig: personalization for 1.5M+ customers, a Backbone-to-Vue migration, HIPAA and WCAG work."
                art={<Image src="/cover.png" alt="" fill className="object-cover opacity-60 card-img-hover" />}
                delay={300}
              />
              <Card
                href={route('tradeMachine').href}
                title="Trade Machine"
                line="An NBA salary-cap explorer: build a trade, check it against the CBA's rules and see the cap math for 2026-27."
                art={<ArtLabel>Payroll · Cap · Aprons</ArtLabel>}
                delay={400}
              />
            </Lane>
          </>
        }
      />

      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* ── Contact ── */}
        <section className="border-t border-[#DED9CE]/10 py-10 sm:py-12 md:py-16">
          <Reveal>
            <SectionHeading number="02" label="Contact" />
          </Reveal>
          <PhysicsField className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            <Card
              href={`mailto:${EMAIL}`}
              title="Email"
              line={EMAIL}
              art={<ArtLabel>The fastest way</ArtLabel>}
              artClass="bg-[#2F3C50]/34"
              external
              delay={100}
            />
            <Card
              href={route('linkedin').href}
              title="LinkedIn"
              line="Message me on LinkedIn."
              art={<Image src="/BRMinimalist.png" alt="" width={140} height={70} className="object-contain opacity-60 card-img-hover" />}
              artClass="bg-[#2F3C50]/34"
              external
              delay={200}
            />
            <Card
              href={route('github').href}
              title="GitHub"
              line="The code behind this site and its games."
              art={<Image src="/BRBaller.png" alt="" width={120} height={70} className="object-contain opacity-60 card-img-hover" />}
              artClass="bg-[#2F3C50]/34"
              external
              delay={300}
            />
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
