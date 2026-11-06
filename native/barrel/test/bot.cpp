// Dev tool: a pocket-keeping bot. Prints outcome per break type.
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <memory>
#include "../src/game.hpp"
using namespace barrel;
struct Result { int outcome, cause; float ride, tube, score; };
Result run(int type, float H, float target, float band, bool verbose) {
  auto g = std::make_unique<Game>();
  g->setConditions(sanitizeConditions(H, 14, 4, type));
  g->newWave();
  const float dir = g->wave().dir();
  const uint32_t fwd = dir < 0 ? kKeyLeft : kKeyRight, back = dir < 0 ? kKeyRight : kKeyLeft;
  int popStep = -1;
  for (int i = 0; i < 60 * 60; ++i) {
    Snapshot s = g->snapshot();
    uint32_t k = 0;
    if (s.state == 0) {
      if (s.inWindow && s.popMeter >= 0.3f && popStep < 0) popStep = i;
      if (popStep >= 0) k = (i - popStep) < 3 ? kKeyDown : kKeyUp;
    } else if (s.state == 1) {
      const float u = s.swellDistance;
      // Aim for a point inside the tube, between its back wall and the lip tip.
      static const char* absT = std::getenv("BOT_U");
      const float tgt = absT ? float(std::atof(absT)) : s.tubeFront > s.tubeBack + 0.5f ? s.tubeBack + target * (s.tubeFront - s.tubeBack)
                                                         : 0.8f * 1.5707963f / deriveWaveParams(g->conditions()).k;
      const bool shoulder = s.phase >= 2 && s.curl < 0.3f;
      if (shoulder) { k |= kKeyUp | back; }            // climb out the back
      else if (u > tgt + band) { k |= kKeyUp | back; } // too far forward: stall + carve up
      else if (u < tgt - band) { if ((i / 8) % 2) k |= kKeyDown; k |= fwd; } // too deep: pump + trim
      if (s.inBarrel || (s.curl > 0.05f && !shoulder)) k |= kKeySpace;
      if (verbose && i % 20 == 0) std::printf("  t=%.2f u=%.2f y=%.2f spd=%.2f barrel=%d curl=%.2f k=%u\n", i/60.f, u, s.boardY, s.speed, s.inBarrel, s.curl, k);
    } else break;
    g->step(k);
  }
  Snapshot f = g->snapshot();
  return {f.outcome, f.cause, f.rideTime, f.tubeTime, f.lastScore};
}
int main(int argc, char** argv) {
  bool verbose = argc > 1;
  float H = argc > 2 ? std::atof(argv[2]) : 3.0f;
  for (int type = 0; type < 3; ++type)
    for (float target : {0.4f, 0.5f, 0.6f, 1.2f, 1.5f})
      for (float band : {0.3f, 0.6f}) {
        Result r = run(type, H, target, band, verbose && type == std::atoi(argv[1]) && target == 0.5f && band == 0.3f);
        std::printf("type=%d target=%.1f band=%.1f -> outcome=%d cause=%d ride=%.1f tube=%.1f score=%.0f\n", type, target, band, r.outcome, r.cause, r.ride, r.tube, r.score);
      }
}
