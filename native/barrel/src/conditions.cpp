#include "conditions.hpp"

#include <algorithm>
#include <cmath>

namespace barrel {
namespace {

float clampFinite(float v, float lo, float hi, float fallback) {
  if (!std::isfinite(v)) return fallback;
  return std::clamp(v, lo, hi);
}

struct BreakProfile {
  float steepness;
  float speedScale;
  float speedWobble;
  float wobblePeriod;
  float reach;      // lip throw, quarter-wavelengths
  float droop;      // lip hang, crest heights
  float backShare;
  float suck;       // trough depression, face heights
  float curlRate;
  float breakTime;
  float wipeoutHold;
  float wipeoutPenalty;
};

// Pipeline: hollow and fast, the biggest throw, the worst hold-down.
// Teahupo'o: thick lip, a trough that sucks below sea level in front of the
//   face, a lip that pitches almost at once (you bottom-turn immediately).
// Skeleton Bay: a long left that keeps changing speed; endurance and speed
//   matching rather than one big drop. All three are lefts, so they travel
//   to screen-left.
// reach is in quarter-wavelengths of the face; droop in crest heights; suck in face heights.
constexpr BreakProfile kProfiles[kBreakTypeCount] = {
    {0.84f, 1.10f, 0.12f, 5.0f, 1.15f, 0.85f, 0.45f, 0.15f, 0.9f, 10.0f, 4.0f, 400.0f},
    {0.86f, 1.00f, 0.06f, 5.0f, 1.00f, 0.95f, 0.70f, 0.40f, 1.8f, 9.0f, 3.5f, 300.0f},
    {0.76f, 1.22f, 0.20f, 7.0f, 0.90f, 0.75f, 0.35f, 0.12f, 0.6f, 24.0f, 2.0f, 150.0f},
};

}  // namespace

SurfConditions sanitizeConditions(float height, float period, float wind, int breakType) {
  SurfConditions c;
  c.height = clampFinite(height, 1.0f, 6.0f, 2.6f);
  c.period = clampFinite(period, 5.0f, 22.0f, 13.0f);
  c.wind = clampFinite(wind, -15.0f, 15.0f, 0.0f);
  c.type = (breakType >= 0 && breakType < kBreakTypeCount) ? BreakType(breakType) : BreakType::Pipeline;
  return c;
}

WaveParams deriveWaveParams(const SurfConditions& c) {
  const BreakProfile& p = kProfiles[int(c.type)];
  const float H = c.height;
  const float offshore = std::clamp(c.wind, -10.0f, 10.0f);
  // Offshore wind holds the face up and lets the lip throw further; onshore
  // knocks the lip over early and makes the wave mushier.
  const float hollow = std::clamp(1.0f + 0.035f * offshore, 0.65f, 1.35f);
  // Longer period = more water moving = more power. 6 s windswell -> 0, 18 s groundswell -> 1.
  const float power = std::clamp((c.period - 6.0f) / 12.0f, 0.0f, 1.0f);

  WaveParams w{};
  w.height = H;
  // Troughs are flat, so the crest stands ~0.78 H above still water and the
  // trough in front sucks down the rest: crest-to-trough is about H.
  w.amplitude = 0.78f * H;
  w.steepness = std::clamp(p.steepness + 0.008f * offshore, 0.6f, 0.9f);
  w.k = w.steepness / w.amplitude;
  // Shallow-water breaking speed sqrt(g * d), breaking depth d ~ 1.3 H.
  w.speed = std::sqrt(9.81f * 1.3f * H) * p.speedScale * (0.9f + 0.2f * power);
  w.speedWobble = p.speedWobble;
  w.wobblePeriod = p.wobblePeriod;
  w.lipReach = p.reach * hollow * (0.85f + 0.3f * power);
  w.lipDroop = p.droop * std::min(hollow, 1.1f);
  w.lipExp = 2.6f;
  w.foldStart = 0.42f;
  w.backShare = p.backShare;
  w.suck = H * p.suck;
  w.chop = 0.03f + 0.012f * std::max(0.0f, -offshore);
  w.dir = -1.0f;
  w.curlRate = p.curlRate * (0.85f + 0.3f * power);
  w.swellTime = 7.0f;
  w.breakTime = p.breakTime;
  w.shoulderTime = 4.0f;
  w.wipeoutHold = p.wipeoutHold;
  w.wipeoutPenalty = p.wipeoutPenalty;
  w.energy = H * H * c.period;
  return w;
}

const char* breakName(BreakType type) {
  switch (type) {
    case BreakType::Pipeline: return "PIPELINE";
    case BreakType::Teahupoo: return "TEAHUPO'O";
    case BreakType::SkeletonBay: return "SKELETON BAY";
  }
  return "PIPELINE";
}

}  // namespace barrel
