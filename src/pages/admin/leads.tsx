import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

const TOKEN_KEY = "br_admin_token";

const STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "closed",
] as const;
type Status = (typeof STATUSES)[number];

type Lead = {
  id: number | string;
  name: string;
  email: string;
  company: string | null;
  project_type: string | null;
  budget_range: string | null;
  timeline: string | null;
  message: string | null;
  source: string | null;
  status: Status;
  created_at: string;
};

type LeadSource = { source: string; count: number; percent: number };
type Summary = {
  total: number;
  withBudget: number;
  withoutBudget: number;
  last7: number;
  prior7: number;
  topSources: LeadSource[];
};

const STATUS_STYLES: Record<Status, string> = {
  new: "bg-candy-500/20 text-candy-200 border-candy-500/40",
  contacted: "bg-void-500/20 text-void-200 border-void-500/40",
  qualified: "bg-forest-400/20 text-forest-100 border-forest-400/40",
  converted: "bg-forest-300/25 text-forest-50 border-forest-300/50",
  closed: "bg-white/10 text-white/50 border-white/20",
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

export default function AdminLeadsPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Restore token from localStorage on mount (persists across tabs/restarts).
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthed(true);
    }
  }, []);

  const loadLeads = useCallback(async (tk: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/leads", {
        headers: { "x-admin-token": tk },
      });
      if (res.status === 401) {
        setError("Invalid token.");
        sessionStorage.removeItem(TOKEN_KEY);
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
      setLeads(data.leads || []);
      setSummary(data.summary || null);
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed && token) loadLeads(token);
  }, [authed, token, loadLeads]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const tk = tokenInput.trim();
    if (!tk) return;
    sessionStorage.setItem(TOKEN_KEY, tk);
    setToken(tk);
    setAuthed(true);
    setTokenInput("");
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAuthed(false);
    setLeads([]);
    setSummary(null);
  };

  const updateStatus = async (id: Lead["id"], status: Status) => {
    // Optimistic update; revert on failure.
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setLeads(prev);
      setError("Failed to update status.");
    }
  };

  if (!authed) {
    return (
      <>
        <Head>
          <title>Admin — Leads</title>
          <meta name="robots" content="noindex" />
        </Head>
        <main className="min-h-screen bg-forest-950 text-white flex items-center justify-center px-4">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-sm bg-forest-900/60 border border-forest-700 rounded-2xl p-8 shadow-xl"
          >
            <h1 className="text-2xl font-bold mb-2">Lead Admin</h1>
            <p className="text-forest-200 text-sm mb-6">
              Enter your admin token to view consulting leads.
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Admin token"
              autoFocus
              className="w-full rounded-lg bg-forest-950 border border-forest-700 px-4 py-2.5 text-white placeholder-forest-400 focus:outline-none focus:ring-2 focus:ring-candy-500"
            />
            {error && (
              <p className="text-candy-300 text-sm mt-3">{error}</p>
            )}
            <button
              type="submit"
              className="mt-4 w-full rounded-lg bg-candy-500 hover:bg-candy-400 transition-colors px-4 py-2.5 font-semibold text-white"
            >
              View Leads
            </button>
          </form>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Admin — Leads</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="min-h-screen bg-forest-950 text-white px-4 sm:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Consulting Leads</h1>
              <p className="text-forest-200 text-sm mt-1">
                {leads.length} {leads.length === 1 ? "lead" : "leads"} total
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadLeads(token)}
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
            <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-4">
                <div className="text-forest-300 text-xs uppercase tracking-wide">
                  Total leads
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
                  Budget provided
                </div>
                <div className="text-3xl font-bold mt-1">
                  {summary.withBudget}
                  <span className="text-forest-400 text-base font-medium">
                    {" "}
                    / {summary.total}
                  </span>
                </div>
                <div className="text-forest-400 text-xs mt-1">
                  {summary.withoutBudget} missing budget
                </div>
              </div>

              <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-4">
                <div className="text-forest-300 text-xs uppercase tracking-wide">
                  Top sources
                </div>
                {summary.topSources.length === 0 ? (
                  <div className="text-forest-400 text-sm mt-2">—</div>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {summary.topSources.map((s) => (
                      <li
                        key={s.source}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-forest-100 truncate">
                          {s.source}
                        </span>
                        <span className="text-forest-300 whitespace-nowrap">
                          {s.count}{" "}
                          <span className="text-forest-400">
                            ({s.percent}%)
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!loading && leads.length === 0 && !error && (
            <div className="rounded-2xl border border-forest-700 bg-forest-900/40 p-12 text-center text-forest-300">
              No leads yet. Submissions from{" "}
              <span className="text-white">/consulting</span> will appear here.
            </div>
          )}

          {leads.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-forest-700">
              <table className="w-full text-sm">
                <thead className="bg-forest-900 text-forest-200 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Budget</th>
                    <th className="px-4 py-3 font-medium">Timeline</th>
                    <th className="px-4 py-3 font-medium">Message</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-800">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="align-top hover:bg-forest-900/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-forest-300 whitespace-nowrap">
                        {fmtDate(lead.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {lead.name}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-candy-300 hover:text-candy-200 underline underline-offset-2"
                        >
                          {lead.email}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-forest-200">
                        {lead.company || "—"}
                      </td>
                      <td className="px-4 py-3 text-forest-200">
                        {lead.project_type || "—"}
                      </td>
                      <td className="px-4 py-3 text-forest-200 whitespace-nowrap">
                        {lead.budget_range || "—"}
                      </td>
                      <td className="px-4 py-3 text-forest-200">
                        {lead.timeline || "—"}
                      </td>
                      <td className="px-4 py-3 text-forest-100 max-w-xs">
                        <span className="block whitespace-pre-wrap break-words">
                          {lead.message || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            updateStatus(lead.id, e.target.value as Status)
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize cursor-pointer focus:outline-none focus:ring-2 focus:ring-candy-500 ${
                            STATUS_STYLES[lead.status]
                          }`}
                        >
                          {STATUSES.map((s) => (
                            <option
                              key={s}
                              value={s}
                              className="bg-forest-900 text-white"
                            >
                              {s}
                            </option>
                          ))}
                        </select>
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
