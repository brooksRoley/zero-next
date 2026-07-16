export default function CoefficientsTable({ coeffs }: { coeffs: Record<string, unknown> }) {
  const rows: [string, string, number | string][] = [];
  for (const [group, values] of Object.entries(coeffs)) {
    if (values && typeof values === "object") {
      for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
        rows.push([group, k, typeof v === "number" ? v : String(v)]);
      }
    }
  }

  return (
    <table className="w-full text-sm font-mono">
      <thead>
        <tr className="border-b border-white/10 text-left">
          <th className="py-2">Group</th>
          <th className="py-2">Coeff</th>
          <th className="py-2">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([g, k, v], i) => (
          <tr key={i} className="border-b border-white/5">
            <td className="py-1">{g}</td>
            <td className="py-1">{k}</td>
            <td className="py-1">{typeof v === "number" ? v.toFixed(4) : v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
