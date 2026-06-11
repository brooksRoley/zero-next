import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";

type PageViewRow = {
  path: string;
  views: number;
  sessions: number;
};

type AnalyticsResponse = {
  pageViews: PageViewRow[];
  leads: { total: number; last_30_days: number };
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
                Page views over the last {windowDays} days
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-5">
                <div className="text-xs uppercase tracking-wider text-forest-400">
                  Page views ({windowDays}d)
                </div>
                <div className="mt-2 text-3xl font-bold">{totalViews}</div>
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
        </div>
      </main>
    </>
  );
}
