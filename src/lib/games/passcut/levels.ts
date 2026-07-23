/**
 * Pass & Cut — curated concept campaign as data.
 *
 * Each level is a small basketball passing graph (5 nodes on a normalized
 * 0..100 half-court, rim at bottom-center ~ (50,86)). Edges are candidate pass
 * lanes; terminals are [inbounder PG, finisher-at-rim C]. Offense secures a
 * lane per turn, defense cuts one; offense wins when its secured lanes connect
 * the terminals, defense wins when the un-cut graph can no longer connect them.
 *
 * The campaign arcs in difficulty: early boards give offense two clearly
 * independent paths to the rim (a "double" structure → forced win), a middle
 * board sits near the winnable/unwinnable threshold, and at least one board is
 * a defense win with a tight min-cut lesson.
 *
 * NOTE: `intendedWinner` is the author's BEST GUESS. It cannot be fully verified
 * here while solver.ts / graph.ts ship as throwing stubs. Integration validates
 * each level with the real solver by asserting
 *   solveValue(level, initialState(level)) === level.intendedWinner
 * and will adjust these values (or the edge sets) if a guess is wrong.
 */
import type { Level } from "./graph";

// Shared half-court positions reused across levels (normalized 0..100).
// Rim/hoop sits conceptually at bottom-center; PG inbounds up top.
const PG = { id: "PG", label: "PG", x: 50, y: 12 }; // point guard, up top (inbounder)
const LW = { id: "SG", label: "SG", x: 18, y: 40 }; // left wing
const RW = { id: "SF", label: "SF", x: 82, y: 40 }; // right wing
const HE = { id: "PF", label: "PF", x: 50, y: 55 }; // high-elbow / free-throw hub
const C = { id: "C", label: "C", x: 50, y: 86 }; // center / finisher at the rim

const FIVE = [PG, LW, RW, HE, C];

export const LEVELS: Level[] = [
  {
    id: "give-and-go",
    title: "Give & Go",
    concept: "paths",
    nodes: FIVE,
    edges: [
      { a: "PG", b: "C" },
      { a: "PG", b: "SG" },
      { a: "PG", b: "PF" },
      { a: "SG", b: "C" },
      { a: "PF", b: "C" },
    ],
    terminals: ["PG", "C"],
    teaching:
      "The win condition: a chain of SECURED lanes from the inbounder (PG) to the finisher at the rim (C). You move first, and here the PG has a direct skip pass to the rim (PG-C) — take the open line before the defense can react. Every later level takes the easy lane away and makes the defense's move matter.",
    firstMove: "offense",
    intendedWinner: "offense",
  },
  {
    id: "two-ways-home",
    title: "Two Ways Home",
    concept: "edge-disjoint paths",
    nodes: FIVE,
    edges: [
      { a: "PG", b: "SG" },
      { a: "PG", b: "SF" },
      { a: "SG", b: "C" },
      { a: "SF", b: "C" },
      { a: "SG", b: "SF" },
    ],
    terminals: ["PG", "C"],
    teaching:
      "Both wings can feed the rim (SG-C and SF-C) and both catch from the PG. The extra wing-to-wing lane is a bridge that lets you re-route around a cut. With two clean ways to the rim, second-mover offense always has an answer.",
    firstMove: "offense",
    intendedWinner: "offense",
  },
  {
    id: "double-screen",
    title: "Double Screen",
    concept: "connectivity",
    nodes: FIVE,
    edges: [
      { a: "PG", b: "SG" },
      { a: "PG", b: "SF" },
      { a: "PG", b: "PF" },
      { a: "SG", b: "PF" },
      { a: "SF", b: "PF" },
      { a: "SG", b: "C" },
      { a: "PF", b: "C" },
    ],
    terminals: ["PG", "C"],
    teaching:
      "Two independent webs reach the rim — SG-C and PF-C — and the PG feeds both through the screens. The winning structure isn't one path, it's two edge-disjoint spanning trees: every lane the defense cuts still leaves a whole tree standing. Redundancy, not a single route, is what wins.",
    firstMove: "offense",
    intendedWinner: "offense",
  },
  {
    id: "high-low",
    title: "High–Low",
    concept: "spanning connection",
    nodes: FIVE,
    edges: [
      { a: "PG", b: "PF" },
      { a: "PG", b: "SG" },
      { a: "PG", b: "SF" },
      { a: "SG", b: "PF" },
      { a: "SF", b: "PF" },
      { a: "PF", b: "C" },
      { a: "SF", b: "C" },
    ],
    terminals: ["PG", "C"],
    teaching:
      "The high post (PF) links everything up top; from there it's a high-low feed to the rim. There's also a wing back-door (SF-C). Two independent trees reach both terminals, so you can spanning-connect PG to C no matter which lane gets denied first.",
    firstMove: "offense",
    intendedWinner: "offense",
  },
  {
    id: "pick-your-poison",
    title: "Pick Your Poison",
    concept: "threshold",
    nodes: FIVE,
    edges: [
      { a: "PG", b: "SF" },
      { a: "PG", b: "PF" },
      { a: "SF", b: "PF" },
      { a: "SF", b: "C" },
      { a: "PF", b: "C" },
      { a: "PG", b: "SG" },
    ],
    terminals: ["PG", "C"],
    teaching:
      "The minimum winning web, with no slack — plus a trap. The real structure is the two-tree over PG-SF-PF-C, but the PG-SG lane is a decoy: SG can't reach the rim, so spending a move there hands the defense tempo and the game flips to a loss. This is the threshold — secure only the lanes that carry a tree, in the right order, and you're through.",
    firstMove: "offense",
    intendedWinner: "offense",
  },
  {
    id: "the-trap",
    title: "The Trap",
    concept: "min-cut",
    nodes: FIVE,
    edges: [
      { a: "PG", b: "SG" },
      { a: "PG", b: "SF" },
      { a: "SG", b: "PF" },
      { a: "SF", b: "PF" },
      { a: "PF", b: "C" },
    ],
    terminals: ["PG", "C"],
    firstMove: "defense",
    teaching:
      "The rim is guarded by exactly ONE lane: PF-C. That single edge is the min-cut — a bottleneck of size one. Moving first, the defense simply denies PF-C and the rim is sealed off; nothing you secure afterward can reach the basket. The lesson: find the narrowest cut, because that's where the defense lives.",
    // Defense moves first and cuts the size-1 min-cut (PF-C) → offense can never connect.
    intendedWinner: "defense",
  },
  {
    id: "sagging-defense",
    title: "Sagging Defense",
    concept: "bottleneck",
    nodes: FIVE,
    edges: [
      { a: "PG", b: "SG" },
      { a: "PG", b: "SF" },
      { a: "PG", b: "PF" },
      { a: "SG", b: "PF" },
      { a: "SF", b: "PF" },
      { a: "PF", b: "C" },
    ],
    terminals: ["PG", "C"],
    firstMove: "defense",
    teaching:
      "The whole offense collapses onto the PF and only the PF can find the rim (PF-C). Every route to the basket passes through that one lane — a min-cut of size one no matter how many ways you reach the PF. The defense sags off, cuts PF-C, and the paint is walled. Spread the floor: give the rim more than one feeder.",
    // Regardless of how richly PG connects to PF, the sole PF-C lane is the size-1
    // cut; defense-first denies it and wins. Guess pending real-solver validation.
    intendedWinner: "defense",
  },
];
