import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { track } from "src/lib/analytics";
import type { RigReportResponse, CaseFileEntry } from "src/pages/api/tools/rig-report";

/**
 * The Rig Report — the Entertainment Integrity Bureau's public reading room.
 *
 * Satire machine: every game gets a Rigged-o-Meter and a stack of "exhibits."
 * Each exhibit opens on the conspiracy claim and flips to the sober
 * statistical explanation — the flip IS the lesson. No bets are placed or
 * recommended anywhere on this page.
 */

const VERDICTS: Array<{ min: number; label: string }> = [
  { min: 80, label: "WAKE THE COMMISSIONER" },
  { min: 60, label: "RED STRING DEPLOYED" },
  { min: 40, label: "RAISED EYEBROW" },
  { min: 20, label: "MILDLY SUSPICIOUS" },
  { min: 0, label: "SUSPICIOUSLY NORMAL" },
];

function verdict(score: number): string {
  return VERDICTS.find((v) => score >= v.min)?.label ?? "SUSPICIOUSLY NORMAL";
}

function meterColor(score: number): string {
  if (score >= 60) return "#f24da0"; // candy-500
  if (score >= 40) return "#ff8cc2"; // candy-300
  if (score >= 20) return "#B27236"; // ochre
  return "#6abf82"; // forest-300
}

function fmtTipoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

function RiggedOMeter({ score }: { score: number }) {
  const color = meterColor(score);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#DADBD9]/50">
          Rigged-o-Meter
        </span>
        <span className="font-mono text-xs font-bold" style={{ color }}>
          {score}/100 · {verdict(score)}
        </span>
      </div>
      <div
        className="h-3 w-full rounded-full bg-forest-900 border border-forest-700/60 overflow-hidden"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label={`Suspicion score ${score} out of 100: ${verdict(score)}`}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(score, 3)}%`,
            background: `linear-gradient(90deg, #2d6a4f, ${color})`,
          }}
        />
      </div>
    </div>
  );
}

function ExhibitCard({
  exhibit,
  eventId,
}: {
  exhibit: CaseFileEntry["report"]["exhibits"][number];
  eventId: string;
}) {
  const [revealed, setRevealed] = useState(false);

  const flip = () => {
    const next = !revealed;
    setRevealed(next);
    if (next) {
      track("rig_exhibit_flip", {
        metadata: { exhibit: exhibit.id, event_id: eventId },
      });
    }
  };

  return (
    <div
      className={`rounded-lg border p-4 transition-colors duration-300 ${
        revealed
          ? "border-forest-400/50 bg-forest-800/40"
          : "border-candy-500/40 bg-candy-950/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
              revealed ? "text-forest-300" : "text-candy-300"
            }`}
          >
            {exhibit.title}
          </div>
          <div className="mt-1 text-sm font-semibold text-[#DADBD9]">
            {exhibit.stat}
          </div>
        </div>
        <span
          aria-hidden
          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider border ${
            revealed
              ? "border-forest-400/60 text-forest-200"
              : "border-candy-400/60 text-candy-200 rotate-2"
          }`}
        >
          {revealed ? "Declassified" : "Confidential"}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[#DADBD9]/85">
        {revealed ? exhibit.sober : exhibit.conspiracy}
      </p>

      {revealed && (
        <p className="mt-3 rounded border border-forest-500/30 bg-forest-950/60 px-3 py-2 text-xs leading-relaxed text-forest-100/90">
          <span className="font-mono uppercase tracking-wider text-forest-300">
            The actual lesson:{" "}
          </span>
          {exhibit.lesson}
        </p>
      )}

      <button
        type="button"
        onClick={flip}
        aria-pressed={revealed}
        className={`mt-3 w-full rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
          revealed
            ? "border-candy-500/50 text-candy-300 hover:bg-candy-950/40"
            : "border-forest-400/50 text-forest-200 hover:bg-forest-800/60"
        }`}
      >
        {revealed ? "Restore the conspiracy" : "Okay, but what actually happened?"}
      </button>
    </div>
  );
}

function CaseFileCard({ entry, index }: { entry: CaseFileEntry; index: number }) {
  const { game, report } = entry;
  const caseNo = `EIB-${String(index + 1).padStart(3, "0")}`;
  const tilt = index % 2 === 0 ? "sm:-rotate-[0.4deg]" : "sm:rotate-[0.4deg]";

  return (
    <article
      className={`relative rounded-xl border border-[#C5E7EA]/15 bg-[#0d1b14]/80 p-5 shadow-lg shadow-black/30 backdrop-blur-sm ${tilt}`}
    >
      {/* red-string corner pin, CSS only */}
      <span
        aria-hidden
        className="absolute -top-1.5 left-6 h-3 w-3 rounded-full bg-candy-500 shadow shadow-candy-500/50"
      />
      <span
        aria-hidden
        className="absolute top-0 left-7 h-10 w-px origin-top rotate-[24deg] bg-gradient-to-b from-candy-500/70 to-transparent"
      />

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#B9968D]">
            Case {caseNo}
            {game.gameLabel ? ` · ${game.gameLabel}` : ""}
          </div>
          <h3 className="mt-1 text-lg font-bold text-[#DADBD9]">
            {game.awayTeam} <span className="text-[#DADBD9]/40">@</span>{" "}
            {game.homeTeam}
          </h3>
        </div>
        <div className="text-right font-mono text-[11px] text-[#DADBD9]/55">
          <div>{fmtTipoff(game.commenceTime)}</div>
          <div className="mt-0.5">
            {game.closingSpread != null && (
              <span>
                line {game.closingSpread > 0 ? "+" : ""}
                {game.closingSpread}
              </span>
            )}
            {entry.holdPct != null && (
              <span className="text-candy-300"> · hold {entry.holdPct}%</span>
            )}
          </div>
        </div>
      </header>

      <div className="mt-4">
        <RiggedOMeter score={report.suspicionScore} />
      </div>

      {report.exhibits.length === 0 ? (
        <p className="mt-4 rounded-lg border border-forest-700/50 bg-forest-900/40 px-4 py-3 text-sm text-[#DADBD9]/70">
          The Bureau found nothing. Which is, of course, exactly what they would
          want a game to look like. (Statistically: a normal game.)
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {report.exhibits.map((ex) => (
            <ExhibitCard key={ex.id} exhibit={ex} eventId={game.eventId} />
          ))}
        </div>
      )}
    </article>
  );
}

function HouseAlwaysWins({ house }: { house: RigReportResponse["house"] }) {
  if (house.avgHoldPct == null) return null;
  return (
    <section className="rounded-xl border border-candy-500/30 bg-candy-950/20 p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-candy-300">
        Standing Exhibit: The House Always Wins
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <div className="text-3xl font-bold text-candy-300">
            {house.avgOverroundPct}%
          </div>
          <div className="mt-1 text-xs text-[#DADBD9]/60">
            average overround across {house.gamesWithMoneylines}{" "}
            {house.gamesWithMoneylines === 1 ? "game" : "games"} tonight — the
            implied probabilities sum past 100% by this much
          </div>
        </div>
        <div>
          <div className="text-3xl font-bold text-candy-300">{house.avgHoldPct}%</div>
          <div className="mt-1 text-xs text-[#DADBD9]/60">
            the hold: the cut of all money wagered the book keeps if action is
            balanced. No fixing required.
          </div>
        </div>
        <div>
          <div className="text-3xl font-bold text-candy-300">
            −${house.lossPer100}
          </div>
          <div className="mt-1 text-xs text-[#DADBD9]/60">
            expected result per $100 wagered blindly into these lines. At the
            standard −110, you must win 52.4% just to break even.
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[#DADBD9]/75">
        This is the only rigging the Bureau has ever proven, and it&apos;s printed
        on the price tag. A sportsbook doesn&apos;t need any game&apos;s outcome
        to go its way — it charges a fee on both sides of every market and lets
        variance do the rest. Every &ldquo;favorability rating&rdquo; you see
        quoted from betting odds contains this markup.
      </p>
    </section>
  );
}

function SourceShortcomings({ meta, source }: {
  meta: RigReportResponse["meta"];
  source: RigReportResponse["source"];
}) {
  return (
    <section className="rounded-xl border border-[#C5E7EA]/12 bg-[#0d1b14]/60 p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[#B9968D]">
        Our Sources&apos; Shortcomings (Full Disclosure)
      </h2>
      <p className="mt-3 text-sm text-[#DADBD9]/70">
        An integrity bureau that hides its own data problems is just another
        conspiracy. Ours, itemized:
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#DADBD9]/70">
        <li>
          <span className="text-[#DADBD9]/90 font-medium">The Odds API (free tier):</span>{" "}
          500 credits/month; our snapshot (3 markets × 1 region) costs 3 credits,
          so we cache each pull in our own database for 6 hours — you may be
          reading lines that moved hours ago. When quota hits zero, the feed
          simply stops until the 1st of the month.
          {!meta.oddsApiConfigured && (
            <span className="text-candy-300"> (No key configured — this source is currently offline.)</span>
          )}
        </li>
        <li>
          <span className="text-[#DADBD9]/90 font-medium">Our own Neon archive:</span>{" "}
          odds snapshots only exist for days the ingest cron actually ran, and
          only from the bookmakers it captured. Gaps look identical to quiet days
          — a survivorship problem we&apos;d gleefully flag in anyone else&apos;s data.
        </li>
        <li>
          <span className="text-[#DADBD9]/90 font-medium">balldontlie.io (free tier):</span>{" "}
          5 requests/minute and no betting odds at all — fine for rosters and
          scores, useless for market forensics.
        </li>
        <li>
          <span className="text-[#DADBD9]/90 font-medium">ESPN&apos;s unofficial scoreboard JSON:</span>{" "}
          undocumented, unversioned, and can change or vanish without notice.
          Odds fields appear for some games and not others.
        </li>
        <li>
          <span className="text-[#DADBD9]/90 font-medium">API-Basketball (free tier):</span>{" "}
          100 requests/day, resets at midnight UTC, unused quota evaporates.
        </li>
        <li>
          <span className="text-[#DADBD9]/90 font-medium">The model:</span>{" "}
          our Monte Carlo spread model carries a mean absolute error of roughly
          9–10 points per game. When it &ldquo;dissents&rdquo; from Vegas, the
          smart money is on the model being wrong.
        </li>
      </ul>
      <p className="mt-3 font-mono text-[11px] text-[#DADBD9]/45">
        Current feed: {source.toUpperCase()}
        {meta.cacheAgeMinutes != null && ` · snapshot age ${meta.cacheAgeMinutes} min`}
        {" · "}
        {meta.note}
      </p>
    </section>
  );
}

export default function RigReport() {
  const [data, setData] = useState<RigReportResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    fetch("/api/tools/rig-report", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || "The Bureau's records office is unresponsive.");
        }
        return r.json();
      })
      .then(setData)
      .catch((e: unknown) => {
        setError(
          controller.signal.aborted
            ? "The records office timed out. Try again in a minute."
            : e instanceof Error
              ? e.message
              : "Unknown error"
        );
      })
      .finally(() => {
        clearTimeout(timer);
        setLoading(false);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return (
    <main className="min-h-screen bg-forest-950 font-sans text-[#DADBD9]">
      <Head>
        <title>The Rig Report | Entertainment Integrity Bureau</title>
        <meta
          name="description"
          content="A satirical NBA 'rigging' inspector that teaches real sports analytics: implied probability, the vig, line movement, and why upsets are supposed to happen."
        />
      </Head>

      <header className="border-b border-[#C5E7EA]/10 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/nba"
            className="text-sm text-[#DADBD9]/55 transition-colors hover:text-[#DADBD9]"
          >
            &larr; NBA Explorer
          </Link>
          <Link
            href="/"
            className="text-sm text-[#DADBD9]/45 transition-colors hover:text-[#DADBD9]/80"
          >
            Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Masthead */}
        <div className="relative">
          <span className="inline-block rounded-full bg-candy-600/20 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-candy-300">
            Entertainment Integrity Bureau
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            The Rig Report
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-[#DADBD9]/70">
            The Bureau operates on one founding assumption: every NBA game is
            rigged for entertainment and betting profit. It then inspects the
            actual numbers. The numbers keep explaining themselves. This is
            embarrassing for the Bureau, and educational for you.
          </p>
        </div>

        {/* Satire / not-advice disclaimer — always visible */}
        <div className="mt-6 rounded-lg border border-[#B27236]/50 bg-[#B27236]/10 px-4 py-3 text-sm leading-relaxed text-[#DADBD9]/85">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#B27236]">
            Official notice ·{" "}
          </span>
          This page is <strong>satire</strong> and a statistics lesson. It is{" "}
          <strong>not gambling advice</strong>, places no bets, recommends no
          bets, and accuses no individual of anything. The only verified
          conspiracy on this page is arithmetic. If gambling is a problem for
          you or someone you know: call or text 1-800-GAMBLER.
        </div>

        {loading && (
          <p className="py-16 text-center text-sm text-[#DADBD9]/50">
            Pulling case files from the records office…
          </p>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-xl border border-candy-800/50 bg-candy-950/30 px-5 py-4 text-sm text-candy-200">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {data.source === "demo" && (
              <div className="mt-6 rounded-lg border border-[#C5E7EA]/25 bg-[#C5E7EA]/5 px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#C5E7EA]">
                Demo case file — invented (but realistic) numbers so the Bureau
                has something to be wrong about. Live lines appear when odds
                data is available.
              </div>
            )}

            <div className="mt-8 space-y-6">
              {data.cases.map((entry, i) => (
                <CaseFileCard key={entry.game.eventId} entry={entry} index={i} />
              ))}
            </div>

            <div className="mt-10 space-y-6">
              <HouseAlwaysWins house={data.house} />

              <section className="rounded-xl border border-forest-500/30 bg-forest-900/30 p-5">
                <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-forest-300">
                  Bureau Findings To Date
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#DADBD9]/80">
                  Despite continuous inspection, the Bureau has yet to catch the
                  league doing anything the math didn&apos;t predict. Upsets occur
                  at their base rates. Lines move when information arrives.
                  Bookmakers disagree because they are competitors, not a choir.
                  The one entity provably profiting from every single game is the
                  house, via the vig — and it does that in the open. If you want
                  to audit our own model&apos;s honesty instead, the scoreboard is
                  public:
                </p>
                <Link
                  href="/tools/nba-accuracy"
                  onClick={() => track("rig_cta_accuracy")}
                  className="mt-3 inline-block rounded-md border border-forest-400/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-forest-200 transition-colors hover:bg-forest-800/60"
                >
                  Model vs Vegas accuracy dashboard &rarr;
                </Link>
              </section>

              <section className="rounded-xl border border-forest-500/30 bg-forest-900/30 p-5">
                <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-forest-300">
                  Want the Bureau&apos;s methods?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#DADBD9]/80">
                  The same possession-based model that grades the league here is
                  written up, end to end, in the NBA Analytics Primer — how to
                  read box-score stats, build a spread model from free public
                  data, and judge it against the Vegas line. Worked examples in
                  Python and SQL you can run on a laptop.
                </p>
                <Link
                  href="/digital-products"
                  onClick={() => track("rig_cta_primer")}
                  className="mt-3 inline-block rounded-md border border-candy-400/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-candy-200 transition-colors hover:bg-forest-800/60"
                >
                  NBA Analytics Primer &rarr;
                </Link>
              </section>

              <SourceShortcomings meta={data.meta} source={data.source} />
            </div>
          </>
        )}

        <footer className="mt-12 border-t border-[#C5E7EA]/10 pt-6 text-xs text-[#DADBD9]/40">
          <p>
            The Entertainment Integrity Bureau is a bit. The math is not.
            Satire · no wagering functionality · no advice. Built by{" "}
            <Link href="/" className="underline hover:text-[#DADBD9]/70">
              Brooks Roley
            </Link>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
