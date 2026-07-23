import { useCallback, useEffect, useRef, useState } from "react";
import {
  connected,
  edgeKey,
  initialState,
  type Edge,
  type GameState,
  type Level,
  type NodePos,
  type Winner,
} from "src/lib/games/passcut/graph";
import { bestDefenseMove, bestOffenseMove } from "src/lib/games/passcut/solver";

interface PassCutBoardProps {
  level: Level;
  onResult: (winner: "offense" | "defense") => void;
}

const DEFENSE_DELAY_MS = 520;
const HINT_MS = 1300;

// Lakers palette accents.
const GOLD = "#FDB927";
const PURPLE = "#552583";

export default function PassCutBoard({ level, onResult }: PassCutBoardProps) {
  const [gs, setGs] = useState<GameState>(() => initialState(level));
  const [status, setStatus] = useState<"playing" | "done">("playing");
  const [pending, setPending] = useState<GameState | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hintKey, setHintKey] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nodeById = useCallback(
    (id: string): NodePos | undefined => level.nodes.find((n) => n.id === id),
    [level]
  );

  // Offense wins when SECURED edges connect the terminals; defense wins when the
  // non-cut edges (secured ∪ free) no longer can. Returns null while undecided.
  const checkOutcome = useCallback(
    (state: GameState): Winner | null => {
      const secured = level.edges.filter(
        (e) => state.states[edgeKey(e.a, e.b)] === "secured"
      );
      if (connected(level.terminals, secured)) return "offense";
      const nonCut = level.edges.filter(
        (e) => state.states[edgeKey(e.a, e.b)] !== "cut"
      );
      if (!connected(level.terminals, nonCut)) return "defense";
      return null;
    },
    [level]
  );

  const finish = useCallback(
    (winner: Winner) => {
      setStatus("done");
      onResult(winner);
    },
    [onResult]
  );

  // Reset whenever the level changes.
  useEffect(() => {
    const init = initialState(level);
    setGs(init);
    setStatus("playing");
    setThinking(false);
    setHintKey(null);
    // If the defense inbounds first, queue its opening cut.
    setPending(init.turn === "defense" ? init : null);
  }, [level]);

  // Resolve a queued defense move.
  useEffect(() => {
    if (!pending) return;
    setThinking(true);
    const t = setTimeout(() => {
      const move = bestDefenseMove(level, pending);
      let after: GameState;
      if (move) {
        const key = edgeKey(move.a, move.b);
        after = {
          states: { ...pending.states, [key]: "cut" },
          turn: "offense",
        };
      } else {
        after = { ...pending, turn: "offense" };
      }
      setGs(after);
      setThinking(false);
      setPending(null);
      const outcome = checkOutcome(after);
      if (outcome) finish(outcome);
    }, DEFENSE_DELAY_MS);
    return () => clearTimeout(t);
  }, [pending, level, checkOutcome, finish]);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const handleSecure = (edge: Edge) => {
    if (status !== "playing" || thinking || pending || gs.turn !== "offense") return;
    const key = edgeKey(edge.a, edge.b);
    if (gs.states[key] !== "free") return;
    const next: GameState = {
      states: { ...gs.states, [key]: "secured" },
      turn: "defense",
    };
    setGs(next);
    const outcome = checkOutcome(next);
    if (outcome) {
      finish(outcome);
      return;
    }
    setPending(next);
  };

  const showHint = () => {
    if (status !== "playing" || thinking || pending || gs.turn !== "offense") return;
    const move = bestOffenseMove(level, gs);
    if (!move) return;
    setHintKey(edgeKey(move.a, move.b));
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintKey(null), HINT_MS);
  };

  const turnLabel =
    status === "done"
      ? "Possession over"
      : thinking || pending
      ? "Defense is denying a lane…"
      : "Your ball — tap a pass lane to secure it";

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p
          className="text-sm font-medium text-forest-200"
          aria-live="polite"
        >
          {turnLabel}
        </p>
        <button
          type="button"
          onClick={showHint}
          disabled={status !== "playing" || thinking || !!pending || gs.turn !== "offense"}
          className="rounded-full border border-[#552583] bg-[#552583]/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#552583]/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Hint
        </button>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-forest-800 bg-forest-950 shadow-xl shadow-black/40">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full"
          role="img"
          aria-label={`Pass and Cut board: ${level.title}`}
        >
          {/* ── Half court markings ── */}
          <rect x="1" y="1" width="98" height="98" rx="3" fill="#081f15" stroke="#143728" strokeWidth="0.6" />
          {/* paint / key */}
          <rect x="36" y="58" width="28" height="38" fill="#0d2b1e" stroke="#1b4332" strokeWidth="0.5" />
          {/* free-throw circle */}
          <circle cx="50" cy="58" r="9" fill="none" stroke="#1b4332" strokeWidth="0.5" />
          {/* three-point arc */}
          <path d="M 14 96 L 14 78 A 36 36 0 0 0 86 78 L 86 96" fill="none" stroke="#143728" strokeWidth="0.5" />
          {/* baseline */}
          <line x1="4" y1="96" x2="96" y2="96" stroke="#1b4332" strokeWidth="0.6" />
          {/* backboard + hoop at bottom-center */}
          <line x1="45" y1="93" x2="55" y2="93" stroke="#40916c" strokeWidth="0.7" />
          <circle cx="50" cy="90.5" r="1.7" fill="none" stroke="#f97316" strokeWidth="0.8" />

          {/* ── Edges (pass lanes) ── */}
          {level.edges.map((edge) => {
            const a = nodeById(edge.a);
            const b = nodeById(edge.b);
            if (!a || !b) return null;
            const key = edgeKey(edge.a, edge.b);
            const state = gs.states[key] ?? "free";
            const isHint = hintKey === key;
            let stroke = "#5b6b7a";
            let width = 1.6;
            let dash: string | undefined;
            let opacity = 0.75;
            if (state === "secured") {
              stroke = GOLD;
              width = 2.8;
              opacity = 1;
            } else if (state === "cut") {
              stroke = "#ef4444";
              width = 1.6;
              dash = "3 2";
              opacity = 0.55;
            }
            const tappable = state === "free" && status === "playing";
            return (
              <g key={key}>
                {isHint && (
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={PURPLE}
                    strokeWidth={5}
                    strokeLinecap="round"
                    opacity={0.6}
                  >
                    <animate
                      attributeName="opacity"
                      values="0.15;0.7;0.15"
                      dur="0.9s"
                      repeatCount="indefinite"
                    />
                  </line>
                )}
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={stroke}
                  strokeWidth={width}
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  opacity={opacity}
                />
                {/* wide invisible hit target for easy tapping */}
                {tappable && (
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth={8}
                    strokeLinecap="round"
                    className="cursor-pointer"
                    style={{ pointerEvents: "stroke" }}
                    onClick={() => handleSecure(edge)}
                    role="button"
                    aria-label={`Secure pass lane ${edge.a} to ${edge.b}`}
                  />
                )}
              </g>
            );
          })}

          {/* ── Nodes (players) ── */}
          {level.nodes.map((n) => {
            const isTerminal = level.terminals.includes(n.id);
            return (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={5.2}
                  fill={isTerminal ? PURPLE : "#143728"}
                  stroke={isTerminal ? GOLD : "#40916c"}
                  strokeWidth={isTerminal ? 1.2 : 0.7}
                />
                <text
                  x={n.x}
                  y={n.y + 1.9}
                  textAnchor="middle"
                  fontSize="4.2"
                  fontWeight="700"
                  fill="#ffffff"
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Legend ── */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-forest-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ background: "#5b6b7a" }} />
          Open lane
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ background: GOLD }} />
          Secured
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ background: "#ef4444" }} />
          Denied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PURPLE, border: `1px solid ${GOLD}` }} />
          Inbounder / Rim
        </span>
      </div>
    </div>
  );
}
