import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PassCutBoard from "src/components/games/PassCutBoard";
import { LEVELS } from "src/lib/games/passcut/levels";
import {
  minimalCut,
  twoEdgeDisjointTerminalTrees,
  type Edge,
  type Level,
} from "src/lib/games/passcut/graph";
import { track } from "src/lib/analytics";
import { absoluteUrl } from 'src/lib/routes'

const PROGRESS_KEY = "passcut_progress"; // array of completed level ids (any result)
const SOLVED_KEY = "passcut_solved"; // array of level ids won as offense

function formatEdge(level: Level, e: Edge): string {
  const label = (id: string) => level.nodes.find((n) => n.id === id)?.label ?? id;
  return `${label(e.a)} ↔ ${label(e.b)}`;
}

export default function PassAndCutPage() {
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [solved, setSolved] = useState<string[]>([]);
  const [result, setResult] = useState<"offense" | "defense" | null>(null);
  const [boardKey, setBoardKey] = useState(0);

  const level = LEVELS[index];

  // Hydrate progress from localStorage (SSR-safe).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const c = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "[]");
      const s = JSON.parse(window.localStorage.getItem(SOLVED_KEY) ?? "[]");
      if (Array.isArray(c)) setCompleted(c.filter((x) => typeof x === "string"));
      if (Array.isArray(s)) setSolved(s.filter((x) => typeof x === "string"));
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persist = useCallback((key: string, value: string[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }, []);

  const handleResult = useCallback(
    (winner: "offense" | "defense") => {
      setResult(winner);
      setCompleted((prev) => {
        if (prev.includes(level.id)) return prev;
        const next = [...prev, level.id];
        persist(PROGRESS_KEY, next);
        return next;
      });
      if (winner === "offense") {
        setSolved((prev) => {
          if (prev.includes(level.id)) return prev;
          const next = [...prev, level.id];
          persist(SOLVED_KEY, next);
          return next;
        });
      }
      track("passcut_result", {
        page: "/games/pass-and-cut",
        metadata: { level: level.id, winner },
      });
    },
    [level.id, persist]
  );

  const goTo = useCallback((i: number) => {
    setIndex(i);
    setResult(null);
    setBoardKey((k) => k + 1);
  }, []);

  const retry = useCallback(() => {
    setResult(null);
    setBoardKey((k) => k + 1);
  }, []);

  const isUnlocked = useCallback(
    (i: number) => i === 0 || completed.includes(LEVELS[i - 1].id),
    [completed]
  );

  const hasNext = index < LEVELS.length - 1;

  // Teaching analysis for the overlay. Wrapped defensively: the graph module may
  // still be a stub during pre-integration, and we never want a throw to blank
  // the page — the teaching text always shows regardless.
  const analysis = useMemo(() => {
    if (!result) return { cut: null as Edge[] | null, trees: null as [Edge[], Edge[]] | null };
    let cut: Edge[] | null = null;
    let trees: [Edge[], Edge[]] | null = null;
    if (result === "defense") {
      try {
        cut = minimalCut(level.edges, level.terminals);
      } catch {
        cut = null;
      }
    } else {
      try {
        const t = twoEdgeDisjointTerminalTrees(level.edges, level.terminals);
        if (t.exists && t.trees) trees = t.trees;
      } catch {
        trees = null;
      }
    }
    return { cut, trees };
  }, [result, level]);

  return (
    <main className="min-h-screen bg-forest-950 text-white font-sans">
      <Head>
        <title>Pass &amp; Cut | Brooks Roley</title>
        <meta
          name="description"
          content="Pass & Cut — a basketball puzzle that IS the Shannon switching game. Secure pass lanes to connect the inbounder to the rim before the defense denies you. Learn graph connectivity and min-cut by playing."
        />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:title" content="Pass & Cut — Brooks Roley" key="og:title" />
        <meta
          property="og:description"
          content="A basketball puzzle that IS the Shannon switching game. Secure pass lanes from the inbounder to the rim and learn graph connectivity by playing."
          key="og:description"
        />
        <meta property="og:url" content={absoluteUrl('passAndCut')} key="og:url" />
      </Head>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
        {/* ── Framed header ── */}
        <header className="mb-8">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[#FDB927]/80">
            Basketball Graph Puzzle
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Pass &amp; <span className="text-[#FDB927]">Cut</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-forest-300 sm:text-base">
            Five players on a half court. The lines between them are pass lanes.
            Your job: connect the inbounder (PG) to the finisher at the rim (C) by{" "}
            <span className="text-[#FDB927]">securing</span> one lane per turn. The
            defense answers by <span className="text-red-400">denying</span> a lane
            you haven&apos;t locked. You score the moment your secured lanes link the
            two, and the defense wins if it walls off every route first. This is the{" "}
            <em>Shannon switching game</em> in a jersey — and the deep idea it teaches
            is <strong>min-cut</strong>: a play is safe only when there are two
            independent ways to the rim, so no single denial can stop the ball. Find
            the bottleneck, or make sure you don&apos;t have one.
          </p>
        </header>

        {/* ── Level selector ── */}
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Levels">
          {LEVELS.map((l, i) => {
            const unlocked = isUnlocked(i);
            const isSolved = solved.includes(l.id);
            const isCurrent = i === index;
            return (
              <button
                key={l.id}
                type="button"
                disabled={!unlocked}
                onClick={() => goTo(i)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isCurrent
                    ? "border-[#FDB927] bg-[#FDB927]/15 text-[#FDB927]"
                    : unlocked
                    ? "border-forest-700 bg-forest-900 text-forest-200 hover:border-forest-500"
                    : "cursor-not-allowed border-forest-800 bg-forest-900/40 text-forest-600"
                }`}
                title={unlocked ? l.title : "Complete the previous level to unlock"}
              >
                {isSolved ? "★ " : unlocked ? "" : "\u{1F512} "}
                {i + 1}
              </button>
            );
          })}
        </nav>

        {/* ── Current level frame ── */}
        <section className="rounded-2xl border border-forest-800 bg-forest-900/40 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {index + 1}. {level.title}
              </h2>
              <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-forest-400">
                Concept: {level.concept}
              </p>
            </div>
            {solved.includes(level.id) && (
              <span className="rounded-full bg-[#FDB927]/15 px-2 py-0.5 text-xs font-semibold text-[#FDB927]">
                Solved
              </span>
            )}
          </div>

          {/* Board + result overlay */}
          <div className="relative">
            <PassCutBoard key={boardKey} level={level} onResult={handleResult} />

            {result && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-forest-950/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-2xl border border-forest-700 bg-forest-900 p-5 shadow-2xl shadow-black/50">
                  <p
                    className={`text-lg font-bold ${
                      result === "offense" ? "text-[#FDB927]" : "text-red-400"
                    }`}
                  >
                    {result === "offense" ? "Bucket! Offense connects." : "Denied. Defense walls it off."}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-forest-200">
                    {level.teaching}
                  </p>

                  {result === "defense" && analysis.cut && analysis.cut.length > 0 && (
                    <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
                        The defense cut here (min-cut)
                      </p>
                      <p className="mt-1 text-sm text-forest-100">
                        {analysis.cut.map((e) => formatEdge(level, e)).join(", ")}
                      </p>
                    </div>
                  )}

                  {result === "offense" && analysis.trees && (
                    <div className="mt-3 rounded-lg border border-[#FDB927]/30 bg-[#FDB927]/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#FDB927]">
                        Two independent ways to the rim
                      </p>
                      <p className="mt-1 text-sm text-forest-100">
                        <span className="text-forest-400">A:</span>{" "}
                        {analysis.trees[0].map((e) => formatEdge(level, e)).join(", ")}
                      </p>
                      <p className="mt-1 text-sm text-forest-100">
                        <span className="text-forest-400">B:</span>{" "}
                        {analysis.trees[1].map((e) => formatEdge(level, e)).join(", ")}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={retry}
                      className="flex-1 rounded-full border border-forest-600 bg-forest-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700"
                    >
                      Retry
                    </button>
                    {hasNext && (
                      <button
                        type="button"
                        onClick={() => goTo(index + 1)}
                        className="flex-1 rounded-full border border-[#552583] bg-[#552583] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6b2ea3]"
                      >
                        Next level →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Tip-jar frame ── */}
        <footer className="mt-6 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-forest-400">
            An exact game-tree solver plays the defense — it never misses, so every
            level is a fair test of the graph, not the bot.
          </p>
          <Link
            href="/funding"
            onClick={() =>
              track("cta_click", {
                page: "/games/pass-and-cut",
                metadata: { location: "passcut_tip" },
                beacon: true,
              })
            }
            className="text-candy-500 transition-colors hover:text-candy-400"
          >
            Enjoying the puzzle? Support development →
          </Link>
        </footer>
      </div>
    </main>
  );
}
