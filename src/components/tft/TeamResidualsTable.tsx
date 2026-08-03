import { useState } from "react";

interface Row {
  team_id: number;
  sim_wins: number;
  actual_wins: number;
  eps_engine: number;
  eps_tactics: number;
}

const SORTABLE_COLUMNS: { key: keyof Row; label: string }[] = [
  { key: "sim_wins", label: "Sim W" },
  { key: "actual_wins", label: "Actual W" },
  { key: "eps_engine", label: "ε engine" },
  { key: "eps_tactics", label: "ε tactics" },
];

export default function TeamResidualsTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<keyof Row>("eps_engine");
  const sorted = [...rows].sort((a, b) => Math.abs(b[sortKey]) - Math.abs(a[sortKey]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left">
            <th className="py-2">Team</th>
            {SORTABLE_COLUMNS.map(({ key, label }) => (
              <th key={key} className="py-2" aria-sort={sortKey === key ? "descending" : "none"}>
                <button
                  type="button"
                  onClick={() => setSortKey(key)}
                  className="cursor-pointer underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-sm"
                >
                  {label}
                  {sortKey === key ? " ▼" : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.team_id} className="border-b border-white/5">
              <td className="py-1">{r.team_id}</td>
              <td>{r.sim_wins.toFixed(1)}</td>
              <td>{r.actual_wins.toFixed(1)}</td>
              <td className={r.eps_engine >= 0 ? "text-emerald-300" : "text-rose-300"}>{r.eps_engine.toFixed(1)}</td>
              <td className={r.eps_tactics >= 0 ? "text-emerald-300" : "text-rose-300"}>{r.eps_tactics.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
