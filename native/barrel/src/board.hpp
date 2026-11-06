// BARREL — the surfboard: a dynamic b2Body plus a hand-written hydrodynamic
// force model applied before every physics step.
//
//   lift   = min(1/2 rho CL A vt^2, cap) along the surface normal (planing)
//   drag   = -(c1 + c2 |vt|) vt along the surface, x (1 + 5 bite) while carving
//   carve  = m k bite (target - wt) along the surface, wt = velocity in the
//            wave's frame: rail bite turns momentum up or down the face
//   gravity = Box2D world gravity; on a slope it becomes speed
//
// vt is velocity relative to the water (the water itself moves with the
// wave's orbital motion near the crest). Contact with the wave's chain keeps
// the board on the surface; the forces decide where on the face it sits.
#pragma once

#include "box2d/box2d.h"
#include "wave.hpp"

namespace barrel {

struct BoardInput {
  bool prone = true;       // paddling (lying down) vs standing
  float paddle = 0.0f;     // -1..1, screen x, prone only
  bool carveUp = false;    // W: rail in, turn up the face
  bool carveDown = false;  // S held: rail in, turn down the face
  bool pump = false;       // S pressed this step
  float lean = 0.0f;       // -1 back (stall) .. +1 forward (trim)
  bool crouch = false;     // Space held
};

struct SurfaceSample {
  bool hit = false;
  b2Vec2 point{0.0f, 0.0f};
  b2Vec2 normal{0.0f, 1.0f};
  float gap = 99.0f;  // distance from the board's underside to the surface
};

struct ForceReport {
  b2Vec2 lift{0.0f, 0.0f};
  b2Vec2 drag{0.0f, 0.0f};
  b2Vec2 carve{0.0f, 0.0f};
  b2Vec2 pump{0.0f, 0.0f};
  float vt = 0.0f;     // speed along the surface relative to water
  float wt = 0.0f;     // speed along the surface in the wave's frame
  float bite = 0.0f;
  float slope = 0.0f;  // sine of the face angle, signed toward travel
  bool onWater = false;
};

class SurfboardController {
 public:
  static constexpr float kHalfLength = 1.0f;
  static constexpr float kHalfThick = 0.06f;
  static constexpr float kMass = 80.0f;  // board + rider
  static constexpr float kContactGap = 0.12f;
  static constexpr float kWaterBand = 0.25f;
  static constexpr uint16_t kCategory = 0x0004;

  void init(b2World* world);
  void reset(b2Vec2 position, float angle);

  SurfaceSample sampleSurface(const WaveTerrain& wave) const;
  // Apply this step's hydrodynamic forces. Call before b2World::Step.
  void applyForces(const WaveTerrain& wave, const BoardInput& in, float dt);
  // Wiped out: the board leaves the surface and tumbles in the whitewash.
  void setWhitewash(bool on);
  void applyWhitewash(const WaveTerrain& wave, float holdLeft, float turbulence, float dt);

  b2Body* body() const { return body_; }
  const ForceReport& report() const { return report_; }
  const SurfaceSample& lastSample() const { return sample_; }
  bool airborne() const { return !report_.onWater; }
  float airTime() const { return airTime_; }
  float bite() const { return bite_; }
  float pumpCharge() const { return pumpFatigue_; }
  // Angle between the board's axis and the surface tangent (0 = flush).
  float misalignment(const SurfaceSample& s) const;
  // Touching the underside of the lip (contact normal pointing down).
  bool touchingLipUnderside(const WaveTerrain& wave) const;

 private:
  b2World* world_ = nullptr;
  b2Body* body_ = nullptr;
  b2Fixture* fixture_ = nullptr;
  ForceReport report_{};
  SurfaceSample sample_{};
  float bite_ = 0.0f;
  bool carvingPrev_ = false;
  float pumpCooldown_ = 0.0f;
  float pumpFatigue_ = 1.0f;
  float airTime_ = 0.0f;
};

// Closest hit on the wave's chain along a segment. One-sided edges mean a ray
// only hits a surface from the air side.
bool raycastWave(b2World* world, const WaveTerrain& wave, b2Vec2 from, b2Vec2 to, b2Vec2* point, b2Vec2* normal);

}  // namespace barrel
