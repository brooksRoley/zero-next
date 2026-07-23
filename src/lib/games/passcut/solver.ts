/**
 * Pass & Cut — exact game-tree solver (memoized minimax) for the Shannon
 * switching game. Signatures are FROZEN (shared contract); implementer fills
 * bodies. Runs on the main thread — the board is tiny (< 3^10 states).
 */
import type { Edge, GameState, Level, Winner } from "./graph";

const NOT_IMPLEMENTED = "passcut/solver: not implemented";

/** Winner under optimal play from `state`. */
export function solveValue(_level: Level, _state: GameState): Winner {
  throw new Error(NOT_IMPLEMENTED);
}

/** Optimal edge for defense to cut from `state`, or null if no free edges. */
export function bestDefenseMove(_level: Level, _state: GameState): Edge | null {
  throw new Error(NOT_IMPLEMENTED);
}

/** Optimal edge for offense to secure from `state` (used for hints), or null. */
export function bestOffenseMove(_level: Level, _state: GameState): Edge | null {
  throw new Error(NOT_IMPLEMENTED);
}
