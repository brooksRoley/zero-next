import { useMemo, useState, useCallback } from "react";
import { evMatrix, type RRLevel } from "src/lib/games/readreact/levels";
import { solveZeroSum } from "src/lib/games/readreact/matrixGame";
import { chooseScheme } from "src/lib/games/readreact/defense";

const GOLD = "#FDB927";

export interface SeriesResult {
  points: number;
  benchmark: number;
  possessions: number;
}

interface Props {
  level: RRLevel;
  onComplete: (r: SeriesResult) => void;
}

interface LogEntry {
  play: string;
  scheme: string;
  made: boolean;
  points: number;
  ev: number;
}

export default function ReadReactBoard({ level, onComplete }: Props) {
  const A = useMemo(() => evMatrix(level), [level]);
  const benchmark = useMemo(
    () => solveZeroSum(A).value * level.possessions,
    [A, level.possessions]
  );

  const [playCounts, setPlayCounts] = useState<number[]>(
    () => level.plays.map(() => 0)
  );
  const [possession, setPossession] = useState(0);
  const [points, setPoints] = useState(0);
  const [last, setLast] = useState<LogEntry | null>(null);
  const [done, setDone] = useState(false);

  const callPlay = useCallback(
    (i: number) => {
      if (done) return;
      // Defense reacts to the tendencies revealed BEFORE this possession.
      const j = chooseScheme(A, playCounts);
      const make = level.makeGrid[i][j];
      const made = Math.random() < make;
      const scored = made ? level.plays[i].pts : 0;

      const nextCounts = playCounts.slice();
      nextCounts[i] += 1;
      const nextPoss = possession + 1;
      const nextPoints = points + scored;

      setPlayCounts(nextCounts);
      setPossession(nextPoss);
      setPoints(nextPoints);
      setLast({
        play: level.plays[i].label,
        scheme: level.schemes[j].label,
        made,
        points: scored,
        ev: A[i][j],
      });

      if (nextPoss >= level.possessions) {
        setDone(true);
        onComplete({
          points: nextPoints,
          benchmark,
          possessions: level.possessions,
        });
      }
    },
    [A, benchmark, done, level, onComplete, playCounts, points, possession]
  );

  // Which scheme is the defense currently leaning toward (given history so far)?
  const currentScheme = done ? -1 : chooseScheme(A, playCounts);

  return (
    <div className="rounded-xl border border-forest-700 bg-forest-900/60 p-4 sm:p-6">
      {/* Scoreboard */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="font-mono text-xs uppercase tracking-widest text-forest-400">
          Possession{" "}
          <span className="text-white">
            {Math.min(possession + (done ? 0 : 1), level.possessions)}
          </span>
          {" / "}
          {level.possessions}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>
            Your points:{" "}
            <span className="font-bold" style={{ color: GOLD }}>
              {points}
            </span>
          </span>
          <span className="text-forest-400">
            Par: <span className="text-forest-200">{benchmark.toFixed(1)}</span>
          </span>
        </div>
      </div>

      {/* Scouting report: the EV matrix, with the defense's current lean flagged */}
      <div className="mb-4 overflow-x-auto">
        <table className="w-full border-collapse text-center text-xs sm:text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left font-normal text-forest-400">
                EV (pts) vs…
              </th>
              {level.schemes.map((s, j) => (
                <th
                  key={s.id}
                  className="p-2 font-mono font-normal"
                  style={
                    j === currentScheme
                      ? { color: GOLD }
                      : { color: "#93a5b1" }
                  }
                >
                  {s.label}
                  {j === currentScheme ? " ◂" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {level.plays.map((p, i) => (
              <tr key={p.id} className="border-t border-forest-800">
                <td className="p-2 text-left text-forest-200">
                  {p.label}{" "}
                  <span className="text-forest-500">({p.pts})</span>
                </td>
                {level.schemes.map((s, j) => (
                  <td
                    key={s.id}
                    className="p-2 font-mono tabular-nums"
                    style={
                      j === currentScheme
                        ? { color: "#e6edf1" }
                        : { color: "#6b7f8b" }
                    }
                  >
                    {A[i][j].toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Play buttons */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {level.plays.map((p, i) => (
          <button
            key={p.id}
            type="button"
            disabled={done}
            onClick={() => callPlay(i)}
            className="rounded-lg border border-forest-600 bg-forest-800/80 px-3 py-3 text-sm font-medium text-white transition hover:border-[#FDB927] hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {p.label}
            <span className="ml-1 text-forest-400">· {p.pts}pt</span>
          </button>
        ))}
      </div>

      {/* Last possession feedback */}
      <div
        className="min-h-[2.5rem] rounded-lg bg-forest-950/60 px-3 py-2 text-sm"
        aria-live="polite"
        data-testid="last-feedback"
      >
        {last ? (
          <span>
            <span className="text-forest-300">You ran </span>
            <span className="text-white">{last.play}</span>
            <span className="text-forest-300"> · defense played </span>
            <span style={{ color: GOLD }}>{last.scheme}</span>
            <span className="text-forest-300"> → </span>
            {last.made ? (
              <span className="text-emerald-400">
                bucket, +{last.points}
              </span>
            ) : (
              <span className="text-rose-400">miss, +0</span>
            )}
            <span className="text-forest-500">
              {" "}
              (EV {last.ev.toFixed(2)})
            </span>
          </span>
        ) : (
          <span className="text-forest-400">
            Call a play. The defense adapts to your tendencies — don&apos;t get
            predictable.
          </span>
        )}
      </div>
    </div>
  );
}
