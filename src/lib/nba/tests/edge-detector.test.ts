import { describe, it, expect } from "vitest";
import { detectEdge, classifyConfidence, type EdgeResult } from "../predictions/edge-detector";
import { computeAccuracy, type PredictionRecord } from "../predictions/accuracy";

describe("detectEdge", () => {
  it("calculates edge as sim spread minus vegas spread", () => {
    const edge = detectEdge(-7.5, -3.5);
    // sim says home by 7.5, vegas says home by 3.5 → edge = -4 (model likes home more)
    expect(edge.edge).toBe(-4);
    expect(edge.direction).toBe("home");
  });

  it("positive edge means model likes away more than Vegas", () => {
    const edge = detectEdge(-1.0, -5.0);
    // sim says home by 1, vegas says home by 5 → edge = +4 (model likes away more)
    expect(edge.edge).toBe(4);
    expect(edge.direction).toBe("away");
  });

  it("zero edge when sim matches Vegas", () => {
    const edge = detectEdge(-3.5, -3.5);
    expect(edge.edge).toBe(0);
    expect(edge.direction).toBe("none");
  });
});

describe("classifyConfidence", () => {
  it("high confidence: |edge| > 5 and stddev < 8", () => {
    expect(classifyConfidence(6, 7)).toBe("high");
    expect(classifyConfidence(-6, 7)).toBe("high");
  });

  it("medium confidence: |edge| > 3 and stddev < 10", () => {
    expect(classifyConfidence(4, 9)).toBe("medium");
  });

  it("low confidence for small edge", () => {
    expect(classifyConfidence(1, 12)).toBe("low");
  });

  it("low confidence for high variance even with big edge", () => {
    expect(classifyConfidence(8, 15)).toBe("low");
  });
});

describe("computeAccuracy", () => {
  it("calculates ATS record correctly", () => {
    const records: PredictionRecord[] = [
      { predicted_spread: -5, vegas_spread: -3, actual_margin: -7 },  // edge on home, home covered → cover
      { predicted_spread: -5, vegas_spread: -3, actual_margin: 2 },   // edge on home, away won → miss
      { predicted_spread: 2, vegas_spread: -1, actual_margin: 3 },    // edge on away, away covered → cover
    ];
    const acc = computeAccuracy(records);
    expect(acc.totalPredictions).toBe(3);
    expect(acc.covers).toBe(2);
    expect(acc.misses).toBe(1);
  });

  it("calculates MAE for model and Vegas", () => {
    const records: PredictionRecord[] = [
      { predicted_spread: -5, vegas_spread: -3, actual_margin: -4 },
      { predicted_spread: -8, vegas_spread: -6, actual_margin: -7 },
    ];
    const acc = computeAccuracy(records);
    // Model MAE: (|(-5)-(-4)| + |(-8)-(-7)|) / 2 = (1 + 1) / 2 = 1
    expect(acc.modelMae).toBe(1);
    // Vegas MAE: (|(-3)-(-4)| + |(-6)-(-7)|) / 2 = (1 + 1) / 2 = 1
    expect(acc.vegasMae).toBe(1);
  });

  it("tracks beat_vegas correctly", () => {
    const records: PredictionRecord[] = [
      { predicted_spread: -5, vegas_spread: -3, actual_margin: -6 },  // model closer: |1| < |3| → beat
      { predicted_spread: -2, vegas_spread: -3, actual_margin: -3 },  // vegas exact → miss
    ];
    const acc = computeAccuracy(records);
    expect(acc.beatVegas).toBe(1);
  });
});
