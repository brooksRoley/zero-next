#include "game.hpp"

#include <algorithm>
#include <cmath>

namespace barrel {
namespace {

constexpr float kPi = 3.14159265358979f;
constexpr float kStandHeight = 1.65f;
constexpr float kCrouchHeight = 0.9f;
constexpr float kWindowLo = 0.45f;
constexpr float kWindowHi = 0.95f;
constexpr float kWindowSweet = 0.72f;

bool segmentsCross(b2Vec2 a, b2Vec2 b, b2Vec2 c, b2Vec2 d) {
  auto orient = [](b2Vec2 p, b2Vec2 q, b2Vec2 r) { return b2Cross(q - p, r - p); };
  const float d1 = orient(c, d, a), d2 = orient(c, d, b);
  const float d3 = orient(a, b, c), d4 = orient(a, b, d);
  return ((d1 > 0) != (d2 > 0)) && ((d3 > 0) != (d4 > 0)) && d1 != 0 && d2 != 0 && d3 != 0 && d4 != 0;
}

}  // namespace

Game::Game() : world_(b2Vec2(0.0f, -9.81f)) {
  world_.SetContinuousPhysics(true);
  wave_.init(&world_);
  board_.init(&world_);
  setConditions(SurfConditions{});
  newWave();
}

float Game::rand01() {
  rng_ ^= rng_ << 13;
  rng_ ^= rng_ >> 17;
  rng_ ^= rng_ << 5;
  return float(rng_ & 0xFFFFFF) / float(0x1000000);
}

void Game::setConditions(const SurfConditions& c) {
  conditions_ = c;
  params_ = deriveWaveParams(c);
  wave_.setTarget(params_);
}

void Game::newWave() {
  params_ = deriveWaveParams(conditions_);
  const float dir = params_.dir;
  // The board waits at x = 0; the crest arrives just as the wave starts to break.
  const float lead = params_.speed * (params_.swellTime - 1.8f);
  wave_.spawn(-dir * lead, params_);
  board_.reset(b2Vec2(0.0f, SurfboardController::kHalfThick + 0.03f), dir < 0.0f ? kPi : 0.0f);
  outcome_ = Outcome::None;
  cause_ = Cause::None;
  popStage_ = 0;
  popTimer_ = 0.0f;
  popMeter_ = 0.0f;
  inWindow_ = wasInWindow_ = false;
  lostTimer_ = 0.0f;
  popQuality_ = 0.0f;
  rideTime_ = tubeTime_ = score_ = 0.0f;
  inBarrel_ = wasAirborne_ = false;
  crouch_ = lean_ = 0.0f;
  carveUpHeld_ = carveDownHeld_ = false;
  ignoreUpUntilRelease_ = false;
  holdLeft_ = 0.0f;
  for (Particle& p : particles_) p.life = 0.0f;
  enter(GameState::Paddling);
}

void Game::enter(GameState s) {
  state_ = s;
  stateTime_ = 0.0f;
}

void Game::finish(Outcome o) {
  outcome_ = o;
  if (o == Outcome::KickOut) score_ *= 1.15f;  // a clean exit is worth more than running out of wave
  lastScore_ = std::round(score_);
  best_ = std::max(best_, lastScore_);
  ++rides_;
  enter(o == Outcome::Missed ? GameState::Missed : GameState::Done);
}

void Game::wipeout(Cause c) {
  cause_ = c;
  outcome_ = Outcome::Wipeout;
  holdLeft_ = params_.wipeoutHold;
  score_ = std::max(0.0f, std::round(score_) - params_.wipeoutPenalty);
  lastScore_ = score_;
  ++rides_;
  inBarrel_ = false;
  board_.setWhitewash(true);
  const b2Vec2 p = board_.body()->GetPosition();
  for (int i = 0; i < 40; ++i) {
    const float a = rand01() * 2.0f * kPi;
    const float s = 1.0f + rand01() * 4.0f;
    spawnParticle(p.x, p.y + 0.3f, std::cos(a) * s, std::fabs(std::sin(a)) * s, 0.6f + rand01() * 0.8f,
                  0.08f + rand01() * 0.12f, 1);
  }
  enter(GameState::Wipeout);
}

void Game::step(uint32_t keys) {
  const uint32_t pressed = keys & ~prevKeys_;
  prevKeys_ = keys;
  stateTime_ += kStep;

  switch (state_) {
    case GameState::Paddling: {
      // Paddle with the screen-direction keys.
      BoardInput in;
      in.prone = true;
      in.paddle = float((keys & kKeyRight) ? 1 : 0) - float((keys & kKeyLeft) ? 1 : 0);
      stepPaddling(pressed);
      if (state_ == GameState::Paddling) board_.applyForces(wave_, in, kStep);
      break;
    }
    case GameState::Riding: {
      if (ignoreUpUntilRelease_ && (!(keys & kKeyUp) || rideTime_ > 0.3f)) ignoreUpUntilRelease_ = false;
      carveUpHeld_ = (keys & kKeyUp) && !ignoreUpUntilRelease_;
      carveDownHeld_ = (keys & kKeyDown) != 0;
      const uint32_t fwd = wave_.dir() < 0.0f ? kKeyLeft : kKeyRight;
      const uint32_t back = wave_.dir() < 0.0f ? kKeyRight : kKeyLeft;
      const float leanTarget = float((keys & fwd) ? 1 : 0) - float((keys & back) ? 1 : 0);
      lean_ += (leanTarget - lean_) * (1.0f - std::exp(-kStep / 0.12f));
      const float crouchTarget = (keys & kKeySpace) ? 1.0f : 0.0f;
      crouch_ += (crouchTarget - crouch_) * (1.0f - std::exp(-kStep / 0.1f));
      stepRiding(pressed);
      break;
    }
    case GameState::Wipeout:
      stepWipeout();
      break;
    case GameState::Done:
      if (pressed & kKeySpace) newWave();
      break;
    case GameState::Missed:
      if ((pressed & kKeySpace) || stateTime_ > 2.5f) newWave();
      break;
  }

  // A finished wave keeps rolling under a floating board until the next one.
  if (state_ == GameState::Done || state_ == GameState::Missed) {
    BoardInput idle;
    idle.prone = true;
    if (outcome_ != Outcome::Wipeout) board_.applyForces(wave_, idle, kStep);
    else board_.applyWhitewash(wave_, 0.0f, 0.0f, kStep);
  }

  world_.Step(kStep, 8, 3);
  wave_.advance(kStep);
  updateParticles();
}

void Game::stepPaddling(uint32_t pressed) {
  const b2Body* body = board_.body();
  const b2Vec2 p = body->GetPosition();
  const float u = wave_.localU(p.x);
  const float hf = wave_.heightFraction(p.x);
  const float quarter = 1.5707963f / params_.k;
  const bool onFace = u > 0.15f && u < 1.8f * quarter;
  // Speed relative to the wave along its direction of travel: > 0 means the
  // board is keeping up, which is the feeling of the wave taking you.
  const float withWave = wave_.dir() * body->GetLinearVelocity().x - wave_.speed();
  const bool high = onFace && hf >= kWindowLo && hf <= kWindowHi;
  const bool caught = onFace && hf >= 0.15f && withWave > -1.2f;
  popMeter_ = onFace ? std::clamp(hf, 0.0f, 1.0f) : 0.0f;
  inWindow_ = high || caught;
  if (inWindow_) wasInWindow_ = true;
  lostTimer_ = (wasInWindow_ && !inWindow_) ? lostTimer_ + kStep : 0.0f;
  const bool near = u > -1.0f && u < 2.6f * quarter;

  // The lip folding over a prone paddler, or the board pushed under: over the falls.
  if (raycastWave(&world_, wave_, p + b2Vec2(0.0f, 0.05f), p + b2Vec2(0.0f, 0.45f), nullptr, nullptr) ||
      board_.touchingLipUnderside(wave_) || p.y < wave_.baseHeightAt(p.x) - 0.7f) {
    wipeout(Cause::OverTheFalls);
    return;
  }

  if (popStage_ == 1) {
    popTimer_ -= kStep;
    if (popTimer_ <= 0.0f) popStage_ = 0;
  }
  if (pressed & kKeyDown) {
    popStage_ = 1;  // hands on the rails, chest up
    popTimer_ = 0.5f;
  } else if ((pressed & kKeyUp) && popStage_ == 1) {
    popStage_ = 0;
    if (inWindow_) {
      // Best right at the crest intersection, high on the face as it takes you.
      popQuality_ = high ? std::clamp(1.0f - std::fabs(hf - kWindowSweet) / 0.4f, 0.35f, 1.0f)
                         : 0.35f + 0.3f * std::clamp(hf / kWindowLo, 0.0f, 1.0f);
      score_ = std::round(150.0f * popQuality_);
      ignoreUpUntilRelease_ = true;
      wasAirborne_ = false;
      enter(GameState::Riding);
      return;
    }
    if (near) {
      wipeout((u > 0.15f && hf < kWindowLo) ? Cause::TooEarly : Cause::OverTheFalls);
      return;
    }
  }

  if (u < -1.2f || wave_.phase() == WavePhase::Done) {
    finish(Outcome::Missed);
    return;
  }
  // It had you and you stayed down: the nose buries at the bottom.
  if (lostTimer_ > 0.7f) wipeout(Cause::Pearled);
}

void Game::stepRiding(uint32_t pressed) {
  rideTime_ += kStep;
  b2Body* body = board_.body();
  const b2Vec2 c = body->GetWorldCenter();
  const SurfaceSample s = board_.sampleSurface(wave_);
  const bool onWater = s.hit && s.gap < SurfboardController::kContactGap * 1.5f;

  // The rider stands roughly upright, leaning into the face.
  b2Vec2 riderUp = onWater ? (0.65f * b2Vec2(0.0f, 1.0f) + 0.35f * s.normal) : b2Vec2(0.0f, 1.0f);
  riderUp.Normalize();
  const float height = kStandHeight + (kCrouchHeight - kStandHeight) * crouch_;
  if (raycastWave(&world_, wave_, c + 0.1f * riderUp, c + height * riderUp, nullptr, nullptr)) {
    wipeout(Cause::Lip);
    return;
  }
  if (board_.touchingLipUnderside(wave_) || c.y < wave_.baseHeightAt(c.x) - 0.9f) {
    wipeout(Cause::Lip);
    return;
  }
  if (onWater) {
    const float mis = board_.misalignment(s);
    if (wasAirborne_ && board_.airTime() > 0.3f && mis > 0.6f) {
      wipeout(Cause::Landing);
      return;
    }
    if (mis > 1.0f) {
      wipeout(Cause::Rail);
      return;
    }
  }
  wasAirborne_ = !onWater;

  inBarrel_ = raycastWave(&world_, wave_, c + b2Vec2(0.0f, 0.1f), c + b2Vec2(0.0f, 8.0f), nullptr, nullptr);
  if (inBarrel_) tubeTime_ += kStep;

  const float u = wave_.localU(c.x);
  const float quarter = 1.5707963f / params_.k;
  const float speed = body->GetLinearVelocity().Length();
  float rate = 0.0f;
  if (u > -0.5f && u < 2.5f * quarter) rate += 10.0f;  // on the face
  if (inBarrel_) rate += 70.0f;
  rate += 3.0f * std::max(0.0f, speed - 6.0f);
  score_ += rate * kStep;

  if (u < -0.8f && c.y > wave_.baseHeightAt(c.x) - 0.3f) {
    finish(Outcome::KickOut);
    return;
  }
  if (wave_.phase() == WavePhase::Done || u > WaveTerrain::kFrontSpan - 12.0f) {
    finish(Outcome::RodeOut);
    return;
  }

  BoardInput in;
  in.prone = false;
  in.carveUp = carveUpHeld_;
  in.carveDown = carveDownHeld_ && !carveUpHeld_;
  in.pump = (pressed & kKeyDown) != 0;
  in.lean = lean_;
  in.crouch = crouch_ > 0.5f;
  board_.applyForces(wave_, in, kStep);

  // Rail spray while the rail is buried.
  const ForceReport& r = board_.report();
  if (r.onWater && r.bite > 0.3f) {
    const b2Vec2 tail = body->GetWorldPoint(b2Vec2(-0.8f, 0.0f));
    const b2Vec2 v = body->GetLinearVelocity();
    for (int i = 0; i < 2; ++i)
      spawnParticle(tail.x, tail.y + 0.05f, -0.3f * v.x + (rand01() - 0.5f) * 2.0f, 2.0f + rand01() * 3.0f * r.bite,
                    0.5f + rand01() * 0.4f, 0.05f + rand01() * 0.05f, 0);
  }
}

void Game::stepWipeout() {
  holdLeft_ -= kStep;
  turbulence_ += (rand01() - 0.5f) * 0.8f;
  turbulence_ *= 0.94f;
  board_.applyWhitewash(wave_, holdLeft_, holdLeft_ > 0.0f ? turbulence_ : 0.0f, kStep);
  if (holdLeft_ > 0.0f && rand01() < 0.6f) {
    const b2Vec2 p = board_.body()->GetPosition();
    spawnParticle(p.x + (rand01() - 0.5f) * 3.0f, wave_.baseHeightAt(p.x) + 0.1f, wave_.dir() * wave_.speed() * 0.6f,
                  rand01() * 1.5f, 0.6f + rand01() * 0.6f, 0.1f + rand01() * 0.15f, 1);
  }
  if (holdLeft_ < -1.2f) enter(GameState::Done);
}

void Game::spawnParticle(float x, float y, float vx, float vy, float life, float size, uint8_t kind) {
  Particle& p = particles_[nextParticle_];
  nextParticle_ = (nextParticle_ + 1) % kMaxParticles;
  p = Particle{x, y, vx, vy, life, life, size, kind};
}

void Game::updateParticles() {
  // Spit off the lip while it pitches.
  if (wave_.curl() > 0.3f && wave_.count() > 0) {
    const b2Vec2 tip = wave_.points()[wave_.tipIndex()];
    const float c = wave_.dir() * wave_.speed();
    for (int i = 0; i < 2; ++i)
      spawnParticle(tip.x, tip.y, c * (1.05f + 0.2f * rand01()), -1.0f - rand01() * 2.0f, 0.5f + rand01() * 0.5f,
                    0.05f + rand01() * 0.07f, 0);
  }
  for (Particle& p : particles_) {
    if (p.life <= 0.0f) continue;
    p.life -= kStep;
    p.vy -= (p.kind == 0 ? 9.81f : 2.0f) * kStep;
    p.vx *= p.kind == 0 ? 0.995f : 0.97f;
    p.x += p.vx * kStep;
    p.y += p.vy * kStep;
  }
}

bool Game::chainSelfIntersects() const {
  const b2Vec2* pts = wave_.points();
  const int n = wave_.count();
  for (int i = 0; i + 1 < n; ++i)
    for (int j = i + 2; j + 1 < n; ++j)
      if (segmentsCross(pts[i], pts[i + 1], pts[j], pts[j + 1])) return true;
  return false;
}

Snapshot Game::snapshot() const {
  Snapshot s{};
  const b2Body* body = board_.body();
  s.state = int(state_);
  s.outcome = int(outcome_);
  s.cause = int(cause_);
  s.phase = int(wave_.phase());
  s.score = std::round(score_);
  s.lastScore = lastScore_;
  s.rideTime = rideTime_;
  s.tubeTime = tubeTime_;
  s.speed = body->GetLinearVelocity().Length();
  s.popMeter = popMeter_;
  s.popQuality = popQuality_;
  s.popStage = popStage_;
  s.inWindow = inWindow_;
  s.inBarrel = inBarrel_;
  s.crouching = crouch_ > 0.5f;
  s.curl = wave_.curl();
  s.waveHeight = params_.height * wave_.heightScale();
  s.waveSpeed = wave_.speed();
  s.energy = wave_.live().energy;
  s.boardX = body->GetPosition().x;
  s.boardY = body->GetPosition().y;
  s.boardAngle = body->GetAngle();
  s.crestX = wave_.crestX();
  s.swellDistance = wave_.localU(s.boardX);
  if (wave_.count() > 0) {
    s.tubeBack = wave_.localU(wave_.points()[wave_.throatIndex()].x);
    s.tubeFront = wave_.localU(wave_.points()[wave_.tipIndex()].x);
  }
  s.rides = rides_;
  s.chainCount = wave_.count();
  s.breakType = int(conditions_.type);
  s.condHeight = conditions_.height;
  s.condPeriod = conditions_.period;
  s.condWind = conditions_.wind;
  return s;
}

}  // namespace barrel
