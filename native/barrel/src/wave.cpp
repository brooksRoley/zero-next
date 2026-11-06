#include "wave.hpp"

#include <algorithm>
#include <cmath>

namespace barrel {
namespace {

constexpr float kPi = 3.14159265358979f;
constexpr float kSigmaBack = 2.4f;   // envelope width behind the crest (radians of phase)
constexpr float kSigmaFront = 1.7f;  // narrower in front: a steeper face
constexpr float kSuckCentre = 1.9f;  // phase where the trough sucks lowest
constexpr float kSuckWidth = 0.8f;
constexpr float kBlendSeconds = 0.8f;

float smooth01(float x) {
  x = std::clamp(x, 0.0f, 1.0f);
  return x * x * (3.0f - 2.0f * x);
}

float lerp(float a, float b, float t) { return a + (b - a) * t; }

void blendParams(WaveParams& live, const WaveParams& target, float t) {
  live.height = lerp(live.height, target.height, t);
  live.amplitude = lerp(live.amplitude, target.amplitude, t);
  live.steepness = lerp(live.steepness, target.steepness, t);
  live.k = lerp(live.k, target.k, t);
  live.speed = lerp(live.speed, target.speed, t);
  live.speedWobble = lerp(live.speedWobble, target.speedWobble, t);
  live.wobblePeriod = lerp(live.wobblePeriod, target.wobblePeriod, t);
  live.lipReach = lerp(live.lipReach, target.lipReach, t);
  live.lipDroop = lerp(live.lipDroop, target.lipDroop, t);
  live.lipExp = lerp(live.lipExp, target.lipExp, t);
  live.foldStart = lerp(live.foldStart, target.foldStart, t);
  live.backShare = lerp(live.backShare, target.backShare, t);
  live.suck = lerp(live.suck, target.suck, t);
  live.chop = lerp(live.chop, target.chop, t);
  live.curlRate = lerp(live.curlRate, target.curlRate, t);
  live.energy = lerp(live.energy, target.energy, t);
  // Timeline lengths and penalties switch at once: they are rules, not shape.
  live.swellTime = target.swellTime;
  live.breakTime = target.breakTime;
  live.shoulderTime = target.shoulderTime;
  live.wipeoutHold = target.wipeoutHold;
  live.wipeoutPenalty = target.wipeoutPenalty;
  live.dir = target.dir;
}

}  // namespace

void WaveTerrain::init(b2World* world) {
  world_ = world;
  for (int i = 0; i < kSamples; ++i) {
    const float u = -1.0f + 2.0f * float(i) / float(kSamples - 1);
    const float span = u < 0.0f ? kBackSpan : kFrontSpan;
    // Dense near the crest, where the lip needs resolution; sparse on the flats.
    rest_[i] = std::copysign(std::pow(std::fabs(u), 2.2f), u) * span;
  }
  rest_[kCrest] = 0.0f;
  b2BodyDef def;
  // Static, as the brief asks: the wave is terrain. It moves by SetTransform
  // each step, and the board controller supplies what a kinematic body's
  // contact would have (the face carrying the board; see board.cpp).
  def.type = b2_staticBody;
  body_ = world_->CreateBody(&def);
}

void WaveTerrain::spawn(float crestWorldX, const WaveParams& params) {
  live_ = params;
  target_ = params;
  phase_ = WavePhase::Swell;
  phaseTime_ = 0.0f;
  totalTime_ = 0.0f;
  heightScale_ = 0.45f;
  curl_ = 0.0f;
  hang_ = 0.0f;
  speedNow_ = params.speed;
  if (fixture_) {
    body_->DestroyFixture(fixture_);
    fixture_ = nullptr;
  }
  body_->SetTransform(b2Vec2(crestWorldX, 0.0f), 0.0f);
  evaluateLocal();
  rebuildFixture();
}

void WaveTerrain::setTarget(const WaveParams& params) { target_ = params; }

void WaveTerrain::advance(float dt) {
  // Drop last step's fixture before moving the body: SetTransform on a body
  // with a 270-edge chain would re-buffer every edge in the broad-phase only
  // for rebuildFixture() to destroy them, doubling its move and pair buffers.
  if (fixture_) {
    body_->DestroyFixture(fixture_);
    fixture_ = nullptr;
  }
  // Travel at the speed that held through this step, then pick the next one.
  body_->SetTransform(body_->GetPosition() + b2Vec2(live_.dir * speedNow_ * dt, 0.0f), 0.0f);
  blendParams(live_, target_, 1.0f - std::exp(-dt / kBlendSeconds));
  updateTimeline(dt);
  const float wobble = live_.speedWobble * std::sin(2.0f * kPi * totalTime_ / std::max(1.0f, live_.wobblePeriod));
  speedNow_ = live_.speed * (1.0f + wobble);
  evaluateLocal();
  rebuildFixture();
}

void WaveTerrain::updateTimeline(float dt) {
  phaseTime_ += dt;
  totalTime_ += dt;
  switch (phase_) {
    case WavePhase::Swell:
      heightScale_ = 0.45f + 0.55f * smooth01(phaseTime_ / live_.swellTime);
      curl_ = 0.0f;
      hang_ = 0.0f;
      if (phaseTime_ >= live_.swellTime) {
        phase_ = WavePhase::Breaking;
        phaseTime_ = 0.0f;
      }
      break;
    case WavePhase::Breaking:
      heightScale_ = 1.0f;
      curl_ = smooth01(phaseTime_ * live_.curlRate);
      // The lip throws out first and falls after: the tip arcs over the pocket.
      hang_ = curl_ * curl_;
      if (phaseTime_ >= live_.breakTime) {
        phase_ = WavePhase::Shoulder;
        phaseTime_ = 0.0f;
      }
      break;
    case WavePhase::Shoulder: {
      const float s = phaseTime_ / live_.shoulderTime;
      heightScale_ = 1.0f - 0.55f * smooth01(s);
      curl_ = 1.0f - smooth01(s * 1.6f);
      // Backing off, the curtain lifts first (the barrel opens and spits you
      // out), then the throw retracts high above the face.
      hang_ = curl_ * (1.0f - smooth01(phaseTime_ / 0.7f));
      if (phaseTime_ >= live_.shoulderTime) {
        phase_ = WavePhase::Done;
        phaseTime_ = 0.0f;
      }
      break;
    }
    case WavePhase::Done:
      heightScale_ = 0.45f;
      curl_ = 0.0f;
      hang_ = 0.0f;
      break;
  }
}

float WaveTerrain::baseX(float a, float amp) const {
  const float theta = live_.k * a;
  const float sigma = a < 0.0f ? kSigmaBack : kSigmaFront;
  const float e = std::exp(-(theta / sigma) * (theta / sigma));
  return a - amp * e * std::sin(theta);
}

float WaveTerrain::baseY(float a, float amp) const {
  const float theta = live_.k * a;
  const float sigma = a < 0.0f ? kSigmaBack : kSigmaFront;
  const float e = std::exp(-(theta / sigma) * (theta / sigma));
  float y = amp * e * std::cos(theta);
  if (a > 0.0f && live_.suck > 0.0f) {
    const float d = (theta - kSuckCentre) / kSuckWidth;
    y -= live_.suck * heightScale_ * std::exp(-d * d);
  }
  return y;
}

void WaveTerrain::evaluateLocal() {
  const float amp = amplitudeNow();
  const float quarterWave = 1.5707963f / live_.k;
  // Small waves crumble rather than barrel: less throw, far less hang.
  const float size = smooth01((live_.height - 1.0f) / 2.0f);
  const float reach = live_.lipReach * quarterWave * heightScale_ * curl_ * (0.55f + 0.45f * size);
  const float droop = live_.lipDroop * amp * hang_ * (0.25f + 0.75f * size);
  const float beta = live_.lipExp;
  const float norm = 1.0f / (std::exp(beta) - 1.0f);
  const float foldStart = live_.foldStart;
  const bool folding = curl_ > 0.0f && amp > 1e-3f;

  // 1. Base trochoid, plus the exponential fold on the front (the lip's
  //    underside and the face beneath it).
  for (int i = 0; i < kSamples; ++i) {
    const float a = rest_[i];
    float X = baseX(a, amp);
    float Y = baseY(a, amp);
    float s = 0.0f;
    if (folding) {
      const float theta = live_.k * a;
      const float sigma = a < 0.0f ? kSigmaBack : kSigmaFront;
      const float e = std::exp(-(theta / sigma) * (theta / sigma));
      const float hf = e * std::cos(theta);  // height fraction, unfolded
      s = std::clamp((hf - foldStart) / (1.0f - foldStart), 0.0f, 1.0f);
      if (s > 0.0f) {
        const float f = (std::exp(beta * s) - 1.0f) * norm;
        if (a >= 0.0f) {
          X += reach * f;
          // The hang is concentrated at the tip (f^2.5): the lip closes down
          // in front while the tube's ceiling stays high.
          Y -= droop * f * f * std::sqrt(f);
        } else {
          X += reach * live_.backShare * f;
        }
      }
    }
    foldS_[i] = s;
    localX_[i] = X;
    localY_[i] = Y;
  }
  if (!folding) return;

  // 2. The top of the lip is its underside offset toward the water side. An
  //    offset to the convex side of a curl cannot cross the curve it follows,
  //    so the chain stays simple however far the lip throws.
  int throat = kCrest;
  for (int i = kCrest + 1; i < kSamples && foldS_[i] > 0.0f; ++i)
    if (localX_[i] < localX_[throat]) throat = i;
  if (throat == kCrest) return;  // nothing overhangs yet
  const float sThroat = foldS_[throat];
  // A lip that has only just started to overhang is thin: thickness never
  // exceeds a fraction of how far the tip has thrown past the throat.
  const float overhang = localX_[kCrest] - localX_[throat];
  const float rootThick = std::min(0.12f + 0.45f * amp * live_.backShare, 0.3f * overhang);
  const float tipThick = std::min(0.05f, 0.5f * rootThick);
  int j = kCrest;
  for (int i = kCrest - 1; i >= 0; --i) {
    const float sb = foldS_[i];
    if (sb <= 0.0f) break;
    const float sf = sThroat + (1.0f - sThroat) * sb;
    while (j + 1 < throat && foldS_[j + 1] > sf) ++j;
    const int k = std::min(j + 1, throat);
    const float span = foldS_[j] - foldS_[k];
    const float t = span > 1e-6f ? std::clamp((foldS_[j] - sf) / span, 0.0f, 1.0f) : 0.0f;
    const float px = lerp(localX_[j], localX_[k], t);
    const float py = lerp(localY_[j], localY_[k], t);
    float tx = localX_[k] - localX_[j];
    float ty = localY_[k] - localY_[j];
    const float len = std::sqrt(tx * tx + ty * ty);
    if (len < 1e-6f) {
      tx = -1.0f;
      ty = 0.0f;
    } else {
      tx /= len;
      ty /= len;
    }
    // Walking from the tip toward the throat, the water is on the right.
    const float thick = tipThick + (rootThick - tipThick) * std::pow(1.0f - sb, 1.5f);
    const float targetX = px + ty * thick;
    const float targetY = py - tx * thick;
    const float w = smooth01(sb / 0.7f);
    localX_[i] = lerp(localX_[i], targetX, w);
    localY_[i] = lerp(localY_[i], targetY, w);
  }
}

void WaveTerrain::rebuildFixture() {
  const float cx = crestX();
  const float dir = live_.dir;

  // Throat: the rearmost point of the folded front (back wall of the tube).
  int throat = kCrest;
  for (int i = kCrest + 1; i < kSamples && localY_[i] > -live_.suck; ++i) {
    if (localX_[i] < localX_[throat]) throat = i;
    if (rest_[i] * live_.k > 3.0f) break;
  }
  // Lip root: last back sample still behind the throat. No tube, no root.
  int root = -1;
  if (throat != kCrest) {
    root = kCrest - 1;
    while (root > 0 && localX_[root] > localX_[throat]) --root;
  }

  // Water on the right of travel: chain runs against world +x.
  int lastSample = -1;
  chainCount_ = 0;
  tipChain_ = throatChain_ = lipRootChain_ = 0;
  for (int j = 0; j < kSamples; ++j) {
    const int i = dir > 0.0f ? (kSamples - 1 - j) : j;
    const float wx = cx + dir * localX_[i];
    const b2Vec2 p(wx, localY_[i] + chopAt(wx));
    const bool keep = (i == kCrest || i == throat || i == root || j == kSamples - 1);
    if (chainCount_ > 0) {
      const b2Vec2 d = p - chain_[chainCount_ - 1];
      if (d.LengthSquared() < kMinSpacing * kMinSpacing) {
        if (!keep) continue;
        // A feature vertex replaces a too-close neighbour, unless that one is
        // also a feature, in which case the second is dropped.
        const bool prevIsFeature = (lastSample == kCrest || lastSample == throat || lastSample == root);
        if (chainCount_ == 1 || (prevIsFeature && i != kCrest)) continue;
        --chainCount_;
      }
    }
    chain_[chainCount_] = p;
    if (i == kCrest) tipChain_ = chainCount_;
    if (i == throat) throatChain_ = chainCount_;
    if (i == root) lipRootChain_ = chainCount_;
    lastSample = i;
    ++chainCount_;
  }

  removeLocalLoops();

  for (int j = 0; j < chainCount_; ++j) fixtureLocal_[j] = chain_[j] - b2Vec2(cx, 0.0f);
  const b2Vec2 prev = 2.0f * fixtureLocal_[0] - fixtureLocal_[1];
  const b2Vec2 next = 2.0f * fixtureLocal_[chainCount_ - 1] - fixtureLocal_[chainCount_ - 2];

  if (fixture_) {
    body_->DestroyFixture(fixture_);
    fixture_ = nullptr;
  }
  shape_.Clear();
  shape_.CreateChain(fixtureLocal_.data(), chainCount_, prev, next);
  b2FixtureDef fd;
  fd.shape = &shape_;
  fd.friction = 0.0f;  // water has no grip along the face; only the normal pushes
  fd.restitution = 0.0f;
  fd.filter.categoryBits = kCategory;
  fixture_ = body_->CreateFixture(&fd);
  shape_.Clear();
  ++rebuilds_;
}

// Where the lip is barely formed (onset, or backing off in the shoulder) the
// tip can kink across itself at centimetre scale. Cut any such loop out at the
// crossing point so Box2D always gets a simple chain.
void WaveTerrain::removeLocalLoops() {
  // Cutting a loop and re-spacing can each expose a crossing the other pass
  // must see, so alternate until neither changes the chain.
  for (int pass = 0; pass < 6; ++pass) {
    const bool cut = cutLoopsOnce();
    const bool dropped = respaceOnce();
    if (!cut && !dropped) break;
  }
}

bool WaveTerrain::cutLoopsOnce() {
  constexpr int kWindow = 32;
  bool changed = false;
  auto orient = [](b2Vec2 p, b2Vec2 q, b2Vec2 r) { return b2Cross(q - p, r - p); };
  for (int i = 0; i + 3 < chainCount_; ++i) {
    for (int j = i + 2; j + 1 < chainCount_ && j <= i + kWindow; ++j) {
      const b2Vec2 a = chain_[i], b = chain_[i + 1], c = chain_[j], d = chain_[j + 1];
      const float d1 = orient(c, d, a), d2 = orient(c, d, b);
      const float d3 = orient(a, b, c), d4 = orient(a, b, d);
      if (((d1 > 0) == (d2 > 0)) || ((d3 > 0) == (d4 > 0))) continue;
      const float t = d1 / (d1 - d2);
      const b2Vec2 x = a + t * (b - a);
      // Replace vertices i+1..j with the crossing point (or drop it if it
      // would sit too close to a neighbour).
      const bool keepX = (x - a).LengthSquared() > kMinSpacing * kMinSpacing &&
                         (d - x).LengthSquared() > kMinSpacing * kMinSpacing;
      int write = i + 1;
      if (keepX) chain_[write++] = x;
      const int removed = (j + 1) - write;
      for (int r = j + 1; r < chainCount_; ++r) chain_[r - removed] = chain_[r];
      chainCount_ -= removed;
      auto fix = [&](int& idx) {
        if (idx > j) idx -= removed;
        else if (idx > i) idx = i + 1 < chainCount_ ? i + 1 : i;
      };
      fix(tipChain_);
      fix(throatChain_);
      fix(lipRootChain_);
      changed = true;
      j = i + 1;  // re-scan from the same segment
    }
  }
  return changed;
}

// Re-establish spacing after any cut (Box2D asserts on near-duplicates).
bool WaveTerrain::respaceOnce() {
  const int before = chainCount_;
  int write = 1;
  int tip = 0, throat = 0, root = 0;
  for (int r = 1; r < chainCount_; ++r) {
    const bool last = r == chainCount_ - 1;
    if ((chain_[r] - chain_[write - 1]).LengthSquared() > kMinSpacing * kMinSpacing) {
      chain_[write++] = chain_[r];
    } else if (last && write > 1) {
      chain_[write - 1] = chain_[r];
    }
    if (r == tipChain_) tip = write - 1;
    if (r == throatChain_) throat = write - 1;
    if (r == lipRootChain_) root = write - 1;
  }
  chainCount_ = write;
  tipChain_ = tip;
  throatChain_ = throat;
  lipRootChain_ = root;
  return chainCount_ != before;
}

float WaveTerrain::chopAt(float worldX) const {
  const float t = totalTime_;
  return live_.chop * (0.6f * std::sin(0.9f * worldX - 1.7f * t) + 0.4f * std::sin(1.73f * worldX + 2.1f * t));
}

namespace {
// Solve baseX(a) = u for a by bisection; baseX is monotonic in a (dX/da >= 1 - Q > 0).
template <typename F>
float solveRest(F&& xOf, float u) {
  float lo = -WaveTerrain::kBackSpan, hi = WaveTerrain::kFrontSpan;
  for (int it = 0; it < 28; ++it) {
    const float mid = 0.5f * (lo + hi);
    if (xOf(mid) < u) lo = mid;
    else hi = mid;
  }
  return 0.5f * (lo + hi);
}
}  // namespace

float WaveTerrain::baseHeightAt(float worldX) const {
  const float u = localU(worldX);
  if (u <= -kBackSpan || u >= kFrontSpan) return chopAt(worldX);
  const float amp = amplitudeNow();
  const float a = solveRest([&](float r) { return baseX(r, amp); }, u);
  return baseY(a, amp) + chopAt(worldX);
}

float WaveTerrain::heightFraction(float worldX) const {
  const float u = localU(worldX);
  if (u <= -kBackSpan || u >= kFrontSpan) return 0.0f;
  const float amp = amplitudeNow();
  const float a = solveRest([&](float r) { return baseX(r, amp); }, u);
  const float theta = live_.k * a;
  const float sigma = a < 0.0f ? kSigmaBack : kSigmaFront;
  const float e = std::exp(-(theta / sigma) * (theta / sigma));
  return e * std::cos(theta);
}

float WaveTerrain::orbitalAt(float worldX) const {
  return live_.dir * speedNow_ * 0.3f * std::clamp(heightFraction(worldX), 0.0f, 1.0f);
}

}  // namespace barrel
