import type { ReactNode } from "react";
import type { ScorecardRow, SessionRow, VisitorStats } from "src/lib/visitorStats";

// "Who stops by" — the visitor-level half of /admin/analytics. Pure display:
// every number comes from src/lib/visitorStats.ts.

const CARD = "rounded-2xl border border-forest-700 bg-forest-900/40";
const TH = "px-4 py-2 text-left text-xs uppercase tracking-wider text-forest-400 font-medium";
const TD = "px-4 py-3 align-top";

function Tile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="text-xs uppercase tracking-wider text-forest-400">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {note && <div className="mt-1 text-xs text-forest-400">{note}</div>}
    </div>
  );
}

function Section({ title, blurb, children }: { title: string; blurb?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      {blurb && <p className="text-forest-400 text-sm mb-3">{blurb}</p>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className={`${CARD} px-5 py-4 text-sm text-forest-400`}>{children}</div>;
}

function ScoreTile({ row }: { row: ScorecardRow }) {
  const delta = row.thisWeek - row.lastWeek;
  const direction = delta > 0 ? "▲" : delta < 0 ? "▼" : "–";
  return (
    <Tile
      label={row.label}
      value={row.thisWeek.toLocaleString()}
      note={
        <>
          <span aria-hidden="true">{direction}</span>{" "}
          {delta === 0 ? "same as" : `${Math.abs(delta).toLocaleString()} ${delta > 0 ? "more than" : "fewer than"}`}{" "}
          last week ({row.lastWeek.toLocaleString()})
        </>
      }
    />
  );
}

const shortDay = (day: string) => {
  const [, month, date] = day.split("-");
  return `${Number(month)}/${Number(date)}`;
};

function DailyBars({ daily }: { daily: VisitorStats["daily"] }) {
  const max = daily.reduce((m, d) => Math.max(m, d.visitors), 0);
  if (daily.length === 0) return null;
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-baseline justify-between text-xs text-forest-400 mb-3">
        <span>Visitors per day (Pacific time)</span>
        <span>Busiest day: {max.toLocaleString()}</span>
      </div>
      <div
        className="flex items-end gap-[2px] h-28"
        role="img"
        aria-label={`Visitors per day for the last ${daily.length} days; busiest day had ${max}.`}
      >
        {daily.map((d) => (
          <div
            key={d.day}
            className="group relative flex-1 h-full flex items-end"
            title={`${d.day}: ${d.visitors} visitors, ${d.sessions} sessions, ${d.views} page views`}
          >
            <div
              className="w-full rounded-t bg-candy-500/70 group-hover:bg-candy-400 transition-colors"
              style={{ height: d.visitors > 0 && max > 0 ? `${Math.max((d.visitors / max) * 100, 4)}%` : "1px" }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-forest-500 mt-2 font-mono">
        <span>{shortDay(daily[0].day)}</span>
        <span>{shortDay(daily[daily.length - 1].day)}</span>
      </div>
    </div>
  );
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function duration(session: SessionRow): string {
  const ms = new Date(session.last_at).getTime() - new Date(session.started_at).getTime();
  if (!Number.isFinite(ms) || ms < 1000) return "—";
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function source(session: SessionRow): string {
  if (session.utm_source) return `${session.utm_source} (campaign tag)`;
  if (session.referrer) {
    try {
      return new URL(session.referrer).host.replace(/^www\./, "");
    } catch {
      return session.referrer;
    }
  }
  return "direct / unknown";
}

const place = (s: { city: string | null; region: string | null; country: string | null }) =>
  [s.city, s.region, s.country].filter(Boolean).join(", ") || "—";

function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  if (sessions.length === 0) {
    return <Empty>No visits recorded in this window yet.</Empty>;
  }
  return (
    <div className={`${CARD} overflow-x-auto`}>
      <table className="w-full text-sm min-w-[860px]">
        <thead>
          <tr className="border-b border-forest-800">
            <th className={TH}>When</th>
            <th className={TH}>Who</th>
            <th className={TH}>Came from</th>
            <th className={TH}>Where / on what</th>
            <th className={TH}>Pages, in order</th>
            <th className={TH}>Did</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.session_id} className="border-b border-forest-800/50 last:border-0">
              <td className={`${TD} whitespace-nowrap text-forest-200`}>
                {when(s.started_at)}
                <div className="text-xs text-forest-500">{duration(s)}</div>
              </td>
              <td className={TD}>
                {s.email ? (
                  <span className="text-candy-300">{s.email}</span>
                ) : (
                  <span className="font-mono text-xs text-forest-300">{(s.anon_id ?? s.session_id).slice(0, 8)}</span>
                )}
                <div className="text-xs text-forest-500">
                  {s.visit_count > 1 ? `returning · visit ${s.visit_count}` : "first visit"}
                </div>
              </td>
              <td className={`${TD} text-forest-200`}>{source(s)}</td>
              <td className={`${TD} text-forest-200`}>
                {place(s)}
                <div className="text-xs text-forest-500">
                  {[s.device, s.browser, s.os].filter(Boolean).join(" · ") || "—"}
                </div>
              </td>
              <td className={`${TD} font-mono text-xs text-forest-300`}>
                {(s.pages ?? []).join(" → ") || "—"}
                {s.page_views > (s.pages?.length ?? 0) && <span className="text-forest-500"> …</span>}
              </td>
              <td className={`${TD} font-mono text-xs text-forest-300`}>{(s.actions ?? []).join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: Array<Array<ReactNode>>;
  empty: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className={`${CARD} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-forest-800">
            {head.map((h, i) => (
              <th key={h} className={`${TH} ${i === 0 ? "" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className="border-b border-forest-800/50 last:border-0">
              {cells.map((cell, i) => (
                <td key={i} className={`px-4 py-2.5 ${i === 0 ? "text-forest-100" : "text-right text-forest-300"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VisitorSections({ stats }: { stats: VisitorStats | null | undefined }) {
  if (!stats) {
    return (
      <section className="mb-8">
        <Empty>Visitor data could not be read. The rest of the dashboard is unaffected.</Empty>
      </section>
    );
  }

  const { summary, hiring, windowDays } = stats;
  const returning = Math.max(summary.visitors - summary.new_visitors, 0);
  const resumeRate =
    hiring.home_visitors > 0 ? `${Math.round((hiring.resume_visitors / hiring.home_visitors) * 100)}%` : "—";

  return (
    <>
      <Section title="This week vs last week" blurb="The last 7 days against the 7 before them.">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.scorecard.map((row) => (
            <ScoreTile key={row.label} row={row} />
          ))}
        </div>
      </Section>

      <Section
        title={`Visitors (${windowDays}d)`}
        blurb="A visitor is one browser. Bots are left out. A visitor is new if this window holds their first visit."
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Tile label="Visitors" value={summary.visitors.toLocaleString()} />
          <Tile label="New" value={summary.new_visitors.toLocaleString()} />
          <Tile label="Returning" value={returning.toLocaleString()} />
          <Tile label="Sessions" value={summary.sessions.toLocaleString()} />
        </div>
        <DailyBars daily={stats.daily} />
      </Section>

      <Section
        title={`Hiring signal (${windowDays}d)`}
        blurb="Every application links this site. These count the people who reached the resume."
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile label="Resume visitors" value={hiring.resume_visitors.toLocaleString()} />
          <Tile label="Resume views" value={hiring.resume_views.toLocaleString()} />
          <Tile label="PDF downloads" value={hiring.pdf_downloads.toLocaleString()} />
          <Tile label="Resume ÷ home visitors" value={resumeRate} />
        </div>
      </Section>

      <Section
        title="Recent visits"
        blurb={
          <>
            The latest 50 visits, newest first. An email appears only when that same browser gave one. Where a visitor
            came from, their location and their device are recorded from 2026-10-07; earlier visits show a dash.
          </>
        }
      >
        <SessionsTable sessions={stats.recentSessions} />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        <Section title={`Came from (${windowDays}d)`} blurb="The site a visit arrived from, and any campaign tag on the link.">
          <div className="space-y-4">
            <SimpleTable
              head={["Site", "Sessions", "Visitors"]}
              rows={stats.referrers.map((r) => [r.host, r.sessions, r.visitors])}
              empty="No visits from other sites recorded yet."
            />
            <SimpleTable
              head={["Campaign tag", "Campaign", "Sessions"]}
              rows={stats.campaigns.map((c) => [c.source, c.campaign ?? "—", c.sessions])}
              empty="No tagged links used yet. Add ?utm_source=… to a link you share to see it here."
            />
          </div>
        </Section>

        <Section title={`Where (${windowDays}d)`} blurb="City-level location from the network address. The address itself is never stored.">
          <SimpleTable
            head={["Location", "Visitors"]}
            rows={stats.geo.map((g) => [place(g), g.visitors])}
            empty="No locations recorded yet."
          />
        </Section>
      </div>

      <Section title={`Devices (${windowDays}d)`} blurb="Bots are shown here so their share of traffic is visible.">
        <SimpleTable
          head={["Device", "Browser", "System", "Sessions"]}
          rows={stats.devices.map((d) => [d.device, d.browser, d.os, d.sessions])}
          empty="No device data recorded yet."
        />
      </Section>

      <Section title={`Games played (${windowDays}d)`} blurb="A game starts on its first move, not on page load.">
        <SimpleTable
          head={["Game", "Sessions", "Started", "Finished", "Puzzles solved", "Missed", "Lessons"]}
          rows={stats.games.map((g) => [
            g.game,
            g.sessions,
            g.starts,
            g.ends,
            g.puzzles_solved,
            g.puzzles_failed,
            g.stages_completed,
          ])}
          empty="No games recorded yet."
        />
      </Section>
    </>
  );
}
