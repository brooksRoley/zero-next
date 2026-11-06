// BARREL native tests: wave geometry and allocation invariants, run by
// `native/barrel/build.sh` before the WASM build. Exits non-zero on failure.
#include <cmath>
#include <cstdio>
#include <memory>

#include "../src/game.hpp"
#include "../src/pool_alloc.hpp"

using namespace barrel;

static int failures = 0;
#define CHECK(cond, ...)                         \
  do {                                           \
    if (!(cond)) {                               \
      std::printf("FAIL %s:%d ", __FILE__, __LINE__); \
      std::printf(__VA_ARGS__);                  \
      std::printf("\n");                         \
      ++failures;                                \
    }                                            \
  } while (0)

// The chain never crosses itself and consecutive vertices stay apart.
static void geometryHolds(int type, float height, float period, float wind, float dirOverride) {
  auto g = std::make_unique<Game>();
  g->setConditions(sanitizeConditions(height, period, wind, type));
  g->newWave();
  if (dirOverride != 0.0f) {
    // Exercise the other travel direction through the same code path.
    WaveParams p = deriveWaveParams(g->conditions());
    p.dir = dirOverride;
    const_cast<WaveTerrain&>(g->wave()).spawn(0.0f, p);
  }
  int intersections = 0, closePairs = 0;
  float maxTipDrop = 0.0f;
  for (int i = 0; i < 60 * 24; ++i) {
    g->step(0);
    if (i % 6) continue;
    if (g->chainSelfIntersects()) ++intersections;
    const b2Vec2* p = g->wave().points();
    for (int j = 0; j + 1 < g->wave().count(); ++j)
      if ((p[j + 1] - p[j]).Length() <= b2_linearSlop) ++closePairs;
    maxTipDrop = std::fmax(maxTipDrop, g->wave().curl());
  }
  CHECK(intersections == 0, "type %d H=%.1f T=%.0f wind=%.0f dir=%.0f: %d self-intersecting frames", type, height,
        period, wind, dirOverride, intersections);
  CHECK(closePairs == 0, "type %d: %d vertex pairs closer than b2_linearSlop", type, closePairs);
  CHECK(maxTipDrop > 0.99f, "type %d: the wave never fully broke (curl %.2f)", type, maxTipDrop);
}

// Crests are sharp and troughs are flat: the trochoid bunches points at the top.
static void trochoidShape() {
  auto g = std::make_unique<Game>();
  g->setConditions(sanitizeConditions(3.0f, 14.0f, 0.0f, 0));
  g->newWave();
  const WaveTerrain& w = g->wave();
  const float crest = w.crestX();
  const float dir = w.dir();
  const float h = 0.05f;
  auto y = [&](float u) { return w.baseHeightAt(crest + dir * u) - w.chopAt(crest + dir * u); };
  const float crestCurv = std::fabs(y(h) - 2 * y(0) + y(-h)) / (h * h);
  const float trough = 3.14159f / deriveWaveParams(g->conditions()).k;
  const float troughCurv = std::fabs(y(-trough + h) - 2 * y(-trough) + y(-trough - h)) / (h * h);
  CHECK(crestCurv > 10.0f * troughCurv, "crest curvature %.3f not sharper than trough %.3f", crestCurv, troughCurv);
}

// The lip folds over: in a fully broken wave some vertical line crosses the
// water surface three times (lip top, lip underside, face).
static void lipFoldsOver() {
  for (int type = 0; type < kBreakTypeCount; ++type) {
    auto g = std::make_unique<Game>();
    g->setConditions(sanitizeConditions(3.0f, 14.0f, 4.0f, type));
    g->newWave();
    for (int i = 0; i < 60 * 9; ++i) g->step(0);
    const WaveTerrain& w = g->wave();
    const b2Vec2* p = w.points();
    const b2Vec2 tip = p[w.tipIndex()];
    const b2Vec2 throat = p[w.throatIndex()];
    const float probe = 0.5f * (tip.x + throat.x);
    int crossings = 0;
    for (int j = 0; j + 1 < w.count(); ++j)
      if ((p[j].x - probe) * (p[j + 1].x - probe) < 0.0f) ++crossings;
    CHECK(crossings >= 3, "type %d: the lip does not overhang (crossings=%d)", type, crossings);
    CHECK(w.localU(tip.x) > w.localU(throat.x) + 1.0f, "type %d: lip tip is not ahead of the throat", type);
  }
}

// After warm-up, rebuilding the chain every step never touches the system heap.
static void noHeapAfterWarmup() {
  auto g = std::make_unique<Game>();
  for (int i = 0; i < 600; ++i) g->step(0);
  const pool::Stats before = pool::stats();
  const int rebuildsBefore = g->wave().rebuilds();
  for (int i = 0; i < 3000; ++i) g->step(i % 50 < 10 ? kKeyLeft : 0);
  const pool::Stats after = pool::stats();
  CHECK(g->wave().rebuilds() - rebuildsBefore == 3000, "chain was not rebuilt every step");
  CHECK(after.systemMallocs == before.systemMallocs, "system mallocs grew %u -> %u", before.systemMallocs,
        after.systemMallocs);
  CHECK(after.arenaCarves == before.arenaCarves, "arena grew by %u blocks after warm-up",
        after.arenaCarves - before.arenaCarves);
  CHECK(after.reuses > before.reuses + 3000, "chain allocations are not being recycled");
}

// The wave is a static body moved by SetTransform, and it still carries a
// board: a paddler the face reaches is lifted and pushed along, not left in
// place to be buried by a surface Box2D thinks is standing still.
static void staticWaveCarries() {
  auto g = std::make_unique<Game>();
  g->setConditions(sanitizeConditions(3.0f, 14.0f, 3.0f, 0));
  g->newWave();
  CHECK(g->wave().body()->GetType() == b2_staticBody, "wave body is not static");
  const float x0 = g->wave().crestX();
  float maxLift = 0.0f, maxPush = 0.0f;
  for (int i = 0; i < 60 * 8 && g->state() == GameState::Paddling; ++i) {
    g->step(0);
    const Snapshot s = g->snapshot();
    maxLift = std::fmax(maxLift, s.boardY);
    maxPush = std::fmax(maxPush, g->wave().dir() * s.boardX);
  }
  CHECK(std::fabs(g->wave().crestX() - x0) > 10.0f, "the static wave did not travel");
  CHECK(maxLift > 1.0f, "the face never lifted the board (max y %.2f)", maxLift);
  CHECK(maxPush > 0.5f, "the face never pushed the board along (max %.2f m)", maxPush);
}

int main() {
  for (int type = 0; type < kBreakTypeCount; ++type) {
    for (float height : {1.0f, 2.0f, 3.0f, 4.5f, 6.0f})
      for (float wind : {-12.0f, 0.0f, 12.0f}) geometryHolds(type, height, 14.0f, wind, 0.0f);
    geometryHolds(type, 3.0f, 6.0f, 4.0f, 0.0f);
    geometryHolds(type, 3.0f, 20.0f, 4.0f, 0.0f);
    geometryHolds(type, 3.0f, 14.0f, 4.0f, +1.0f);
  }
  trochoidShape();
  lipFoldsOver();
  noHeapAfterWarmup();
  staticWaveCarries();
  if (failures) {
    std::printf("%d native check(s) failed\n", failures);
    return 1;
  }
  std::printf("native tests: all checks passed\n");
  return 0;
}
