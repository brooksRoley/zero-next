// BARREL — surf conditions in, wave parameters out.
//
// SetGlobalSurfConditions(height, period, wind, breakType) lands here. The
// mapping is a game model, not oceanography: it keeps the real relationships
// (bigger and longer-period swell = more powerful, offshore wind = hollower,
// onshore = choppier and mushier) and tunes the magnitudes for play.
#pragma once

namespace barrel {

enum class BreakType : int { Pipeline = 0, Teahupoo = 1, SkeletonBay = 2 };
constexpr int kBreakTypeCount = 3;

struct SurfConditions {
  float height = 2.6f;  // breaking face height, metres
  float period = 13.0f; // swell period, seconds
  float wind = 3.0f;    // offshore component, m/s (negative = onshore)
  BreakType type = BreakType::Pipeline;
};

// Clamp raw inputs from JavaScript into the playable range. NaN and out-of-range
// values never reach the physics.
SurfConditions sanitizeConditions(float height, float period, float wind, int breakType);

struct WaveParams {
  float height;      // face height H (m)
  float amplitude;   // A: crest elevation above still water (m)
  float steepness;   // Gerstner Q = kA, < 1 so the trochoid never loops
  float k;           // wavenumber (rad/m)
  float speed;       // crest speed c (m/s)
  float speedWobble; // fractional speed swing as the wave peels (speed-matching)
  float wobblePeriod;// seconds per swing
  float lipReach;    // L: horizontal throw of the lip, in quarter-wavelengths
  float lipDroop;    // D: how far the lip tip hangs down, in crest heights
  float lipExp;      // beta in the exponential fold curve
  float foldStart;   // height fraction where folding begins
  float backShare;   // fraction of the throw applied to the back (lip thickness)
  float suck;        // trough depression in front of the face (m)
  float chop;        // background chop amplitude (m)
  float dir;         // +1 travels to screen-right, -1 to screen-left
  float curlRate;    // 1/s: how fast the lip pitches once the wave breaks
  float swellTime;   // s of approach before it breaks
  float breakTime;   // s of breaking section
  float shoulderTime;// s of shoulder as it backs off
  float wipeoutHold; // s held under after a wipeout
  float wipeoutPenalty; // points lost on a wipeout
  float energy;      // swell energy, H^2 * T, for the HUD
};

WaveParams deriveWaveParams(const SurfConditions& c);
const char* breakName(BreakType type);

}  // namespace barrel
