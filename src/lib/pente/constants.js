export const BOARD_SIZE = 19
export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2
export const RED = 3
export const BLUE = 4

export const STATUS_WAITING = 'waiting'
export const STATUS_IN_PROGRESS = 'in_progress'
export const STATUS_FINISHED = 'finished'

// Game mode configurations
export const GAME_MODES = {
  classic: {
    key: 'classic',
    name: 'Classic 1v1',
    players: 2,
    turnOrder: [BLACK, WHITE],
    teams: null,
    captureThreshold: 5,
  },
  ffa4: {
    key: 'ffa4',
    name: 'Free-for-All',
    players: 4,
    turnOrder: [BLACK, WHITE, RED, BLUE],
    teams: null,
    captureThreshold: 5,
  },
  team2v2: {
    key: 'team2v2',
    name: '2v2 Teams',
    players: 4,
    turnOrder: [BLACK, RED, WHITE, BLUE], // alternates teams
    teams: [[BLACK, WHITE], [RED, BLUE]], // team 0 vs team 1
    captureThreshold: 5,                  // per-team total
  },
}

// Color metadata for rendering
export const PLAYER_COLORS = {
  [BLACK]: { name: 'Black', css: 'black', hex: '#1a1a1a' },
  [WHITE]: { name: 'White', css: 'white', hex: '#f5f5f5' },
  [RED]:   { name: 'Red',   css: 'red',   hex: '#dc2626' },
  [BLUE]:  { name: 'Blue',  css: 'blue',  hex: '#2563eb' },
}

/**
 * Get team index for a player, or -1 if FFA/no teams.
 */
export function getTeamIndex(player, gameMode) {
  if (!gameMode?.teams) return -1
  return gameMode.teams.findIndex(team => team.includes(player))
}

/**
 * Is target an opponent of player in the given game mode?
 */
export function isOpponent(player, target, gameMode) {
  if (target === EMPTY) return false
  if (!gameMode?.teams) return target !== player
  return getTeamIndex(player, gameMode) !== getTeamIndex(target, gameMode)
}

/**
 * Is target a teammate of player (not self)?
 */
export function isTeammate(player, target, gameMode) {
  if (!gameMode?.teams) return false
  if (player === target) return false
  return getTeamIndex(player, gameMode) === getTeamIndex(target, gameMode)
}
