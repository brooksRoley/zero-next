export interface EdgeResult {
  edge: number;        // sim_spread - vegas_spread (positive = model likes away more)
  direction: "home" | "away" | "none";
}

export function detectEdge(simSpread: number, vegasSpread: number): EdgeResult {
  const edge = simSpread - vegasSpread;
  const direction = edge < 0 ? "home" : edge > 0 ? "away" : "none";
  return { edge: Math.round(edge * 10) / 10, direction };
}

export function classifyConfidence(edge: number, stddev: number): "high" | "medium" | "low" {
  const absEdge = Math.abs(edge);
  if (absEdge > 5 && stddev < 8) return "high";
  if (absEdge > 3 && stddev < 10) return "medium";
  return "low";
}
