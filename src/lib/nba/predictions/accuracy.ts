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

export function computeAccuracy(records: PredictionRecord[]): AccuracyStats {
  let covers = 0, misses = 0, pushes = 0, beatVegas = 0;
  let modelErrorSum = 0, vegasErrorSum = 0;

  for (const r of records) {
    const modelError = Math.abs(r.predicted_spread - r.actual_margin);
    const vegasError = Math.abs(r.vegas_spread - r.actual_margin);
    modelErrorSum += modelError;
    vegasErrorSum += vegasError;

    if (modelError < vegasError) beatVegas++;

    // ATS: did the edge side cover?
    // Edge direction: if predicted_spread < vegas_spread → edge on home
    const edgeOnHome = r.predicted_spread < r.vegas_spread;
    if (edgeOnHome) {
      // We predicted home does better than Vegas thinks
      // Cover if actual margin < vegas spread (home beat the spread)
      if (r.actual_margin < r.vegas_spread) covers++;
      else if (r.actual_margin === r.vegas_spread) pushes++;
      else misses++;
    } else {
      // Edge on away: we predicted away does better
      // Cover if actual margin > vegas spread (away beat the spread)
      if (r.actual_margin > r.vegas_spread) covers++;
      else if (r.actual_margin === r.vegas_spread) pushes++;
      else misses++;
    }
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
