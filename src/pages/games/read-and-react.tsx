import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReadReactBoard, {
  type SeriesResult,
} from "src/components/games/ReadReactBoard";
import { LEVELS, evMatrix } from "src/lib/games/readreact/levels";
import { solveZeroSum } from "src/lib/games/readreact/matrixGame";
import { track, trackGame } from "src/lib/analytics";
import {
  clearScouting, emptyScouting, headlineRead, loadScouting, priorCounts, recordSeries, saveScouting,
  type Scouting,
} from "src/lib/games/readreact/scouting";
import { absoluteUrl } from 'src/lib/routes'

const GOLD = "#FDB927";
const PROGRESS_KEY = "readreact_progress"; // finished level ids (unlocks next)
const BEATEN_KEY = "readreact_beaten"; // ids where you beat par (star)

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function loadIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function ReadAndReact() {
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [beaten, setBeaten] = useState<string[]>([]);
  const [result, setResult] = useState<SeriesResult | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  // The scouting report as it stands now, and as it stood when this series
  // began: the defense plays the series on the file it walked in with.
  const [scouting, setScouting] = useState<Scouting>(emptyScouting);
  const [fileAtTipoff, setFileAtTipoff] = useState<Scouting>(emptyScouting);

  useEffect(() => {
    setCompleted(loadIds(PROGRESS_KEY));
    setBeaten(loadIds(BEATEN_KEY));
    const file = loadScouting(browserStorage());
    setScouting(file);
    setFileAtTipoff(file);
  }, []);

  const level = LEVELS[index];
  const prior = useMemo(() => priorCounts(fileAtTipoff, level), [fileAtTipoff, level]);
  const readOnYou = headlineRead(fileAtTipoff, level);
  const learned = result ? headlineRead(scouting, level) : null;
  const reveal = useMemo(
    () => (result ? solveZeroSum(evMatrix(level)) : null),
    [result, level]
  );

  const handleComplete = useCallback(
    (r: SeriesResult) => {
      setResult(r);
      setCompleted((prev) => {
        if (prev.includes(level.id)) return prev;
        const next = [...prev, level.id];
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
        }
        return next;
      });
      if (r.points >= r.benchmark) {
        setBeaten((prev) => {
          if (prev.includes(level.id)) return prev;
          const next = [...prev, level.id];
          if (typeof window !== "undefined") {
            window.localStorage.setItem(BEATEN_KEY, JSON.stringify(next));
          }
          return next;
        });
      }
      track("readreact_result", {
        page: "/games/read-and-react",
        metadata: {
          level: level.id,
          points: r.points,
          benchmark: r.benchmark,
          beatPar: r.points >= r.benchmark,
        },
      });
      trackGame("game_end", "read-and-react", {
        level: level.id,
        result: r.points >= r.benchmark ? "win" : "loss",
      });
      setScouting((prev) => {
        const next = recordSeries(prev, level, r.playCounts);
        saveScouting(browserStorage(), next);
        return next;
      });
    },
    [level]
  );

  const handleStart = useCallback(() => {
    trackGame("game_start", "read-and-react", {
      level: level.id,
      scouted: prior.some((c) => c > 0),
    });
  }, [level.id, prior]);

  const wipeFile = useCallback(() => {
    clearScouting(browserStorage());
    setScouting(emptyScouting());
    setFileAtTipoff(emptyScouting());
    setResult(null);
    setBoardKey((k) => k + 1);
  }, []);

  const goTo = useCallback((i: number) => {
    setIndex(i);
    setResult(null);
    setFileAtTipoff(scouting);
    setBoardKey((k) => k + 1);
  }, [scouting]);

  const retry = useCallback(() => {
    setResult(null);
    setFileAtTipoff(scouting);
    setBoardKey((k) => k + 1);
  }, [scouting]);

  const isUnlocked = (i: number) =>
    i === 0 || completed.includes(LEVELS[i - 1].id);

  const beatPar = result ? result.points >= result.benchmark : false;

  return (
    <main className="min-h-screen bg-forest-950 text-white font-sans">
      <Head>
        <title>Read &amp; React | Brooks Roley</title>
        <meta
          name="description"
          content="Read & React — a basketball game-theory puzzle. Call plays against an adaptive defense that punishes predictability; find the mixed strategy that beats a perfect read."
        />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:title" content="Read & React — Brooks Roley" key="og:title" />
        <meta
          property="og:description"
          content="A basketball game-theory puzzle. Call plays against an adaptive defense that punishes predictability, and find the mixed strategy that beats a perfect read."
          key="og:description"
        />
        <meta property="og:url" content={absoluteUrl('readAndReact')} key="og:url" />
      </Head>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
        <header className="mb-8">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[#FDB927]/80">
            Basketball Game Theory
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Read &amp; <span style={{ color: GOLD }}>React</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-forest-300 sm:text-base">
            Every possession you call a play; the defense answers with a coverage.
            Each matchup is worth a number of <em>expected points</em> — grounded in
            real shot efficiency. The catch: the defense watches what you like and
            sits on it. Lean on your best shot and it disappears. The winning
            answer is a <strong>mixed strategy</strong> — the blend a perfect read
            can&apos;t beat. Score the <span style={{ color: GOLD }}>par</span> (the
            game&apos;s theoretical value) and you&apos;ve out-read the defense.
          </p>
        </header>

        {/* Level selector */}
        <nav
          aria-label="Levels"
          className="mb-6 flex flex-wrap gap-2"
        >
          {LEVELS.map((l, i) => {
            const unlocked = isUnlocked(i);
            const star = beaten.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                disabled={!unlocked}
                onClick={() => goTo(i)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  i === index
                    ? "border-[#FDB927] bg-forest-800 text-white"
                    : "border-forest-700 bg-forest-900/50 text-forest-300 hover:border-forest-500"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {star ? "★" : unlocked ? i + 1 : "🔒"} {i === index ? l.title : ""}
              </button>
            );
          })}
        </nav>

        {/* Current level heading */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold">
            {index + 1}. {level.title}
          </h2>
          <p className="text-sm text-forest-400">Concept: {level.concept}</p>
        </div>

        {/* Scouting report: what the defense remembers from earlier visits */}
        {readOnYou && (
          <aside
            aria-label="Scouting report"
            className="mb-4 rounded-xl border border-forest-700 bg-forest-900/50 p-4"
          >
            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-forest-400">
              Scouting report on you
            </p>
            <p className="text-sm leading-relaxed text-forest-200">
              Their file covers {readOnYou.series} series of yours: you
              call <strong className="text-white">{readOnYou.label}</strong>{" "}
              <span className="font-mono" style={{ color: GOLD }}>
                {Math.round(readOnYou.share * 100)}%
              </span>{" "}
              of the time. Expect the defense to sit on it from the first possession.
            </p>
            <button
              type="button"
              onClick={wipeFile}
              className="mt-2 text-xs text-forest-400 underline-offset-2 hover:text-forest-200 hover:underline"
            >
              Wipe the file and start fresh
            </button>
          </aside>
        )}

        <ReadReactBoard
          key={boardKey}
          level={level}
          prior={prior}
          onStart={handleStart}
          onComplete={handleComplete}
        />

        {/* Reveal overlay */}
        {result && reveal && (
          <div className="mt-6 rounded-xl border border-[#FDB927]/40 bg-forest-900/80 p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-semibold">
                {beatPar ? (
                  <span style={{ color: GOLD }}>You out-read the defense.</span>
                ) : (
                  <span className="text-forest-100">The defense read you.</span>
                )}
              </h3>
              <span className="font-mono text-sm text-forest-300">
                {result.points} pts · par {result.benchmark.toFixed(1)}
              </span>
            </div>

            <div className="mb-3 rounded-lg bg-forest-950/60 p-3">
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-forest-400">
                The unbeatable mix (game value {reveal.value.toFixed(2)}/poss.)
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {level.plays.map((p, i) => (
                  <span key={p.id}>
                    <span className="text-forest-200">{p.label}: </span>
                    <span className="font-mono" style={{ color: GOLD }}>
                      {Math.round(reveal.rowMix[i] * 100)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <p className="mb-4 text-sm leading-relaxed text-forest-300">
              {level.teaching}
            </p>

            {learned && (
              <p className="mb-4 rounded-lg border border-forest-800 bg-forest-950/40 p-3 text-sm leading-relaxed text-forest-300">
                <span className="font-mono text-xs uppercase tracking-widest text-forest-400">
                  What their scouts wrote down ·{" "}
                </span>
                You call {learned.label} {Math.round(learned.share * 100)}% of the time
                {(() => {
                  const i = level.plays.findIndex((p) => p.id === learned.playId);
                  const mix = reveal.rowMix[i] ?? 0;
                  return learned.share > mix + 0.1
                    ? ` — the unbeatable mix calls it ${Math.round(mix * 100)}%. They'll be waiting for it next time.`
                    : ". That's close to the unbeatable mix, so there's not much for them to sit on.";
                })()}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={retry}
                className="rounded-lg border border-forest-600 bg-forest-800 px-4 py-2 text-sm font-medium hover:border-forest-400"
              >
                Run it back
              </button>
              {index < LEVELS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-forest-950"
                  style={{ backgroundColor: GOLD }}
                >
                  Next level →
                </button>
              ) : (
                <span className="self-center text-sm text-forest-400">
                  That&apos;s the campaign — you&apos;ve got the whole playbook.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Frame */}
        <footer className="mt-10 border-t border-forest-800 pt-6">
          <p className="text-sm text-forest-400">
            An exact minimax solver sets par and reveals the optimal mix — the same
            game theory behind &ldquo;pick your poison&rdquo; defenses. Built as part
            of a &ldquo;math through basketball&rdquo; series.
          </p>
        </footer>
      </div>
    </main>
  );
}
