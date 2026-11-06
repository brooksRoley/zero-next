// BARREL — WebGL2 renderer. One shader, one dynamic vertex buffer, coloured
// triangles. The water is a stencil-filled polygon (the lip overhangs, so the
// surface is not a height field). The HUD uses the 5x7 font in font.hpp.
#pragma once

#include <cstdint>
#include <vector>

#include <GLES3/gl3.h>
#include <emscripten/html5.h>

#include "game.hpp"

namespace barrel {

class Renderer {
 public:
  bool init(const char* canvasSelector);
  void shutdown();
  // dt is wall-clock time since the last frame (camera smoothing only).
  void draw(const Game& game, float dt);
  bool ok() const { return ctx_ > 0; }

 private:
  struct Vertex {
    float x, y;
    uint32_t rgba;
  };
  struct View {
    float cx, cy, halfW, halfH;
  };

  void resize();
  void updateCamera(const Game& game, float dt, bool snap);
  void begin();
  void flush(float sx, float sy, float ox, float oy);
  void flushWorld();
  void flushScreen();

  void tri(float x0, float y0, float x1, float y1, float x2, float y2, uint32_t c);
  void tri3(float x0, float y0, uint32_t c0, float x1, float y1, uint32_t c1, float x2, float y2, uint32_t c2);
  void quad(float x0, float y0, float x1, float y1, uint32_t c);  // axis-aligned
  void quadGrad(float x0, float y0, float x1, float y1, uint32_t top, uint32_t bottom);
  void line(float x0, float y0, float x1, float y1, float w, uint32_t c);
  void disc(float x, float y, float r, uint32_t c, int segments = 14);
  float text(const char* s, float x, float y, float px, uint32_t c, int align = 0);  // align -1 left 0 centre 1 right
  float textWidth(const char* s, float px) const;

  void drawSky(const Game& game);
  void drawWater(const Game& game);
  void drawSurfaceLine(const Game& game);
  void drawParticles(const Game& game);
  void drawBoardAndRider(const Game& game);
  void drawHud(const Game& game);

  float worldToScreenY(float y) const;
  float worldToScreenX(float x) const;

  EMSCRIPTEN_WEBGL_CONTEXT_HANDLE ctx_ = 0;
  const char* canvas_ = nullptr;
  GLuint program_ = 0, vao_ = 0, vbo_ = 0;
  GLint uScale_ = -1, uOffset_ = -1;
  int width_ = 0, height_ = 0;
  float pixelRatio_ = 1.0f;
  std::vector<Vertex> verts_;
  View view_{0.0f, 3.0f, 24.0f, 14.0f};
  bool cameraInit_ = false;
  float time_ = 0.0f;
};

}  // namespace barrel
