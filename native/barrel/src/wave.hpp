// BARREL — the wave: a Gerstner (trochoidal) profile with a folding lip, rebuilt
// into a Box2D b2ChainShape every physics step.
//
// Local frame: origin at the crest's rest position, +a toward the direction of
// travel (the front face), y up from still water. World x = crestX + dir * X.
//
// Base profile (rest parameter a, phase theta = k a, envelope e):
//   X = a - (Q / k) e sin(theta)          (points bunch at the crest: sharp)
//   Y = A e cos(theta)                    (troughs flatten out: flat)
// Fold, for points above foldStart of the height (s in 0..1, exponential f):
//   f(s) = (exp(beta s) - 1) / (exp(beta) - 1)
//   front: X += curl L f(s);  Y -= curl D f(s)
//   back:  X += curl L backShare f(s)
// Pushing the top forward faster than the face beneath it folds the lip over
// the face: the chain doubles back on itself and leaves a tube of air.
#pragma once

#include <array>

#include "box2d/box2d.h"
#include "conditions.hpp"

namespace barrel {

enum class WavePhase : int { Swell = 0, Breaking = 1, Shoulder = 2, Done = 3 };

class WaveTerrain {
 public:
  static constexpr int kSamples = 301;  // odd: sample 150 is the crest
  static constexpr int kCrest = kSamples / 2;
  static constexpr float kBackSpan = 70.0f;
  static constexpr float kFrontSpan = 110.0f;
  static constexpr float kMinSpacing = 0.03f;  // > b2_linearSlop
  static constexpr uint16_t kCategory = 0x0002;

  void init(b2World* world);
  // Start a new wave with its crest at worldX.
  void spawn(float crestWorldX, const WaveParams& params);
  // New conditions mid-wave: the live shape eases toward them.
  void setTarget(const WaveParams& params);
  // Advance the timeline and rebuild the chain fixture. Call after b2World::Step.
  void advance(float dt);

  float crestX() const { return body_ ? body_->GetPosition().x : 0.0f; }
  float dir() const { return live_.dir; }
  float speed() const { return speedNow_; }
  // Velocity of the moving surface (the static body is moved by SetTransform).
  b2Vec2 surfaceVelocity() const { return b2Vec2(live_.dir * speedNow_, 0.0f); }
  float localU(float worldX) const { return live_.dir * (worldX - crestX()); }
  float amplitudeNow() const { return live_.amplitude * heightScale_; }
  float heightScale() const { return heightScale_; }
  float curl() const { return curl_; }
  WavePhase phase() const { return phase_; }
  float phaseTime() const { return phaseTime_; }
  float totalTime() const { return totalTime_; }
  const WaveParams& live() const { return live_; }
  const WaveParams& target() const { return target_; }

  // Unfolded surface height (with chop) at a world x. Used for prone/whitewash
  // buoyancy and the pop-up meter, where the lip must not count.
  float baseHeightAt(float worldX) const;
  // Fraction of the current crest height at worldX (0 flat water, 1 crest).
  float heightFraction(float worldX) const;
  // Horizontal orbital velocity of surface water at worldX.
  float orbitalAt(float worldX) const;
  // Background chop at a world position.
  float chopAt(float worldX) const;

  // World-space chain, in chain order (water on the right of travel, so the
  // one-sided edge normals point out of the water).
  const b2Vec2* points() const { return chain_.data(); }
  int count() const { return chainCount_; }
  int tipIndex() const { return tipChain_; }      // lip tip, chain index
  int throatIndex() const { return throatChain_; } // back of the tube, chain index
  int lipRootIndex() const { return lipRootChain_; }

  b2Body* body() const { return body_; }
  b2Fixture* fixture() const { return fixture_; }
  bool isWave(const b2Fixture* f) const { return f && f->GetBody() == body_; }
  int rebuilds() const { return rebuilds_; }

 private:
  void updateTimeline(float dt);
  void evaluateLocal();
  void rebuildFixture();
  void removeLocalLoops();
  bool cutLoopsOnce();
  bool respaceOnce();
  float baseX(float a, float amp) const;
  float baseY(float a, float amp) const;

  b2World* world_ = nullptr;
  b2Body* body_ = nullptr;
  b2Fixture* fixture_ = nullptr;
  b2ChainShape shape_;

  WaveParams live_{};
  WaveParams target_{};
  WavePhase phase_ = WavePhase::Swell;
  float phaseTime_ = 0.0f;
  float totalTime_ = 0.0f;
  float heightScale_ = 0.45f;
  float curl_ = 0.0f;
  float hang_ = 0.0f;  // how far the lip tip hangs down (0..1)
  float speedNow_ = 0.0f;
  int rebuilds_ = 0;

  // Pools, sized once. Nothing in the per-step path allocates.
  std::array<float, kSamples> rest_{};   // rest parameter a per sample
  std::array<float, kSamples> localX_{};
  std::array<float, kSamples> localY_{};
  std::array<float, kSamples> foldS_{};   // fold progress s per sample
  std::array<b2Vec2, kSamples> chain_{};
  std::array<b2Vec2, kSamples> fixtureLocal_{};
  int chainCount_ = 0;
  int tipChain_ = 0;
  int throatChain_ = 0;
  int lipRootChain_ = 0;
};

}  // namespace barrel
