# The House Style — Art Direction for the Zero Theater

This is the artistic standard for every game and interactive piece shipped on
brooksroley.com. It exists so that quality is a *decision made once*, not
re-argued per PR. It binds human and agent sessions alike, and it amends the
same way CLAUDE.md does: **only on evidence** — a named failure, a measured
win, or play data — never on vibes.

The live expression of this standard is the stage itself: [`/theater`](/theater)
(`src/pages/theater.tsx`), where the games run as productions.

---

## The stage

Every surface is a dark stage. The site's darkness is not a theme option — it
is the black box the work performs in.

| Token | Value | Role |
|---|---|---|
| `ink-950` | `#101B2B` | The house dark: burnt blue. Default page ground. (Ink & Brass, 2026-10-23, replaced forest + candy.) |
| `ink-100/200` | creams | Body text. `ink-300/400` grays for supporting text; `charcoal` `#262A30` for cards. |
| `brass-300/400/500` | `#D8B783` / `#CDA35F` / `#C18E3D` | The one decorator accent: links, marquee, studio accents. Solid brass buttons take `text-ink-950`, never white. `clay-400/500` is a rare second accent. |
| `void-400/500` | `#a78bfa` / `#8b5cf6` | Mystery pieces, night-sky work (Stat Galaxy). |
| Lakers purple / gold | `#552583` / `#FDB927` | Reserved for basketball surfaces only. |

Type: the existing site stack. Monospace, uppercase, wide-tracked for eyebrow
labels and program notes; bold tight-tracking sans for titles. No new fonts —
a theater has one voice.

---

## The six pillars

### 1. Light against dark
Each piece earns **exactly one luminous accent** against the house dark.
Light is attention: if everything glows, nothing does. A piece that needs two
accent hues is two pieces, or an unfinished one.

### 2. Motion is meaning
Animate state, never decoration. Prefer simulation to tween: springs, physics
fields, water, the canvas transitions already in the repertory. 60fps is the
floor — a dropped frame is a wrong note. `prefers-reduced-motion` is honored
everywhere; stillness must also read as designed.

**Motion vocabulary.** Five curves and three durations, defined once in
`src/lib/ui/tactile.js` (`EASING`, `DURATION`) and mirrored as CSS variables
in `globals.css` and Tailwind utilities (`ease-settle`, `duration-ui`, …):

| Curve | Use it when | Example |
|---|---|---|
| `overshoot` | a piece **lands** | stone drop, planted bed, stamp |
| `settle` | something **arrives** | Reveal, hero lines, cards, menus |
| `responsive` | the hand drives it | drag, hover follow |
| `weighted` | a large thing **travels** | board transitions, walking pets, shake |
| `exit` | something **leaves** | captured stones, dismissals |

Durations: `tap` 150ms (hover, press, focus), `ui` 250ms (menus, toggles),
`enter` 500ms (arrivals). Game pieces keep their own `TIMING` values. Never
write a new `cubic-bezier`; if none of the five fits, the change to this table
ships first. `motionTokens.test.ts` enforces both. A global
`prefers-reduced-motion` net in `globals.css` collapses every CSS animation and
transition; canvas and `requestAnimationFrame` work checks
`prefersReducedMotion()` (`src/lib/motion.ts`) itself.

**Ember, the house light** (adopted 2026-10-28; Brooks chose it from the
Motion Lab plates). Brass light moving through cream dots is the site's
signature. It comes in two forms and nothing else:

| Form | Where | What it does |
|---|---|---|
| `EmberText` (`src/components/EmberText.tsx`) | At most one per page, for a name or a marquee: the home hero, the Theater | The words are drawn as dots that fly in and settle. A brass band sweeps across them, follows the cursor, and throws the odd spark. The real text sits underneath, transparent, for screen readers and selection |
| `.ember-glint` (`globals.css`) | Card titles inside a `.group` link | One brass pass across the title on hover or keyboard focus |

**Randomness, with rules.** Novelty comes from a seeded "weather"
(`src/lib/ember/weather.ts`), drawn once per visit, so the light behaves a
little differently each time but consistently within a visit:
- Sweep direction (left, right, or out from the centre), band width, warmth (which brass), flicker depth, and how many sparks lift off.
- Idle sweeps come at irregular gaps of 7 to 15 seconds, never on a metronome. A rare *flare* (about 1 visit in 12) lights the whole name once.
- Glints vary per title (angle, speed, direction), from a hash of the title, so server and client agree.
- **Never random:** legibility (dot spacing scales with the font so strokes are three to four dots wide), the palette (cream dots, brass light only), or the timing tokens.

**Budgets.** About 1,500 dots at the largest hero size. The canvas pauses when it's off screen or the tab is hidden, and drops to 20 fps between sweeps. With reduced motion it draws one still frame, lit, and nothing moves.

**Pillar 2 tension, stated.** Idle sweeps are ambient motion, which pillar 2
discourages. They're kept sparse and irregular, and every other sweep answers
state: page load, the pointer, focus, hover. If play data or a complaint shows
the idle sweep distracts, it's the first thing to remove.

### 3. One metaphor, held
Every piece commits to a single figurative frame and never mixes:
mountain = mastery (Pente Puzzles), water = flow (Luminous Flow),
galaxy = scale (Stat Galaxy), court = stage (Hardwood), garden = growth
(reserved). The metaphor governs copy, motion, and reward moments together.
If a feature can't be said inside the piece's metaphor, it belongs elsewhere.

### 4. Every piece gets a frame
Title and a one-paragraph playbill note rendered on the page. No tip-jar or
support link (retired 2026-10-23). Art is the audience funnel, not a detour from it. The frame is
part of the work: an unframed piece is not shipped, it's abandoned on stage.

### 5. The craft floor
Complete and working, mobile-first, no placeholder art. Loading, empty, and
error states are *designed*, not defaulted. WCAG AA contrast, visible focus.
**Art that crashes is a bug, not a statement** — production quality is what
lets a piece be shown proudly by a creator, not just a developer.

**Measured floors** (adopted 2026-10-28 from a site-wide experiment: each rule
injected on 28 routes at five widths and audited against a control run; PR #81):

| Floor | Rule | Evidence |
|---|---|---|
| Tap size | Every control is at least **24×24px** (WCAG 2.5.8). Inline links in running text are exempt. Give text links `inline-flex` + padding: `min-height` does nothing on an inline element. Game boards are exempt when placement uses drag-to-preview (Pente). | Under-24px phone targets 107 → 30; +0.1% page height; no new overflow |
| Text size | No HTML text under **12px**. SVG labels inside a chart are judged at their rendered size. | Sub-12px phone text 784 → 258 (the rest is SVG); +0.9% height; no new overflow |
| Measure | Cap body copy in **`ch`**, about 65–70ch (`max-w-[65ch]`), not in px or `max-w-2xl`. A px cap lets small text run long. | Overlong lines 54 → 12; the remainder were `max-w-2xl` paragraphs at `text-sm`/`text-xs` running 96–112 characters per line |

These bind new work now; existing pages come into line as they are touched.

### 6. The house learns
Every production is instrumented with the first-party `track()` helper
(`src/lib/analytics.ts`), so the theater can watch its own audience. Observed
play — not intuition — decides what the next act develops. This pillar is the
artistic version of the repo's "read the analytics before choosing what to
build" rule.

---

## The Director's Log (how the agent interacts and learns)

The theater is not a static gallery; it is a feedback instrument the agent
plays. Protocol, per session that touches games or studio work:

1. **Watch a performance.** Read recent `/api/events` data for theater and
   game events (`cta_click` locations prefixed `theater_`, game-specific
   events like `hardwood_embed_load`, Pente/Go session events). Where the
   backend is reachable, actually play or drive one flow — a puzzle, a round,
   a fight — rather than only reading code.
2. **Write one line.** Append a single dated observation to the Learn Log
   (what the audience did, what the piece taught). One honest line beats a
   report.
3. **Amend on evidence only.** If an observation contradicts a pillar, the
   pillar doesn't silently bend — a change to this file ships as its own
   reviewed diff citing the evidence, exactly like a CLAUDE.md amendment.

This loop is what "letting the agent learn with the theater" means in
practice: instrumented pieces in, observations out, standards amended in
daylight.

---

## The repertory

| Production | Route | Act | Metaphor | Accent |
|---|---|---|---|---|
| Pente | `/posts/pente` | I — Duels | the duel | brass |
| Go | `/posts/go` | I — Duels | the old game | ink light |
| Pente Puzzles | `/posts/pente-puzzles` | II — Trials | the mountain | brass |
| Go Puzzles | `/posts/go/puzzles` | II — Trials | the climb, quieter | ink light |
| Nanu & Pika TD | `/posts/nanu-pika-td` | II — Trials | the siege | void |
| Hardwood Autochess | `/games/hardwood` | III — Seasons | court = stage | Lakers gold |
| Stat Galaxy | `/stat-galaxy` (gated until finished) | Intermission | the observatory | void |
| Luminous Flow | `/posts/luminous-flow` | Intermission | water | brass |

New pieces join the repertory by appearing on `/theater` in the same PR that
ships them — a production without a playbill doesn't exist.

---

## Pre-curtain checklist

Before any game or piece ships, in order:

- [ ] One accent, on the house dark; palette tokens only.
- [ ] Metaphor named in one word; every string on the page speaks it.
- [ ] Frame present: title, playbill note. No money ask.
- [ ] Phone playthrough clean; reduced-motion checked; measured floors met (24px taps, 12px text, measure in `ch`).
- [ ] Loading / empty / error states designed.
- [ ] `track()` events on the moments that matter (entry, the core action, the exit CTA).
- [ ] Listed on `/theater`.
- [ ] Tests green with pasted output — a claim of green is not green.
