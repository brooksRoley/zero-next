/**
 * Perennials: a skill tree that grows beside the garden and never resets.
 *
 * A habit file of version 3 may carry `skills`, written by Brooks's job-search
 * tool (`agent.py tree`): one node per skill, each with a few rungs that
 * unlock only when that tool holds evidence for them (a repo or PR link, a
 * live page, a measured result, a design note). The file carries none of that
 * evidence. Each node is just its id, a public skill name, its branch, how
 * many rungs it has, and one slot per rung:
 *
 *   { "id": "nextjs", "name": "Next.js", "branch": "Frontend",
 *     "rungs": 4, "unlocked": 2, "dates": ["", "2026-10-20", null, null] }
 *
 * A slot is the date the rung unlocked, "" for a rung unlocked before the
 * tool kept dates, or null while it is locked.
 *
 * Perennials are not beds: they take no seed, no square of the grid, and no
 * season puts them to sleep. Importing only ever adds to them, so a rung once
 * shown stays shown, and the same file imported twice changes nothing.
 */

export type RungSlot = string | null

export type Perennial = {
  id: string
  name: string
  branch: string
  /** One slot per rung: the unlock date, "" when unlocked on an unknown date, null while locked. */
  dates: RungSlot[]
}

/** The number of growth stages a perennial draws: seed, sprout, sapling, young tree, permanent tree. */
export const PERENNIAL_STAGES = 5

/**
 * The rung names the job-search tool uses for a four-rung node, in order.
 * DRAFT COPY for Brooks's review; it must match `skilltree.RUNGS` in that tool.
 */
export const RUNG_LABELS_4 = ['Used it', 'Shipped it', 'Measured it', 'Wrote the design note'] as const

/** DRAFT COPY for Brooks's review. Plain and true: it says what the trees are and adds no praise. */
export const PERENNIAL_COPY = {
  title: 'Perennials',
  intro:
    'Your skill tree, from the file you imported. A rung opens only when the tool that wrote the file holds evidence for it: a repo or PR link, a live page, a measured result or a design note. Perennials never go dormant and never reset.',
  permanent: 'Permanent tree',
  locked: 'Not yet',
  undated: 'on record',
} as const

const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** A tree this size is not one the tool wrote. */
const MAX_NODES = 120
const MAX_RUNGS = 8
const MAX_TEXT = 40

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TEXT && !v.includes('://')
/** A calendar date that exists ("2026-02-30" does not). */
const isDate = (v: string) => {
  if (!DATE_RE.test(v)) return false
  const t = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v
}
const isSlot = (v: unknown): v is RungSlot => v === null || v === '' || (typeof v === 'string' && isDate(v))

export function unlockedCount(p: Perennial): number {
  return p.dates.filter((d) => d !== null).length
}

export function isPermanent(p: Perennial): boolean {
  return p.dates.length > 0 && unlockedCount(p) === p.dates.length
}

/** 0 (seed) to 4 (permanent tree): a stage per rung for a four-rung node, scaled for any other size. */
export function perennialStage(p: Perennial): number {
  if (isPermanent(p)) return PERENNIAL_STAGES - 1
  return Math.min(PERENNIAL_STAGES - 2, Math.floor((unlockedCount(p) * (PERENNIAL_STAGES - 1)) / p.dates.length))
}

/** The `skills` section of a habit file, shape-checked. Null for anything the tool would not have written. */
export function parseSkills(raw: unknown): Perennial[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_NODES) return null
  const out: Perennial[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!isRecord(item)) return null
    const { id, name, branch, rungs, unlocked, dates } = item
    if (typeof id !== 'string' || !ID_RE.test(id) || seen.has(id)) return null
    if (!isText(name) || !isText(branch)) return null
    if (!Number.isInteger(rungs) || (rungs as number) < 1 || (rungs as number) > MAX_RUNGS) return null
    if (!Array.isArray(dates) || dates.length !== rungs || !dates.every(isSlot)) return null
    if (unlocked !== dates.filter((d) => d !== null).length) return null
    seen.add(id)
    out.push({ id, name, branch, dates: [...dates] })
  }
  return out
}

/** Shape check for a saved garden's `perennials` (which carries no `rungs`/`unlocked`: the slots hold both). */
export function isPerennials(v: unknown): v is Perennial[] {
  return (
    Array.isArray(v) &&
    v.every(
      (p) =>
        isRecord(p) &&
        typeof p.id === 'string' &&
        ID_RE.test(p.id) &&
        isText(p.name) &&
        isText(p.branch) &&
        Array.isArray(p.dates) &&
        p.dates.length >= 1 &&
        p.dates.length <= MAX_RUNGS &&
        p.dates.every(isSlot),
    )
  )
}

/** One rung, both sides seen: unlocked if either says so, dated by the earliest real date. */
function mergeSlot(a: RungSlot | undefined, b: RungSlot | undefined): RungSlot {
  const slots = [a, b].filter((s): s is string => s !== null && s !== undefined)
  if (!slots.length) return null
  const dated = slots.filter((s) => s !== '').sort()
  return dated[0] ?? ''
}

/**
 * Fold an imported tree into the garden's. Never takes a rung away, never
 * drops a node and never moves a date later; names and branches follow the
 * newest file. Returns the old list itself when nothing changed.
 */
export function mergePerennials(
  had: readonly Perennial[] | undefined,
  incoming: readonly Perennial[],
): { perennials: Perennial[]; opened: number; changed: boolean } {
  const old = new Map((had ?? []).map((p) => [p.id, p]))
  const merged: Perennial[] = []
  let opened = 0
  for (const p of incoming) {
    const was = old.get(p.id)
    old.delete(p.id)
    const length = Math.max(p.dates.length, was?.dates.length ?? 0)
    const dates = Array.from({ length }, (_, i) => mergeSlot(was?.dates[i], p.dates[i]))
    opened += dates.filter((d, i) => d !== null && (was?.dates[i] ?? null) === null).length
    merged.push({ id: p.id, name: p.name, branch: p.branch, dates })
  }
  // A node the newest file no longer lists stays: a perennial is never pulled up.
  const kept = [...merged, ...old.values()]
  const changed = JSON.stringify(kept) !== JSON.stringify(had ?? [])
  return { perennials: changed ? kept : [...(had ?? [])], opened, changed }
}

/** Nodes grouped by branch, in the order the branches first appear. */
export function byBranch(perennials: readonly Perennial[]): { branch: string; nodes: Perennial[] }[] {
  const groups = new Map<string, Perennial[]>()
  for (const p of perennials) groups.set(p.branch, [...(groups.get(p.branch) ?? []), p])
  return [...groups.entries()].map(([branch, nodes]) => ({ branch, nodes }))
}

/** The rung names to show for a node: the tool's own for four rungs, else numbered. */
export function rungLabels(p: Perennial): string[] {
  return p.dates.length === RUNG_LABELS_4.length ? [...RUNG_LABELS_4] : p.dates.map((_, i) => `Rung ${i + 1}`)
}
