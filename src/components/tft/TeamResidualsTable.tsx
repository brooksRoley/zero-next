import { useState } from "react";

interface Row {
  team_id: number;
  sim_wins: number;
  actual_wins: number;
  eps_engine: number;
  eps_tactics: number;
}

export default function TeamResidualsTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<keyof Row>("eps_engine");
  const sorted = [...rows].sort((a, b) => Math.abs(b[sortKey]) - Math.abs(a[sortKey]));

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/10 text-left">
          <th className="py-2">Team</th>
          <th onClick={() => setSortKey("sim_wins")} className="cursor-pointer">Sim W</th>
          <th onClick={() => setSortKey("actual_wins")} className="cursor-pointer">Actual W</th>
          <th onClick={() => setSortKey("eps_engine")} className="cursor-pointer">ε engine</th>
          <th onClick={() => setSortKey("eps_tactics")} className="cursor-pointer">ε tactics</th>
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
  );
}
