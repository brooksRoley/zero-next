// BARREL — the WASM entry: main loop, input, and the Emscripten bindings.
//
// The page calls start("#barrel-canvas"). From then on the game loop, the
// physics and the drawing all run in here: requestAnimationFrame drives
// frame(), which advances the simulation in fixed 1/60 s steps (an
// accumulator, so the physics is locked at 60 Hz on any display) and draws
// once. JavaScript only feeds in conditions and touch keys and reads a
// snapshot for its own UI.
//
// SetGlobalSurfConditions(height, period, wind, breakType) is bound with
// EMSCRIPTEN_BINDINGS and also assigned to window.SetGlobalSurfConditions
// while the game is running.
#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/html5.h>

#include <algorithm>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

#include "game.hpp"
#include "pool_alloc.hpp"
#include "render.hpp"

namespace barrel {
namespace {

SurfConditions gConditions{};

struct App {
  Game game;
  Renderer renderer;
  std::string canvas;
  uint32_t keyboard = 0;
  uint32_t touch = 0;
  // Pressed since the last physics step: a tap shorter than a frame still
  // reaches the game (the pop-up is two quick taps).
  uint32_t latched = 0;
  double lastMs = 0.0;
  double accumulator = 0.0;
  uint64_t steps = 0;
  uint64_t frames = 0;
  double sinceDraw = 0.0;
};

std::unique_ptr<App> gApp;

}  // namespace

class HeadlessSim;
namespace {
std::vector<HeadlessSim*> gFollowers;


uint32_t keyFor(const EmscriptenKeyboardEvent* e) {
  const char* code = e->code;
  if (!std::strcmp(code, "KeyA") || !std::strcmp(code, "ArrowLeft")) return kKeyLeft;
  if (!std::strcmp(code, "KeyD") || !std::strcmp(code, "ArrowRight")) return kKeyRight;
  if (!std::strcmp(code, "KeyW") || !std::strcmp(code, "ArrowUp")) return kKeyUp;
  if (!std::strcmp(code, "KeyS") || !std::strcmp(code, "ArrowDown")) return kKeyDown;
  if (!std::strcmp(code, "Space")) return kKeySpace;
  return 0;
}

// Keys belong to the game unless the visitor is typing or using a form
// control (the condition picker and sliders take arrow keys).
bool formControlFocused() {
  return EM_ASM_INT({
    var el = document.activeElement;
    if (!el) return 0;
    var tag = el.tagName;
    return (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el.isContentEditable) ? 1 : 0;
  });
}

// Only while the canvas is on screen: a page scrolled past the game keeps
// its arrow keys and space bar.
bool canvasVisible(const char* selector) {
  return EM_ASM_INT({
    var el = document.querySelector(UTF8ToString($0));
    if (!el) return 0;
    var r = el.getBoundingClientRect();
    return (r.bottom > 0 && r.top < window.innerHeight) ? 1 : 0;
  }, selector);
}

EM_BOOL onKey(int type, const EmscriptenKeyboardEvent* e, void*) {
  if (!gApp) return EM_FALSE;
  const uint32_t k = keyFor(e);
  if (!k) return EM_FALSE;
  if (type == EMSCRIPTEN_EVENT_KEYDOWN) {
    if (formControlFocused() || !canvasVisible(gApp->canvas.c_str())) return EM_FALSE;
    gApp->keyboard |= k;
    gApp->latched |= k;
  } else {
    gApp->keyboard &= ~k;  // always release, wherever focus went
  }
  return EM_TRUE;  // preventDefault: no page scroll on space / arrows
}

EM_BOOL onBlur(int, const EmscriptenFocusEvent*, void*) {
  if (gApp) gApp->keyboard = gApp->touch = 0;
  return EM_FALSE;
}

void frame(void* arg) {
  App* app = static_cast<App*>(arg);
  const double now = emscripten_get_now();
  double dt = app->lastMs > 0.0 ? (now - app->lastMs) / 1000.0 : kStep;
  app->lastMs = now;
  // A backgrounded tab resumes without a burst of catch-up steps.
  dt = std::min(dt, 0.25);
  app->accumulator += dt;
  int n = 0;
  while (app->accumulator >= kStep && n < 8) {
    app->game.step(app->keyboard | app->touch | app->latched);
    app->latched = 0;
    app->accumulator -= kStep;
    ++app->steps;
    ++n;
  }
  if (n == 8) app->accumulator = 0.0;
  // Drawing is locked to the simulation too: on a 120 Hz display every other
  // rAF has no new step, and redrawing an unchanged world only costs battery.
  app->sinceDraw += dt;
  if (n == 0) return;
  app->renderer.draw(app->game, float(app->sinceDraw));
  app->sinceDraw = 0.0;
  ++app->frames;
}

}  // namespace

// ---------------------------------------------------------------------------
// The public surface.

void SetGlobalSurfConditions(float height, float period, float wind, int breakType);

class HeadlessSim {
 public:
  explicit HeadlessSim(bool followGlobal) : follow_(followGlobal) {
    if (follow_) {
      game_.setConditions(gConditions);
      game_.newWave();
      gFollowers.push_back(this);
    }
  }
  ~HeadlessSim() {
    gFollowers.erase(std::remove(gFollowers.begin(), gFollowers.end(), this), gFollowers.end());
  }
  void step(uint32_t keys, int n) {
    for (int i = 0; i < n; ++i) game_.step(keys);
  }
  Snapshot snapshot() const { return game_.snapshot(); }
  void setConditions(float h, float p, float w, int t) { game_.setConditions(sanitizeConditions(h, p, w, t)); }
  void newWave() { game_.newWave(); }
  bool chainSelfIntersects() const { return game_.chainSelfIntersects(); }
  int rebuilds() const { return game_.wave().rebuilds(); }
  int chainCount() const { return game_.wave().count(); }
  float tipX() const {
    const int i = game_.wave().tipIndex();
    return game_.wave().points()[i].x;
  }
  void applyGlobal(const SurfConditions& c) { game_.setConditions(c); }

 private:
  Game game_;
  bool follow_;
};

void SetGlobalSurfConditions(float height, float period, float wind, int breakType) {
  gConditions = sanitizeConditions(height, period, wind, breakType);
  if (gApp) gApp->game.setConditions(gConditions);
  for (HeadlessSim* s : gFollowers) s->applyGlobal(gConditions);
}

bool start(std::string selector, float best) {
  if (gApp) return true;
  auto app = std::make_unique<App>();
  app->canvas = selector;
  app->game.setConditions(gConditions);
  app->game.newWave();
  app->game.setBest(best);
  if (!app->renderer.init(app->canvas.c_str())) return false;
  gApp = std::move(app);
  emscripten_set_keydown_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, EM_TRUE, onKey);
  emscripten_set_keyup_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, EM_TRUE, onKey);
  emscripten_set_blur_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, EM_TRUE, onBlur);
  EM_ASM({
    window.SetGlobalSurfConditions = function(h, p, w, t) { Module.SetGlobalSurfConditions(h, p, w, t | 0); };
  });
  emscripten_set_main_loop_arg(frame, gApp.get(), 0, false);
  return true;
}

void stop() {
  if (!gApp) return;
  emscripten_cancel_main_loop();
  emscripten_set_keydown_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, EM_TRUE, nullptr);
  emscripten_set_keyup_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, EM_TRUE, nullptr);
  emscripten_set_blur_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, EM_TRUE, nullptr);
  EM_ASM({ delete window.SetGlobalSurfConditions; });
  gApp->renderer.shutdown();
  gApp.reset();
}

bool running() { return gApp != nullptr; }
void setTouchKeys(uint32_t keys) {
  if (!gApp) return;
  keys &= 31u;
  gApp->latched |= keys & ~gApp->touch;
  gApp->touch = keys;
}
void setBest(float best) {
  if (gApp) gApp->game.setBest(best);
}
float getBest() { return gApp ? gApp->game.bestScore() : 0.0f; }
double getSteps() { return gApp ? double(gApp->steps) : 0.0; }
double getFrames() { return gApp ? double(gApp->frames) : 0.0; }

Snapshot getSnapshot() {
  if (gApp) return gApp->game.snapshot();
  Snapshot s{};
  return s;
}

struct ConditionsView {
  float height, period, wind;
  int breakType;
};
ConditionsView getConditions() {
  return {gConditions.height, gConditions.period, gConditions.wind, int(gConditions.type)};
}

pool::Stats poolStats() { return pool::stats(); }

}  // namespace barrel

EMSCRIPTEN_BINDINGS(barrel) {
  using namespace emscripten;
  using namespace barrel;

  function("SetGlobalSurfConditions", &SetGlobalSurfConditions);
  function("start", &start);
  function("stop", &stop);
  function("running", &running);
  function("setTouchKeys", &setTouchKeys);
  function("setBest", &setBest);
  function("getBest", &getBest);
  function("getSteps", &getSteps);
  function("getFrames", &getFrames);
  function("getSnapshot", &getSnapshot);
  function("getConditions", &getConditions);
  function("poolStats", &poolStats);

  value_object<Snapshot>("Snapshot")
      .field("state", &Snapshot::state)
      .field("outcome", &Snapshot::outcome)
      .field("cause", &Snapshot::cause)
      .field("phase", &Snapshot::phase)
      .field("score", &Snapshot::score)
      .field("lastScore", &Snapshot::lastScore)
      .field("rideTime", &Snapshot::rideTime)
      .field("tubeTime", &Snapshot::tubeTime)
      .field("speed", &Snapshot::speed)
      .field("popMeter", &Snapshot::popMeter)
      .field("popQuality", &Snapshot::popQuality)
      .field("popStage", &Snapshot::popStage)
      .field("inWindow", &Snapshot::inWindow)
      .field("inBarrel", &Snapshot::inBarrel)
      .field("crouching", &Snapshot::crouching)
      .field("curl", &Snapshot::curl)
      .field("waveHeight", &Snapshot::waveHeight)
      .field("waveSpeed", &Snapshot::waveSpeed)
      .field("energy", &Snapshot::energy)
      .field("swellDistance", &Snapshot::swellDistance)
      .field("tubeBack", &Snapshot::tubeBack)
      .field("tubeFront", &Snapshot::tubeFront)
      .field("boardX", &Snapshot::boardX)
      .field("boardY", &Snapshot::boardY)
      .field("boardAngle", &Snapshot::boardAngle)
      .field("crestX", &Snapshot::crestX)
      .field("rides", &Snapshot::rides)
      .field("chainCount", &Snapshot::chainCount)
      .field("breakType", &Snapshot::breakType)
      .field("condHeight", &Snapshot::condHeight)
      .field("condPeriod", &Snapshot::condPeriod)
      .field("condWind", &Snapshot::condWind);

  value_object<ConditionsView>("Conditions")
      .field("height", &ConditionsView::height)
      .field("period", &ConditionsView::period)
      .field("wind", &ConditionsView::wind)
      .field("breakType", &ConditionsView::breakType);

  value_object<pool::Stats>("PoolStats")
      .field("arenaBytesUsed", &pool::Stats::arenaBytesUsed)
      .field("arenaCarves", &pool::Stats::arenaCarves)
      .field("reuses", &pool::Stats::reuses)
      .field("systemMallocs", &pool::Stats::systemMallocs)
      .field("liveBlocks", &pool::Stats::liveBlocks);

  class_<HeadlessSim>("HeadlessSim")
      .constructor<bool>()
      .function("step", &HeadlessSim::step)
      .function("snapshot", &HeadlessSim::snapshot)
      .function("setConditions", &HeadlessSim::setConditions)
      .function("newWave", &HeadlessSim::newWave)
      .function("chainSelfIntersects", &HeadlessSim::chainSelfIntersects)
      .function("rebuilds", &HeadlessSim::rebuilds)
      .function("chainCount", &HeadlessSim::chainCount)
      .function("tipX", &HeadlessSim::tipX);
}
