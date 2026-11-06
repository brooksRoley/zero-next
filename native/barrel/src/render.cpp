#include "render.hpp"

#include <algorithm>
#include <cmath>
#include <cstdio>

#include "font.hpp"

namespace barrel {
namespace {

constexpr size_t kMaxVerts = 240000;
constexpr float kPi = 3.14159265358979f;

constexpr uint32_t rgba(uint32_t r, uint32_t g, uint32_t b, uint32_t a = 255) {
  return r | (g << 8) | (b << 16) | (a << 24);
}
uint32_t withAlpha(uint32_t c, float a) {
  return (c & 0x00FFFFFFu) | (uint32_t(std::clamp(a, 0.0f, 1.0f) * 255.0f) << 24);
}
uint32_t mix(uint32_t a, uint32_t b, float t) {
  t = std::clamp(t, 0.0f, 1.0f);
  uint32_t out = 0;
  for (int i = 0; i < 4; ++i) {
    const float ca = float((a >> (8 * i)) & 0xFF), cb = float((b >> (8 * i)) & 0xFF);
    out |= uint32_t(ca + (cb - ca) * t + 0.5f) << (8 * i);
  }
  return out;
}

// Palette: dawn on a reef. Deep navy water, turquoise faces, peach horizon.
constexpr uint32_t kSkyTop = rgba(14, 33, 58);
constexpr uint32_t kSkyMid = rgba(52, 96, 128);
constexpr uint32_t kSkyHorizon = rgba(242, 196, 141);
constexpr uint32_t kSun = rgba(255, 226, 170);
constexpr uint32_t kRidgeFar = rgba(98, 112, 128);
constexpr uint32_t kRidgeNear = rgba(46, 62, 78);
constexpr uint32_t kFaceTop = rgba(92, 204, 206);
constexpr uint32_t kFaceMid = rgba(28, 132, 160);
constexpr uint32_t kDeep = rgba(9, 44, 78);
constexpr uint32_t kFoam = rgba(236, 250, 250);
constexpr uint32_t kBoard = rgba(242, 232, 210);
constexpr uint32_t kBoardStripe = rgba(201, 150, 70);
constexpr uint32_t kSuit = rgba(24, 30, 40);
constexpr uint32_t kSkin = rgba(214, 168, 128);
constexpr uint32_t kHudText = rgba(244, 238, 226);
constexpr uint32_t kHudDim = rgba(180, 196, 206);
constexpr uint32_t kHudAccent = rgba(242, 196, 120);
constexpr uint32_t kHudGood = rgba(120, 220, 170);
constexpr uint32_t kHudBad = rgba(240, 120, 110);
constexpr uint32_t kPanel = rgba(8, 22, 38, 205);

const char* kVertex = R"(#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aCol;
uniform vec2 uScale;
uniform vec2 uOffset;
out vec4 vCol;
void main() {
  gl_Position = vec4(aPos * uScale + uOffset, 0.0, 1.0);
  vCol = aCol;
})";

const char* kFragment = R"(#version 300 es
precision mediump float;
in vec4 vCol;
out vec4 outColor;
void main() { outColor = vCol; })";

GLuint compile(GLenum type, const char* src) {
  GLuint s = glCreateShader(type);
  glShaderSource(s, 1, &src, nullptr);
  glCompileShader(s);
  GLint ok = 0;
  glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
  if (!ok) {
    char log[512];
    glGetShaderInfoLog(s, sizeof log, nullptr, log);
    std::printf("BARREL shader error: %s\n", log);
  }
  return s;
}

const char* outcomeTitle(int outcome) {
  switch (Outcome(outcome)) {
    case Outcome::KickOut: return "KICK OUT";
    case Outcome::RodeOut: return "RODE IT OUT";
    case Outcome::Wipeout: return "WIPEOUT";
    case Outcome::Missed: return "MISSED IT";
    default: return "";
  }
}

const char* outcomeLine(int outcome, int cause) {
  if (Outcome(outcome) == Outcome::KickOut) return "CLEAN EXIT OVER THE BACK";
  if (Outcome(outcome) == Outcome::RodeOut) return "THE WAVE BACKED OFF UNDER YOU";
  if (Outcome(outcome) == Outcome::Missed) return "THE WAVE PASSED UNDER YOU";
  switch (Cause(cause)) {
    case Cause::TooEarly: return "STOOD UP BEFORE THE WAVE HAD YOU";
    case Cause::OverTheFalls: return "TOO LATE: OVER THE FALLS";
    case Cause::Pearled: return "NOSE BURIED: STAND UP SOONER";
    case Cause::Lip: return "THE LIP LANDED ON YOU";
    case Cause::Rail: return "CAUGHT A RAIL";
    case Cause::Landing: return "LANDED SIDEWAYS";
    default: return "";
  }
}

}  // namespace

bool Renderer::init(const char* canvasSelector) {
  canvas_ = canvasSelector;
  EmscriptenWebGLContextAttributes attr;
  emscripten_webgl_init_context_attributes(&attr);
  attr.alpha = false;
  attr.depth = false;
  attr.stencil = true;
  attr.antialias = true;
  attr.premultipliedAlpha = false;
  attr.majorVersion = 2;
  attr.minorVersion = 0;
  ctx_ = emscripten_webgl_create_context(canvasSelector, &attr);
  if (ctx_ <= 0) return false;
  emscripten_webgl_make_context_current(ctx_);

  program_ = glCreateProgram();
  GLuint vs = compile(GL_VERTEX_SHADER, kVertex);
  GLuint fs = compile(GL_FRAGMENT_SHADER, kFragment);
  glAttachShader(program_, vs);
  glAttachShader(program_, fs);
  glLinkProgram(program_);
  glDeleteShader(vs);
  glDeleteShader(fs);
  uScale_ = glGetUniformLocation(program_, "uScale");
  uOffset_ = glGetUniformLocation(program_, "uOffset");

  glGenVertexArrays(1, &vao_);
  glBindVertexArray(vao_);
  glGenBuffers(1, &vbo_);
  glBindBuffer(GL_ARRAY_BUFFER, vbo_);
  glBufferData(GL_ARRAY_BUFFER, GLsizeiptr(kMaxVerts * sizeof(Vertex)), nullptr, GL_DYNAMIC_DRAW);
  glEnableVertexAttribArray(0);
  glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), reinterpret_cast<void*>(0));
  glEnableVertexAttribArray(1);
  glVertexAttribPointer(1, 4, GL_UNSIGNED_BYTE, GL_TRUE, sizeof(Vertex), reinterpret_cast<void*>(8));
  verts_.reserve(kMaxVerts);
  cameraInit_ = false;
  return true;
}

void Renderer::shutdown() {
  if (ctx_ <= 0) return;
  emscripten_webgl_make_context_current(ctx_);
  glDeleteBuffers(1, &vbo_);
  glDeleteVertexArrays(1, &vao_);
  glDeleteProgram(program_);
  emscripten_webgl_destroy_context(ctx_);
  ctx_ = 0;
}

void Renderer::resize() {
  double cssW = 0, cssH = 0;
  emscripten_get_element_css_size(canvas_, &cssW, &cssH);
  pixelRatio_ = std::min(2.0f, float(emscripten_get_device_pixel_ratio()));
  const int w = std::max(1, int(cssW * pixelRatio_));
  const int h = std::max(1, int(cssH * pixelRatio_));
  if (w != width_ || h != height_) {
    width_ = w;
    height_ = h;
    emscripten_set_canvas_element_size(canvas_, w, h);
  }
  glViewport(0, 0, width_, height_);
}

void Renderer::updateCamera(const Game& game, float dt, bool snap) {
  const Snapshot s = game.snapshot();
  const float dir = game.wave().dir();
  const float aspect = float(width_) / float(std::max(1, height_));
  float halfW, cx;
  switch (GameState(s.state)) {
    case GameState::Paddling: {
      const float span = std::fabs(s.crestX - s.boardX);
      halfW = std::clamp(span * 0.6f + 8.0f, 11.0f, 42.0f);
      cx = s.boardX + (s.crestX - s.boardX) * 0.35f;
      break;
    }
    case GameState::Riding:
      halfW = std::max(7.5f, s.waveHeight * 2.6f);
      cx = s.boardX - dir * 0.8f;
      break;
    default:
      halfW = std::max(9.0f, s.waveHeight * 3.0f);
      cx = s.boardX;
      break;
  }
  // Portrait screens keep the wave's width in view and show more sky.
  if (aspect < 1.0f) halfW *= 0.8f;
  const float halfH = halfW / aspect;
  const float cy = 0.3f * halfH + std::max(0.0f, s.boardY - 0.4f * halfH);
  const float k = snap ? 1.0f : 1.0f - std::exp(-dt * 3.0f);
  const float kz = snap ? 1.0f : 1.0f - std::exp(-dt * 1.6f);
  view_.cx += (cx - view_.cx) * k;
  view_.halfW += (halfW - view_.halfW) * kz;
  view_.halfH = view_.halfW / aspect;
  view_.cy += (cy - view_.cy) * k;
}

float Renderer::worldToScreenX(float x) const {
  return (x - view_.cx) / view_.halfW * 0.5f * float(width_) + 0.5f * float(width_);
}
float Renderer::worldToScreenY(float y) const {
  return 0.5f * float(height_) - (y - view_.cy) / view_.halfH * 0.5f * float(height_);
}

void Renderer::begin() { verts_.clear(); }

void Renderer::flush(float sx, float sy, float ox, float oy) {
  if (verts_.empty()) return;
  glUseProgram(program_);
  glBindVertexArray(vao_);
  glBindBuffer(GL_ARRAY_BUFFER, vbo_);
  glUniform2f(uScale_, sx, sy);
  glUniform2f(uOffset_, ox, oy);
  const size_t n = std::min(verts_.size(), kMaxVerts);
  glBufferSubData(GL_ARRAY_BUFFER, 0, GLsizeiptr(n * sizeof(Vertex)), verts_.data());
  glDrawArrays(GL_TRIANGLES, 0, GLsizei(n));
  verts_.clear();
}

void Renderer::flushWorld() {
  const float sx = 1.0f / view_.halfW, sy = 1.0f / view_.halfH;
  flush(sx, sy, -view_.cx * sx, -view_.cy * sy);
}

void Renderer::flushScreen() { flush(2.0f / float(width_), -2.0f / float(height_), -1.0f, 1.0f); }

void Renderer::tri(float x0, float y0, float x1, float y1, float x2, float y2, uint32_t c) {
  if (verts_.size() + 3 > kMaxVerts) return;
  verts_.push_back({x0, y0, c});
  verts_.push_back({x1, y1, c});
  verts_.push_back({x2, y2, c});
}

void Renderer::tri3(float x0, float y0, uint32_t c0, float x1, float y1, uint32_t c1, float x2, float y2, uint32_t c2) {
  if (verts_.size() + 3 > kMaxVerts) return;
  verts_.push_back({x0, y0, c0});
  verts_.push_back({x1, y1, c1});
  verts_.push_back({x2, y2, c2});
}

void Renderer::quad(float x0, float y0, float x1, float y1, uint32_t c) {
  tri(x0, y0, x1, y0, x1, y1, c);
  tri(x0, y0, x1, y1, x0, y1, c);
}

void Renderer::quadGrad(float x0, float y0, float x1, float y1, uint32_t top, uint32_t bottom) {
  tri3(x0, y0, top, x1, y0, top, x1, y1, bottom);
  tri3(x0, y0, top, x1, y1, bottom, x0, y1, bottom);
}

void Renderer::line(float x0, float y0, float x1, float y1, float w, uint32_t c) {
  float dx = x1 - x0, dy = y1 - y0;
  const float len = std::sqrt(dx * dx + dy * dy);
  if (len < 1e-6f) return;
  const float nx = -dy / len * 0.5f * w, ny = dx / len * 0.5f * w;
  tri(x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, c);
  tri(x0 + nx, y0 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny, c);
}

void Renderer::disc(float x, float y, float r, uint32_t c, int segments) {
  for (int i = 0; i < segments; ++i) {
    const float a0 = 2.0f * kPi * float(i) / float(segments);
    const float a1 = 2.0f * kPi * float(i + 1) / float(segments);
    tri(x, y, x + r * std::cos(a0), y + r * std::sin(a0), x + r * std::cos(a1), y + r * std::sin(a1), c);
  }
}

float Renderer::textWidth(const char* s, float px) const {
  int n = 0;
  for (const char* p = s; *p; ++p) ++n;
  return n > 0 ? float(n * (font::kWidth + 1) - 1) * px : 0.0f;
}

float Renderer::text(const char* s, float x, float y, float px, uint32_t c, int align) {
  const float w = textWidth(s, px);
  float cx = align < 0 ? x : (align == 0 ? x - 0.5f * w : x - w);
  for (const char* p = s; *p; ++p) {
    const uint8_t* g = font::glyph(*p);
    if (g) {
      for (int row = 0; row < font::kHeight; ++row)
        for (int col = 0; col < font::kWidth; ++col)
          if (g[row] & (0x10 >> col))
            quad(cx + float(col) * px, y + float(row) * px, cx + float(col + 1) * px, y + float(row + 1) * px, c);
    }
    cx += float(font::kWidth + 1) * px;
  }
  return w;
}

void Renderer::draw(const Game& game, float dt) {
  if (ctx_ <= 0) return;
  emscripten_webgl_make_context_current(ctx_);
  time_ += dt;
  resize();
  updateCamera(game, dt, !cameraInit_);
  cameraInit_ = true;

  glDisable(GL_DEPTH_TEST);
  glEnable(GL_BLEND);
  glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  glClearColor(0.05f, 0.13f, 0.23f, 1.0f);
  glClearStencil(0);
  glClear(GL_COLOR_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);

  begin();
  drawSky(game);
  drawWater(game);
  drawSurfaceLine(game);
  drawParticles(game);
  drawBoardAndRider(game);
  flushWorld();
  drawHud(game);
  flushScreen();
}

void Renderer::drawSky(const Game& game) {
  (void)game;
  const float W = float(width_), H = float(height_);
  const float horizon = std::clamp(worldToScreenY(0.0f), 0.0f, H);
  quadGrad(0, 0, W, horizon * 0.55f, kSkyTop, kSkyMid);
  quadGrad(0, horizon * 0.55f, W, horizon, kSkyMid, kSkyHorizon);
  // Sun low over the horizon, with a soft halo.
  const float sx = W * 0.74f, sy = horizon - H * 0.11f, sr = H * 0.045f;
  for (int i = 4; i >= 1; --i) disc(sx, sy, sr * (1.0f + 0.7f * float(i)), withAlpha(kSun, 0.06f), 28);
  disc(sx, sy, sr, kSun, 28);
  // Two ridgelines of distant islands, parallax against the camera.
  for (int layer = 0; layer < 2; ++layer) {
    const float par = layer == 0 ? 2.0f : 5.0f;  // pixels per metre of camera travel
    const float amp = H * (layer == 0 ? 0.035f : 0.05f);
    const uint32_t col = layer == 0 ? kRidgeFar : kRidgeNear;
    const float step = 6.0f;
    for (float x = 0; x < W; x += step) {
      auto ridge = [&](float px) {
        const float u = (px + view_.cx * par) * 0.0035f + float(layer) * 7.1f;
        const float r = 0.55f * std::sin(u) + 0.3f * std::sin(u * 2.3f + 1.7f) + 0.15f * std::sin(u * 5.1f);
        return horizon - amp * std::max(0.0f, r + 0.15f);
      };
      const float y0 = ridge(x), y1 = ridge(x + step);
      tri(x, horizon, x + step, horizon, x + step, y1, col);
      tri(x, horizon, x + step, y1, x, y0, col);
    }
  }
  flushScreen();
}

void Renderer::drawWater(const Game& game) {
  const WaveTerrain& wave = game.wave();
  const b2Vec2* p = wave.points();
  const int n = wave.count();
  if (n < 2) return;

  // 1. Mark the water polygon in the stencil (fan + invert handles any simple
  //    polygon, including the overhanging lip).
  const float far = 2000.0f, deep = -500.0f;
  const b2Vec2 first = p[0], last = p[n - 1];
  const float firstOut = first.x < last.x ? first.x - far : first.x + far;
  const float lastOut = first.x < last.x ? last.x + far : last.x - far;
  const b2Vec2 pivot(firstOut, deep);
  auto fanTo = [&](b2Vec2 a, b2Vec2 b) { tri(pivot.x, pivot.y, a.x, a.y, b.x, b.y, 0xFFFFFFFFu); };
  fanTo(b2Vec2(firstOut, first.y), first);
  for (int i = 0; i + 1 < n; ++i) fanTo(p[i], p[i + 1]);
  fanTo(last, b2Vec2(lastOut, last.y));
  fanTo(b2Vec2(lastOut, last.y), b2Vec2(lastOut, deep));

  glEnable(GL_STENCIL_TEST);
  glStencilMask(0xFF);
  glStencilFunc(GL_ALWAYS, 0, 0xFF);
  glStencilOp(GL_KEEP, GL_KEEP, GL_INVERT);
  glColorMask(GL_FALSE, GL_FALSE, GL_FALSE, GL_FALSE);
  flushWorld();

  // 2. Fill it with a depth gradient, clearing the stencil as we go.
  glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
  glStencilFunc(GL_NOTEQUAL, 0, 0xFF);
  glStencilOp(GL_ZERO, GL_ZERO, GL_ZERO);
  const float amp = std::max(0.5f, wave.amplitudeNow());
  auto colorAt = [&](float y) {
    if (y >= amp) return kFaceTop;
    if (y >= 0.0f) return mix(kFaceMid, kFaceTop, y / amp);
    return mix(kFaceMid, kDeep, -y / 5.0f);
  };
  const float x0 = view_.cx - view_.halfW - 1.0f, x1 = view_.cx + view_.halfW + 1.0f;
  const float top = view_.cy + view_.halfH + 1.0f, bottom = view_.cy - view_.halfH - 1.0f;
  const float levels[] = {top, amp, 0.0f, -5.0f, bottom};
  for (int i = 0; i + 1 < 5; ++i) {
    const float ya = std::min(levels[i], top), yb = std::max(levels[i + 1], bottom);
    if (ya <= yb) continue;
    quadGrad(x0, ya, x1, yb, colorAt(ya), colorAt(yb));
  }
  flushWorld();
  glDisable(GL_STENCIL_TEST);
}

void Renderer::drawSurfaceLine(const Game& game) {
  const WaveTerrain& wave = game.wave();
  const b2Vec2* p = wave.points();
  const int n = wave.count();
  const float px = view_.halfW / float(width_) * 2.0f;  // metres per pixel
  const float thin = std::max(0.05f, px * 2.0f);
  const int a = std::min(wave.lipRootIndex(), wave.throatIndex());
  const int b = std::max(wave.lipRootIndex(), wave.throatIndex());
  const bool lip = wave.curl() > 0.02f && b > a;
  for (int i = 0; i + 1 < n; ++i) {
    const bool onLip = lip && i >= a && i < b;
    if (p[i].x < view_.cx - view_.halfW - 2 && p[i + 1].x < view_.cx - view_.halfW - 2) continue;
    if (p[i].x > view_.cx + view_.halfW + 2 && p[i + 1].x > view_.cx + view_.halfW + 2) continue;
    line(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y, onLip ? thin * 2.2f : thin,
         onLip ? withAlpha(kFoam, 0.95f) : withAlpha(kFaceTop, 0.85f));
  }
}

void Renderer::drawParticles(const Game& game) {
  for (const Particle& pt : game.particles()) {
    if (pt.life <= 0.0f) continue;
    const float a = std::clamp(pt.life / pt.maxLife, 0.0f, 1.0f);
    const float r = pt.size * (pt.kind == 1 ? (1.6f - 0.6f * a) : 1.0f);
    quad(pt.x - r, pt.y - r, pt.x + r, pt.y + r, withAlpha(kFoam, (pt.kind == 1 ? 0.7f : 0.9f) * a));
  }
}

void Renderer::drawBoardAndRider(const Game& game) {
  const b2Body* body = game.board().body();
  const b2Vec2 c = body->GetPosition();
  const b2Vec2 axis = body->GetWorldVector(b2Vec2(1.0f, 0.0f));  // toward the nose
  b2Vec2 perp(-axis.y, axis.x);
  if (perp.y < 0.0f) perp = -perp;  // the deck faces up
  const GameState state = game.state();
  const bool underwater = state == GameState::Wipeout && c.y < game.wave().baseHeightAt(c.x) - 0.2f;
  const float alpha = underwater ? 0.55f : 1.0f;

  // Board: a slim pointed shape with a stripe.
  auto at = [&](float along, float up) { return c + along * axis + up * perp; };
  const b2Vec2 shape[6] = {at(1.0f, 0.0f), at(0.72f, 0.065f), at(-0.88f, 0.06f),
                           at(-1.0f, 0.0f), at(-0.88f, -0.05f), at(0.72f, -0.055f)};
  for (int i = 1; i + 1 < 6; ++i)
    tri(shape[0].x, shape[0].y, shape[i].x, shape[i].y, shape[i + 1].x, shape[i + 1].y, withAlpha(kBoard, alpha));
  const b2Vec2 s0 = at(0.7f, 0.0f), s1 = at(-0.85f, 0.0f);
  line(s0.x, s0.y, s1.x, s1.y, 0.025f, withAlpha(kBoardStripe, alpha));

  const uint32_t suit = withAlpha(kSuit, alpha), skin = withAlpha(kSkin, alpha);
  auto limb = [&](b2Vec2 a, b2Vec2 b, float w) { line(a.x, a.y, b.x, b.y, w, suit); };

  if (state == GameState::Paddling || state == GameState::Missed ||
      (state == GameState::Done && game.snapshot().outcome == int(Outcome::Missed))) {
    // Prone, paddling: arms circle alternately.
    const float ph = time_ * 5.0f;
    const b2Vec2 head = at(0.55f, 0.2f), shoulder = at(0.38f, 0.14f), hip = at(-0.28f, 0.13f), feet = at(-0.92f, 0.16f);
    limb(shoulder, hip, 0.14f);
    limb(hip, feet, 0.1f);
    for (int side = 0; side < 2; ++side) {
      const float a = ph + float(side) * kPi;
      const b2Vec2 hand = shoulder + (0.32f * std::cos(a)) * axis + (-0.28f * std::max(0.0f, std::sin(a)) + 0.05f) * perp;
      limb(shoulder, hand, 0.07f);
    }
    disc(head.x, head.y, 0.12f, skin);
    return;
  }

  // Standing (or tumbling in the whitewash).
  const float k = state == GameState::Riding ? game.crouchAmount() : 0.6f;
  const float lean = state == GameState::Riding ? game.leanAmount() : 0.0f;
  b2Vec2 up = 0.5f * perp + 0.5f * b2Vec2(0.0f, 1.0f);
  up.Normalize();
  b2Vec2 fwd = axis;
  b2Vec2 base = c;
  if (state == GameState::Wipeout || state == GameState::Done) {
    if (game.snapshot().outcome == int(Outcome::Wipeout)) {
      const float spin = time_ * 5.5f;
      up = b2Vec2(std::sin(spin), std::cos(spin));
      fwd = b2Vec2(up.y, -up.x);
      base = c + b2Vec2(-0.5f * game.wave().dir(), -0.4f);
    }
  }
  auto rp = [&](float along, float upward) { return base + along * fwd + upward * up; };
  const b2Vec2 f1 = rp(0.32f, 0.07f), f2 = rp(-0.32f, 0.07f);
  const b2Vec2 hip = rp(0.06f * lean - 0.04f, 0.92f - 0.42f * k);
  const b2Vec2 knee1 = 0.5f * (f1 + hip) + (0.1f + 0.14f * k) * fwd;
  const b2Vec2 knee2 = 0.5f * (f2 + hip) + (0.02f + 0.12f * k) * fwd;
  const b2Vec2 shoulder = hip + (0.55f - 0.14f * k) * up + (0.1f + 0.2f * k + 0.08f * lean) * fwd;
  const b2Vec2 head = shoulder + 0.2f * up + 0.05f * fwd;
  const float wave = game.carving() ? 0.15f : 0.0f;
  const b2Vec2 hand1 = shoulder + 0.42f * fwd + (-0.08f + wave) * up;
  const b2Vec2 hand2 = shoulder - 0.4f * fwd + (0.06f - wave) * up;
  limb(f1, knee1, 0.1f);
  limb(knee1, hip, 0.11f);
  limb(f2, knee2, 0.1f);
  limb(knee2, hip, 0.11f);
  limb(hip, shoulder, 0.15f);
  limb(shoulder, hand1, 0.07f);
  limb(shoulder, hand2, 0.07f);
  disc(head.x, head.y, 0.12f, skin);
}

void Renderer::drawHud(const Game& game) {
  const Snapshot s = game.snapshot();
  const float W = float(width_), H = float(height_);
  // One font pixel in device pixels: sized from the canvas's CSS size so the
  // HUD reads the same on a phone and a desktop.
  const float cssMin = std::min(W, H * 1.6f) / pixelRatio_;
  const float px = std::max(2.0f, std::floor(pixelRatio_ * std::clamp(cssMin / 420.0f, 1.6f, 3.0f)));
  const float m = px * 6.0f;
  char buf[96];

  // Spot and conditions, top left.
  text(breakName(BreakType(s.breakType)), m, m, px * 2.0f, kHudText, -1);
  const char* wind = s.condWind >= 0.0f ? "OFFSHORE" : "ONSHORE";
  std::snprintf(buf, sizeof buf, "%.1fM  %.0fS  %s %.0fM/S", s.condHeight, s.condPeriod, wind, std::fabs(s.condWind));
  text(buf, m, m + px * 17.0f, px, kHudDim, -1);

  // Score, top right.
  std::snprintf(buf, sizeof buf, "%.0f", s.state == int(GameState::Riding) ? s.score : s.lastScore);
  text(buf, W - m, m, px * 2.0f, kHudText, 1);
  std::snprintf(buf, sizeof buf, "BEST %.0f", game.bestScore());
  text(buf, W - m, m + px * 17.0f, px, kHudDim, 1);

  const GameState state = GameState(s.state);
  const char* instruction = "";
  if (state == GameState::Paddling) {
    // Swell energy and distance.
    const float barW = std::min(W * 0.32f, px * 90.0f);
    const float y = m + px * 28.0f;
    text("SWELL", m, y, px, kHudDim, -1);
    const float bx = m + px * 34.0f;
    quad(bx, y, bx + barW, y + px * 7.0f, withAlpha(kPanel, 0.8f));
    const float fill = std::clamp(s.energy / 400.0f, 0.04f, 1.0f);
    quad(bx, y, bx + barW * fill, y + px * 7.0f, kHudAccent);
    if (s.swellDistance > 3.0f) {
      std::snprintf(buf, sizeof buf, "%.0fM OUT", s.swellDistance);
      text(buf, bx + barW + px * 4.0f, y, px, kHudDim, -1);
    }
    // Pop-up meter: height on the face, window highlighted.
    const float mh = H * 0.36f, mw = px * 7.0f;
    const float mx = W - m - mw, my = H * 0.32f;
    quad(mx, my, mx + mw, my + mh, withAlpha(kPanel, 0.85f));
    const float lo = 0.45f, hi = 0.95f;
    quad(mx, my + mh * (1.0f - hi), mx + mw, my + mh * (1.0f - lo), withAlpha(kHudGood, s.inWindow ? 0.55f : 0.22f));
    const float mk = my + mh * (1.0f - std::clamp(s.popMeter, 0.0f, 1.0f));
    quad(mx - px * 2.0f, mk - px, mx + mw + px * 2.0f, mk + px, s.inWindow ? kHudGood : kHudText);
    text("POP", mx + mw * 0.5f, my + mh + px * 3.0f, px, kHudDim, 0);
    const float quarter = 1.5707963f / std::max(0.05f, deriveWaveParams(game.conditions()).k);
    if (s.popStage == 1) instruction = "W!";
    else if (s.inWindow) instruction = "NOW: S THEN W";
    else if (s.swellDistance > 2.5f * quarter) instruction = "A / D TO PADDLE. WAIT FOR THE WAVE";
    else instruction = "WHEN IT LIFTS YOU: S THEN W";
  } else if (state == GameState::Riding) {
    std::snprintf(buf, sizeof buf, "TUBE %.1fS   %.0f KM/H", s.tubeTime, s.speed * 3.6f);
    text(buf, W - m, m + px * 28.0f, px, kHudDim, 1);
    if (s.inBarrel) {
      const float pulse = 0.65f + 0.35f * std::sin(time_ * 8.0f);
      text("BARREL", W * 0.5f, m + px * 4.0f, px * 3.0f, withAlpha(kHudAccent, pulse), 0);
    }
    if (s.inBarrel) instruction = "IN THE BARREL: HOLD SPACE";
    else if (s.phase == int(WavePhase::Breaking) && s.curl > 0.05f && !s.crouching)
      instruction = "SPACE: CROUCH UNDER THE LIP";
    else if (s.phase == int(WavePhase::Shoulder)) instruction = "W: CLIMB OUT THE BACK";
    else instruction = "W CARVE UP  *  S PUMP  *  A D LEAN";
  } else if (state == GameState::Wipeout) {
    instruction = "HOLD YOUR BREATH";
  } else {
    // Result card.
    const float cw = std::min(W * 0.94f, px * 230.0f), ch = px * 62.0f;
    const float cx = W * 0.5f, cy = H * 0.42f;
    quad(cx - cw * 0.5f, cy - ch * 0.5f, cx + cw * 0.5f, cy + ch * 0.5f, kPanel);
    const bool good = s.outcome == int(Outcome::KickOut) || s.outcome == int(Outcome::RodeOut);
    text(outcomeTitle(s.outcome), cx, cy - ch * 0.5f + px * 6.0f, px * 3.0f, good ? kHudGood : kHudBad, 0);
    text(outcomeLine(s.outcome, s.cause), cx, cy - ch * 0.5f + px * 30.0f, px, kHudText, 0);
    if (s.outcome != int(Outcome::Missed)) {
      std::snprintf(buf, sizeof buf, "SCORE %.0f   TUBE %.1fS   RIDE %.1fS", s.lastScore, s.tubeTime, s.rideTime);
      text(buf, cx, cy - ch * 0.5f + px * 42.0f, px, kHudDim, 0);
    }
    instruction = state == GameState::Missed ? "NEXT WAVE COMING" : "SPACE: NEXT WAVE";
  }
  if (*instruction) {
    const float y = H - m - px * 9.0f;
    const float w = textWidth(instruction, px * 1.5f);
    quad(W * 0.5f - w * 0.5f - px * 4.0f, y - px * 3.0f, W * 0.5f + w * 0.5f + px * 4.0f, y + px * 13.5f,
         withAlpha(kPanel, 0.75f));
    text(instruction, W * 0.5f, y, px * 1.5f, kHudText, 0);
  }
}

}  // namespace barrel
