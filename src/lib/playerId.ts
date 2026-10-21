import { track } from 'src/lib/analytics'

/**
 * One anonymous player id for every game on the site.
 *
 * Pente (`players.id`) and Go (`go_players.id`) used to mint separate UUIDs, so
 * the same visitor was two strangers. Both now key their profile rows off this
 * id. Profiles stay per-game (ratings do not compare across games); only the
 * identity is shared.
 *
 * Adoption order for a browser that already has an id, so nobody's server row
 * is orphaned without need: the shared key, then Pente's id (most players),
 * then Go's. Whichever loses is reported once as an `identity_link` event so
 * old rows can still be joined to the shared id.
 */

export const PLAYER_ID_KEY = 'zero.player_id'
export const LEGACY_PENTE_ID_KEY = 'pente_player_id'
export const GO_PROFILE_KEY = 'go.profile.v2'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Older Go builds stored `go-<uuid>`; the uuid columns need the bare uuid. */
export function normalizeUuid(id: unknown): string | null {
  if (typeof id !== 'string') return null
  const stripped = id.startsWith('go-') ? id.slice(3) : id
  return UUID_RE.test(stripped) ? stripped.toLowerCase() : null
}

export function newUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`
}

function readGoProfileId(): string | null {
  try {
    const raw = localStorage.getItem(GO_PROFILE_KEY)
    return raw ? normalizeUuid(JSON.parse(raw)?.playerId) : null
  } catch {
    return null
  }
}

// Fallback when storage is blocked (private mode): stable for this page load.
let memoryId: string | null = null

export function getPlayerId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const shared = normalizeUuid(localStorage.getItem(PLAYER_ID_KEY))
    if (shared) return shared

    const pente = normalizeUuid(localStorage.getItem(LEGACY_PENTE_ID_KEY))
    const go = readGoProfileId()
    const id = pente ?? go ?? newUuid()
    localStorage.setItem(PLAYER_ID_KEY, id)

    // Join the new identity to analytics (events.anon_id), and record any
    // per-game id it replaces so that game's earlier rows stay attributable.
    track('identity_link', { metadata: { kind: 'player', player_id: id } })
    if (go && go !== id) {
      track('identity_link', { metadata: { kind: 'player_merge', player_id: id, previous_id: go, game: 'go' } })
    }
    return id
  } catch {
    memoryId ??= newUuid()
    return memoryId
  }
}
