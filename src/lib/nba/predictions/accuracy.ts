export interface PredictionRecord {
  predicted_spread: number;
  vegas_spread: number;
  actual_margin: number;
}

export interface AccuracyStats {
  totalPredictions: number;
  covers: number;
  misses: number;
  pushes: number;
  modelMae: number;
  vegasMae: number;
  beatVegas: number;
}

/**
 * Did the model's edge side beat the Vegas spread for a single game?
 * Edge direction: predicted_spread < vegas_spread → we like home; otherwise away.
 */
export function evaluateCover(r: PredictionRecord): "cover" | "miss" | "push" {
  if (r.actual_margin === r.vegas_spread) return "push";
  const edgeOnHome = r.predicted_spread < r.vegas_spread;
  if (edgeOnHome) {
    return r.actual_margin < r.vegas_spread ? "cover" : "miss";
  }
  return r.actual_margin > r.vegas_spread ? "cover" : "miss";
}

export function computeAccuracy(records: PredictionRecord[]): AccuracyStats {
  let covers = 0, misses = 0, pushes = 0, beatVegas = 0;
  let modelErrorSum = 0, vegasErrorSum = 0;

  for (const r of records) {
    const modelError = Math.abs(r.predicted_spread - r.actual_margin);
    const vegasError = Math.abs(r.vegas_spread - r.actual_margin);
    modelErrorSum += modelError;
    vegasErrorSum += vegasError;

    if (modelError < vegasError) beatVegas++;

    const outcome = evaluateCover(r);
    if (outcome === "cover") covers++;
    else if (outcome === "push") pushes++;
    else misses++;
  }

  return {
    totalPredictions: records.length,
    covers,
    misses,
    pushes,
    modelMae: records.length > 0 ? Math.round(modelErrorSum / records.length * 100) / 100 : 0,
    vegasMae: records.length > 0 ? Math.round(vegasErrorSum / records.length * 100) / 100 : 0,
    beatVegas,
  };
}
