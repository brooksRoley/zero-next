import Head from 'next/head'
import Link from 'next/link'
import { track } from 'src/lib/analytics'

/**
 * The Zero Theater — the games staged as productions.
 *
 * This page is the live expression of docs/ART_DIRECTION.md: every game and
 * interactive piece on the site appears here as a playbill entry, grouped
 * into acts. A production without a playbill doesn't exist — new pieces add
 * themselves to REPERTORY in the same PR that ships them.
 */

type Production = {
  id: string
  title: string
  metaphor: string
  logline: string
  note: string
  href: string
  accent: string
}

type Act = {
  numeral: string
  name: string
  productions: Production[]
}

const REPERTORY: Act[] = [
  {
    numeral: 'Act I',
    name: 'Duels',
    productions: [
      {
        id: 'pente',
        title: 'Pente',
        metaphor: 'the duel',
        logline: 'Five in a row, or five captures — against a friend, a bot, or three of them at once.',
        note: 'A minimax engine breathes in a Web Worker while you play. The oldest kind of drama: two minds, one board.',
        href: '/posts/pente',
        accent: '#f24da0',
      },
      {
        id: 'go',
        title: 'Go',
        metaphor: 'the old game',
        logline: 'Territory, liberties, and a tutor that teaches by asking.',
        note: 'Four thousand years old and still undefeated as a lesson in patience. Start with the learn track if the empty board stares back.',
        href: '/posts/go',
        accent: '#6abf82',
      },
    ],
  },
  {
    numeral: 'Act II',
    name: 'Trials',
    productions: [
      {
        id: 'pente_puzzles',
        title: 'Pente Puzzles',
        metaphor: 'the mountain',
        logline: 'Curated positions, an endless generated climb, and an ELO that remembers.',
        note: 'Every solve is a foothold. The mountain does not get shorter; you get stronger.',
        href: '/posts/pente-puzzles',
        accent: '#ff69b4',
      },
      {
        id: 'go_puzzles',
        title: 'Go Puzzles',
        metaphor: 'the quiet climb',
        logline: 'Life-and-death problems, one breath at a time.',
        note: 'Smaller boards, sharper questions. The trial is noticing what the stones already know.',
        href: '/posts/go/puzzles',
        accent: '#40916c',
      },
      {
        id: 'pass_and_cut',
        title: 'Pass & Cut',
        metaphor: 'the open lane',
        logline: 'A graph-theory basketball puzzle: sever the defense before it severs your passing lanes.',
        note: 'The Shannon switching game wearing a jersey. Every possession is a proof — connect two hoops through the network faster than the defender can cut it.',
        href: '/games/pass-and-cut',
        accent: '#FDB927',
      },
      {
        id: 'read_and_react',
        title: 'Read & React',
        metaphor: 'the mind game',
        logline: 'A game-theory EV matrix: read the defense, pick the play, beat the minimax.',
        note: 'Zero-sum poker in high-tops. There is a correct mixed strategy hiding in the payoff grid — the trial is finding it before the adaptive defense finds you.',
        href: '/games/read-and-react',
        accent: '#552583',
      },
      {
        id: 'moments',
        title: 'Playoff Moments',
        metaphor: 'the frozen second',
        logline: 'Famous playoff plays frozen one beat before they happen — click the spot history found.',
        note: 'Ray Allen’s backpedal, the chase-down, 0.4 seconds. Your legs are a disk, their reach is a disk, and the puzzle is the space between. Sometimes the geometry grades history a C — and history makes it anyway.',
        href: '/games/moments',
        accent: '#FDB927',
      },
      {
        id: 'nanu_pika',
        title: 'Nanu & Pika TD',
        metaphor: 'the siege',
        logline: 'Two small heroes, waves of trouble, and the geometry of holding a line.',
        note: 'Tower defense as a story about preparation: everything you place before the wave is a promise you keep during it.',
        href: '/posts/nanu-pika-td',
        accent: '#a78bfa',
      },
    ],
  },
  {
    numeral: 'Act III',
    name: 'Seasons',
    productions: [
      {
        id: 'hardwood',
        title: 'Hardwood Autochess',
        metaphor: 'court as stage',
        logline: 'An NBA auto-battler: draft a squad, call your schemes, fight ghost boards for ten rounds.',
        note: 'The newest production. Your opponents are the recorded runs of other players — the theater fights back with its own audience.',
        href: '/games/hardwood',
        accent: '#FDB927',
      },
    ],
  },
  {
    numeral: 'Intermission',
    name: 'Visual pieces',
    productions: [
      {
        id: 'stat_galaxy',
        title: 'Stat Galaxy',
        metaphor: 'the observatory',
        logline: 'A season of NBA stats hung in space, drifting under physics.',
        note: 'Not a game — a place to stand and look. Numbers become bodies with mass; league hierarchy becomes orbit.',
        href: '/stat-galaxy',
        accent: '#8b5cf6',
      },
      {
        id: 'luminous_flow',
        title: 'Luminous Flow',
        metaphor: 'water',
        logline: 'Light that moves like something alive under your cursor.',
        note: 'The first piece in the repertory, and still the house lighting test: one accent, darkness, motion with a reason.',
        href: '/posts/luminous-flow',
        accent: '#ff8cc2',
      },
    ],
  },
]

function Playbill({ production, act }: { production: Production; act: string }) {
  return (
    <Link
      href={production.href}
      onClick={() =>
        track('cta_click', {
          page: '/theater',
          metadata: { location: `theater_${production.id}`, act },
        })
      }
      className="group relative flex flex-col overflow-hidden rounded-xl border border-forest-800/60 bg-forest-900/40 p-5 transition-colors hover:border-forest-600/70 hover:bg-forest-900/70"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-60 transition-opacity group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${production.accent}, transparent)` }}
      />
      <p
        className="font-mono text-[11px] uppercase tracking-[0.22em]"
        style={{ color: production.accent }}
      >
        {production.metaphor}
      </p>
      <h3 className="mt-2 text-xl font-semibold text-white">
        {production.title}
        <span className="ml-2 inline-block translate-x-0 text-forest-500 transition-transform group-hover:translate-x-1 group-hover:text-forest-300">
          →
        </span>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-forest-300">{production.logline}</p>
      <p className="mt-3 border-l-2 border-forest-800 pl-3 text-xs italic leading-relaxed text-forest-400">
        {production.note}
      </p>
      <span className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-forest-500 transition-colors group-hover:text-forest-300">
        Take your seat
      </span>
    </Link>
  )
}

export default function Theater() {
  return (
    <main className="min-h-screen bg-forest-950 text-white font-sans">
      <Head>
        <title>The Zero Theater | Brooks Roley</title>
        <meta
          name="description"
          content="The games of brooksroley.com, staged as productions — duels, trials, seasons, and intermission pieces. Every piece framed, every seat free."
        />
      </Head>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        {/* ── Marquee ── */}
        <header className="mb-12 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-candy-400/90">
            Now showing · admission free
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            The Zero <span className="text-candy-400">Theater</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-forest-300 sm:text-base">
            Every game on this site is a production: it gets a stage, a metaphor it
            holds from curtain to curtain, and a playbill note from the maker. Duels
            first, then trials, then a whole season. The intermission pieces are just
            light — stay as long as you like.
          </p>
        </header>

        {/* ── Acts ── */}
        <div className="space-y-12">
          {REPERTORY.map((act) => (
            <section key={act.numeral} aria-label={`${act.numeral} — ${act.name}`}>
              <div className="mb-5 flex items-baseline gap-3">
                <h2 className="font-mono text-sm uppercase tracking-[0.25em] text-forest-400">
                  {act.numeral}
                </h2>
                <span className="text-lg font-semibold text-forest-200">{act.name}</span>
                <span aria-hidden className="h-px flex-1 self-center bg-forest-800/70" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {act.productions.map((p) => (
                  <Playbill key={p.id} production={p} act={act.numeral} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ── The frame: house note + tip jar ── */}
        <footer className="mt-16 rounded-xl border border-forest-800/60 bg-forest-900/30 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-candy-400/80">
            From the house
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-forest-300">
            This theater is itself a piece, held to the same standard as everything
            on its stage: one light against the dark, one metaphor, a frame, and no
            placeholder anything. The house style that governs it lives in the
            repository as{' '}
            <span className="font-mono text-forest-200">docs/ART_DIRECTION.md</span>{' '}
            — six pillars and a pre-curtain checklist that every new production must
            pass. The theater also watches its own audience: what gets played shapes
            what gets staged next.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-forest-500">
              Seats are free forever. The lights cost a little.
            </p>
            <Link
              href="/funding"
              onClick={() =>
                track('cta_click', {
                  page: '/theater',
                  metadata: { location: 'theater_tip' },
                  beacon: true,
                })
              }
              className="text-sm text-candy-500 transition-colors hover:text-candy-400"
            >
              Keep the theater lit →
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
