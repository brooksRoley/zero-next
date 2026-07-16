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
| `forest-950` | `#04120c` | The house dark. Default page ground. |
| `forest-300/400/500` | greens | Supporting text, program notes. |
| `candy-400/500` | `#ff69b4` / `#f24da0` | The theater's own light — marquee, tip-jar, studio accents. |
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

### 3. One metaphor, held
Every piece commits to a single figurative frame and never mixes:
mountain = mastery (Pente Puzzles), water = flow (Luminous Flow),
galaxy = scale (Stat Galaxy), court = stage (Hardwood), garden = growth
(reserved). The metaphor governs copy, motion, and reward moments together.
If a feature can't be said inside the piece's metaphor, it belongs elsewhere.

### 4. Every piece gets a frame
Title, a one-paragraph playbill note rendered on the page, and a tip-jar link
to `/funding`. Art is the audience funnel, not a detour from it. The frame is
part of the work: an unframed piece is not shipped, it's abandoned on stage.

### 5. The craft floor
Complete and working, mobile-first, no placeholder art. Loading, empty, and
error states are *designed*, not defaulted. WCAG AA contrast, visible focus.
**Art that crashes is a bug, not a statement** — production quality is what
lets a piece be shown proudly by a creator, not just a developer.

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
| Pente | `/posts/pente` | I — Duels | the duel | candy |
| Go | `/posts/go` | I — Duels | the old game | forest light |
| Pente Puzzles | `/posts/pente-puzzles` | II — Trials | the mountain | candy |
| Go Puzzles | `/posts/go/puzzles` | II — Trials | the climb, quieter | forest light |
| Nanu & Pika TD | `/posts/nanu-pika-td` | II — Trials | the siege | void |
| Hardwood Autochess | `/games/hardwood` | III — Seasons | court = stage | Lakers gold |
| Stat Galaxy | `/stat-galaxy` | Intermission | the observatory | void |
| Luminous Flow | `/posts/luminous-flow` | Intermission | water | candy |

New pieces join the repertory by appearing on `/theater` in the same PR that
ships them — a production without a playbill doesn't exist.

---

## Pre-curtain checklist

Before any game or piece ships, in order:

- [ ] One accent, on the house dark; palette tokens only.
- [ ] Metaphor named in one word; every string on the page speaks it.
- [ ] Frame present: title, playbill note, `/funding` link.
- [ ] Phone playthrough clean; reduced-motion checked.
- [ ] Loading / empty / error states designed.
- [ ] `track()` events on the moments that matter (entry, the core action, the exit CTA).
- [ ] Listed on `/theater`.
- [ ] Tests green with pasted output — a claim of green is not green.
