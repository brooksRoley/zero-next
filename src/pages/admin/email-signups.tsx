import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

const TOKEN_KEY = "br_admin_token";

type Signup = {
  id: number | string;
  email: string;
  source: string | null;
  created_at: string;
};

type SourceCount = { source: string; count: number };
type Summary = {
  total: number;
  last7: number;
  prior7: number;
  bySource: SourceCount[];
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminEmailSignupsPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [signups, setSignups] = useState<Signup[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Shares the same admin token as /admin/leads, so a session logged into
  // one admin page is already authed on the other.
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthed(true);
    }
  }, []);

  const loadSignups = useCallback(async (tk: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/email-signups", {
        headers: { "x-admin-key": tk },
      });
      if (res.status === 401) {
        setError("Invalid token.");
        localStorage.removeItem(TOKEN_KEY);
        setAuthed(false);
        setToken("");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Request failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setSignups(data.signups || []);
      setSummary(data.summary || null);
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed && token) loadSignups(token);
  }, [authed, token, loadSignups]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const tk = tokenInput.trim();
    if (!tk) return;
    localStorage.setItem(TOKEN_KEY, tk);
    setToken(tk);
    setAuthed(true);
    setTokenInput("");
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAuthed(false);
    setSignups([]);
    setSummary(null);
  };

  if (!authed) {
    return (
      <>
        <Head>
          <title>Admin — Email Signups</title>
          <meta name="robots" content="noindex" />
        </Head>
        <main className="min-h-screen bg-forest-950 text-white flex items-center justify-center px-4">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-sm bg-forest-900/60 border border-forest-700 rounded-2xl p-8 shadow-xl"
          >
            <h1 className="text-2xl font-bold mb-2">Email Signups</h1>
            <p className="text-forest-200 text-sm mb-6">
              Enter your admin token to view captured emails.
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Admin token"
              autoFocus
              className="w-full rounded-lg bg-forest-950 border border-forest-700 px-4 py-2.5 text-white placeholder-forest-400 focus:outline-none focus:ring-2 focus:ring-candy-500"
            />
            {error && <p className="text-candy-300 text-sm mt-3">{error}</p>}
            <button
              type="submit"
              className="mt-4 w-full rounded-lg bg-candy-500 hover:bg-candy-400 transition-colors px-4 py-2.5 font-semibold text-white"
            >
              View Signups
            </button>
          </form>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Admin — Email Signups</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="min-h-screen bg-forest-950 text-white px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Email Signups</h1>
              <p className="text-forest-200 text-sm mt-1">
                {signups.length} {signups.length === 1 ? "email" : "emails"}{" "}
                captured
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadSignups(token)}
                disabled={loading}
                className="rounded-lg border border-forest-600 px-4 py-2 text-sm hover:bg-forest-800 transition-colors disabled:opacity-50"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-forest-700 px-4 py-2 text-sm text-forest-300 hover:bg-forest-800 transition-colors"
              >
                Log out
              </button>
            </div>
          </header>

          {error && (
            <div className="mb-4 rounded-lg border border-candy-500/40 bg-candy-500/10 px-4 py-3 text-candy-200 text-sm">
              {error}
            </div>
          )}

          {summary && summary.total > 0 && (
            <div className="mb-6 grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-4">
                <div className="text-forest-300 text-xs uppercase tracking-wide">
                  Total signups
                </div>
                <div className="text-3xl font-bold mt-1">{summary.total}</div>
                <div className="text-forest-400 text-xs mt-1">all time</div>
              </div>

              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-4">
                <div className="text-forest-300 text-xs uppercase tracking-wide">
                  Last 7 days
                </div>
                <div className="text-3xl font-bold mt-1">{summary.last7}</div>
                <div
                  className={`text-xs mt-1 ${
                    summary.last7 >= summary.prior7
                      ? "text-forest-200"
                      : "text-candy-300"
                  }`}
                >
                  {summary.prior7 === 0 && summary.last7 === 0
                    ? "no recent activity"
                    : `${summary.last7 >= summary.prior7 ? "▲" : "▼"} vs ${
                        summary.prior7
                      } prior 7d`}
                </div>
              </div>

              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-4">
                <div className="text-forest-300 text-xs uppercase tracking-wide">
                  By source
                </div>
                {summary.bySource.length === 0 ? (
                  <div className="text-forest-400 text-sm mt-2">—</div>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {summary.bySource.map((s) => (
                      <li
                        key={s.source}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-forest-100 truncate">
                          {s.source}
                        </span>
                        <span className="text-forest-300 whitespace-nowrap">
                          {s.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!loading && signups.length === 0 && !error && (
            <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-12 text-center text-forest-300">
              No signups yet. Captures from the Model Arena email gate,
              digital-product notify list, and funding tip jar will appear
              here.
            </div>
          )}

          {signups.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-forest-700">
              <table className="w-full text-sm">
                <thead className="bg-forest-900 text-forest-200 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-800">
                  {signups.map((s) => (
                    <tr
                      key={s.id}
                      className="align-top hover:bg-forest-900/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-forest-300 whitespace-nowrap">
                        {fmtDate(s.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`mailto:${s.email}`}
                          className="text-candy-300 hover:text-candy-200 underline underline-offset-2"
                        >
                          {s.email}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-forest-200">
                        {s.source || "—"}
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
