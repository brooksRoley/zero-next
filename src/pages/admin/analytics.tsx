import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";

type PageViewRow = {
  path: string;
  views: number;
  sessions: number;
};

type EventRow = {
  event_type: string;
  count: number;
  sessions: number;
};

type EventByPageRow = {
  event_type: string;
  page: string;
  count: number;
};

type FunnelStep = {
  step: string;
  label: string;
  sessions: number;
};

type SupabaseStats = {
  puzzleBank: { count: number; avgRating: number | null };
  puzzleAttempts: { total: number; solved: number };
  gameResults: { total: number; byOpponentType: { bot: number; human: number } };
  players: { count: number; avgGameElo: number | null };
  go: {
    players: { count: number; avgElo: number | null };
    puzzleAttempts: { total: number; solved: number };
  };
};

type AnalyticsResponse = {
  pageViews: PageViewRow[];
  leads: { total: number; last_30_days: number };
  events?: EventRow[];
  eventsByPage?: EventByPageRow[];
  funnel?: FunnelStep[];
  supabaseStats?: SupabaseStats | null;
  priorityEvents?: string[];
  _meta?: { windowDays?: number };
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.status === 401) {
        setError("Session expired — log in again at /login.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Request failed (${res.status})`);
        return;
      }
      setData(await res.json());
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const windowDays = data?._meta?.windowDays ?? 30;
  const totalViews = data?.pageViews.reduce((sum, r) => sum + r.views, 0) ?? 0;
  const maxViews = data?.pageViews[0]?.views ?? 0;

  const events = data?.events ?? [];
  const eventsByPage = data?.eventsByPage ?? [];
  const funnel = data?.funnel ?? [];
  const funnelMax = funnel.reduce((m, s) => Math.max(m, s.sessions), 0);
  const prioritySet = new Set(data?.priorityEvents ?? []);
  const totalEvents = events.reduce((sum, r) => sum + r.count, 0);
  const maxEventCount = events.reduce((m, r) => Math.max(m, r.count), 0);
  const games = data?.supabaseStats ?? null;
  const fmtAvg = (n: number | null) => (n == null ? "—" : n.toLocaleString());

  return (
    <>
      <Head>
        <title>Admin — Analytics</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="min-h-screen bg-forest-950 text-white px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Site Analytics</h1>
              <p className="text-forest-200 text-sm mt-1">
                Page views and conversion events over the last {windowDays} days
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/leads"
                className="rounded-lg border border-forest-700 px-4 py-2 text-sm text-forest-300 hover:bg-forest-800 transition-colors"
              >
                Leads
              </Link>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-lg border border-forest-600 px-4 py-2 text-sm hover:bg-forest-800 transition-colors disabled:opacity-50"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </header>

          {error && (
            <div className="mb-4 rounded-lg border border-candy-500/40 bg-candy-500/10 px-4 py-3 text-candy-200 text-sm">
              {error}
            </div>
          )}

          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                <div className="text-xs uppercase tracking-wider text-forest-400">
                  Page views ({windowDays}d)
                </div>
                <div className="mt-2 text-3xl font-bold">{totalViews}</div>
              </div>
              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                <div className="text-xs uppercase tracking-wider text-forest-400">
                  Interactions ({windowDays}d)
                </div>
                <div className="mt-2 text-3xl font-bold">{totalEvents}</div>
              </div>
              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                <div className="text-xs uppercase tracking-wider text-forest-400">
                  Leads ({windowDays}d)
                </div>
                <div className="mt-2 text-3xl font-bold text-candy-300">
                  {data.leads.last_30_days}
                </div>
              </div>
              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                <div className="text-xs uppercase tracking-wider text-forest-400">
                  Leads (all time)
                </div>
                <div className="mt-2 text-3xl font-bold">{data.leads.total}</div>
              </div>
            </div>
          )}

          {data && funnel.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-1">
                Consulting funnel ({windowDays}d)
              </h2>
              <p className="text-forest-400 text-sm mb-3">
                Distinct sessions at each step: page view &rarr; section view
                &rarr; form submit &rarr; lead captured.
              </p>
              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5 space-y-4">
                {funnel.map((step, i) => {
                  const prev = i > 0 ? funnel[i - 1].sessions : null;
                  const rate =
                    prev != null && prev > 0
                      ? Math.round((step.sessions / prev) * 100)
                      : null;
                  return (
                    <div key={step.step}>
                      <div className="flex items-baseline justify-between text-sm mb-1">
                        <span className="text-forest-100">
                          <span className="text-forest-500 font-mono mr-2">
                            {i + 1}.
                          </span>
                          {step.label}
                          <span className="ml-2 font-mono text-xs text-forest-500">
                            {step.step}
                          </span>
                        </span>
                        <span>
                          <span className="font-semibold">{step.sessions}</span>
                          {rate != null && (
                            <span className="ml-2 text-xs text-forest-400">
                              {rate}% of prev
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-forest-950 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-candy-500/70"
                          style={{
                            width: `${funnelMax > 0 ? (step.sessions / funnelMax) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {data && games && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-1">Games (Supabase)</h2>
              <p className="text-forest-400 text-sm mb-3">
                Live totals from the Pente/Go game database — puzzle bank,
                puzzle solve rate, recorded games, and player ratings.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                  <div className="text-xs uppercase tracking-wider text-forest-400">
                    Puzzle bank
                  </div>
                  <div className="mt-2 text-3xl font-bold">
                    {games.puzzleBank.count.toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-forest-400">
                    avg rating {fmtAvg(games.puzzleBank.avgRating)}
                  </div>
                </div>
                <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                  <div className="text-xs uppercase tracking-wider text-forest-400">
                    Puzzle attempts
                  </div>
                  <div className="mt-2 text-3xl font-bold">
                    {games.puzzleAttempts.total.toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-forest-400">
                    {games.puzzleAttempts.total > 0
                      ? `${Math.round((games.puzzleAttempts.solved / games.puzzleAttempts.total) * 100)}% solved`
                      : "no attempts yet"}
                  </div>
                </div>
                <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                  <div className="text-xs uppercase tracking-wider text-forest-400">
                    Games recorded
                  </div>
                  <div className="mt-2 text-3xl font-bold">
                    {games.gameResults.total.toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-forest-400">
                    {games.gameResults.byOpponentType.bot.toLocaleString()} vs bot
                    {" · "}
                    {games.gameResults.byOpponentType.human.toLocaleString()} vs
                    human
                  </div>
                </div>
                <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                  <div className="text-xs uppercase tracking-wider text-forest-400">
                    Players
                  </div>
                  <div className="mt-2 text-3xl font-bold">
                    {games.players.count.toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-forest-400">
                    avg game ELO {fmtAvg(games.players.avgGameElo)}
                  </div>
                </div>
              </div>
            </section>
          )}

          {data && games?.go && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-1">Go (Supabase)</h2>
              <p className="text-forest-400 text-sm mb-3">
                Go lives in its own tables (go_players / go_puzzle_attempts),
                isolated from Pente&apos;s ELO — tracked separately here so Go
                engagement isn&apos;t dark.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                  <div className="text-xs uppercase tracking-wider text-forest-400">
                    Go players
                  </div>
                  <div className="mt-2 text-3xl font-bold">
                    {games.go.players.count.toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-forest-400">
                    avg ELO {fmtAvg(games.go.players.avgElo)}
                  </div>
                </div>
                <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                  <div className="text-xs uppercase tracking-wider text-forest-400">
                    Go puzzle attempts
                  </div>
                  <div className="mt-2 text-3xl font-bold">
                    {games.go.puzzleAttempts.total.toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-forest-400">
                    {games.go.puzzleAttempts.total > 0
                      ? `${Math.round((games.go.puzzleAttempts.solved / games.go.puzzleAttempts.total) * 100)}% solved`
                      : "no attempts yet"}
                  </div>
                </div>
              </div>
            </section>
          )}

          {!loading && data && data.pageViews.length === 0 && !error && (
            <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-12 text-center text-forest-300">
              No page views recorded yet. Tracking starts once the site is
              deployed with the new <span className="text-white">page_view</span>{" "}
              events.
            </div>
          )}

          {data && data.pageViews.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-forest-700">
              <table className="w-full text-sm">
                <thead className="bg-forest-900 text-forest-200 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Route</th>
                    <th className="px-4 py-3 font-medium text-right">Views</th>
                    <th className="px-4 py-3 font-medium text-right">Sessions</th>
                    <th className="px-4 py-3 font-medium w-1/3">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-800">
                  {data.pageViews.map((row) => (
                    <tr
                      key={row.path}
                      className="hover:bg-forest-900/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-forest-100">
                        {row.path}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {row.views}
                      </td>
                      <td className="px-4 py-3 text-right text-forest-300">
                        {row.sessions}
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-2 rounded-full bg-forest-900 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-candy-500/70"
                            style={{
                              width: `${maxViews > 0 ? (row.views / maxViews) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold mb-1">
                Events ({windowDays}d)
              </h2>
              <p className="text-forest-400 text-sm mb-3">
                Every tracked interaction except page views.{" "}
                <span className="text-candy-300">Highlighted</span> rows are the
                conversion signals that drive monetization decisions.
              </p>

              {events.length === 0 ? (
                <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-8 text-center text-forest-300">
                  No interaction events recorded in the last {windowDays} days
                  yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-forest-700">
                  <table className="w-full text-sm">
                    <thead className="bg-forest-900 text-forest-200 text-left">
                      <tr>
                        <th className="px-4 py-3 font-medium">Event</th>
                        <th className="px-4 py-3 font-medium text-right">Count</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Sessions
                        </th>
                        <th className="px-4 py-3 font-medium w-1/3">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-forest-800">
                      {events.map((row) => {
                        const isPriority = prioritySet.has(row.event_type);
                        return (
                          <tr
                            key={row.event_type}
                            className={`transition-colors ${
                              isPriority
                                ? "bg-candy-500/5 hover:bg-candy-500/10"
                                : "hover:bg-forest-900/40"
                            }`}
                          >
                            <td className="px-4 py-3 font-mono">
                              <span
                                className={
                                  isPriority ? "text-candy-200" : "text-forest-100"
                                }
                              >
                                {row.event_type}
                              </span>
                              {isPriority && (
                                <span className="ml-2 rounded-full border border-candy-500/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-candy-300">
                                  key
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {row.count}
                            </td>
                            <td className="px-4 py-3 text-right text-forest-300">
                              {row.sessions}
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-2 rounded-full bg-forest-900 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isPriority
                                      ? "bg-candy-400/80"
                                      : "bg-forest-500/70"
                                  }`}
                                  style={{
                                    width: `${
                                      maxEventCount > 0
                                        ? (row.count / maxEventCount) * 100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {eventsByPage.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-forest-800">
                  <table className="w-full text-sm">
                    <thead className="bg-forest-900/70 text-forest-300 text-left">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Event</th>
                        <th className="px-4 py-2.5 font-medium">Page</th>
                        <th className="px-4 py-2.5 font-medium text-right">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-forest-800/60">
                      {eventsByPage.map((row) => (
                        <tr
                          key={`${row.event_type}|${row.page}`}
                          className="hover:bg-forest-900/30 transition-colors"
                        >
                          <td className="px-4 py-2 font-mono text-forest-200">
                            {row.event_type}
                          </td>
                          <td className="px-4 py-2 font-mono text-forest-400">
                            {row.page}
                          </td>
                          <td className="px-4 py-2 text-right text-forest-300">
                            {row.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
