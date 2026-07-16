import { ZONES } from "src/lib/nba/tft/zones";

function colorFor(share: number): string {
  // Heat gradient: white → orange → deep red.
  const t = Math.min(1, Math.max(0, share * 3));
  const r = 255;
  const g = Math.round(255 * (1 - t) + 100 * t);
  const b = Math.round(255 * (1 - t) + 40 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function CourtSVG({ bins }: { bins: Record<string, number> }) {
  return (
    <svg viewBox="0 0 460 300" className="w-full h-auto">
      {ZONES.map((z) => (
        <polygon
          key={z.id}
          points={z.poly}
          fill={colorFor(bins[z.id] ?? 0)}
          stroke="rgba(255,255,255,0.1)"
        />
      ))}
    </svg>
  );
}

export default function ShotHeatmap({
  simBins,
  priorBins,
}: {
  simBins: Record<string, number>;
  priorBins: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs opacity-70 mb-1">Sim</div>
        <CourtSVG bins={simBins} />
      </div>
      <div>
        <div className="text-xs opacity-70 mb-1">Prior</div>
        <CourtSVG bins={priorBins} />
      </div>
    </div>
  );
}
