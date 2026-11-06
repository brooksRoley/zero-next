#include "board.hpp"

#include <algorithm>
#include <cmath>

namespace barrel {
namespace {

constexpr float kG = 9.81f;
constexpr float kRhoWater = 1025.0f;
// CL * planing area, set so lift equals the rider's weight at ~10 m/s.
constexpr float kLiftArea = 0.0153f;
// CL * rail area: a fully bitten rail at 6 m/s of flow pushes ~1.3 g along the face.
constexpr float kRailArea = 0.055f;
constexpr float kPi = 3.14159265358979f;

float wrapPi(float a) {
  while (a > kPi) a -= 2.0f * kPi;
  while (a < -kPi) a += 2.0f * kPi;
  return a;
}

class WaveRay final : public b2RayCastCallback {
 public:
  explicit WaveRay(const WaveTerrain& wave) : wave_(wave) {}
  float ReportFixture(b2Fixture* fixture, const b2Vec2& point, const b2Vec2& normal, float fraction) override {
    if (!wave_.isWave(fixture)) return -1.0f;  // ignore, keep going
    hit = true;
    p = point;
    n = normal;
    return fraction;  // clip: only closer hits from here on
  }
  bool hit = false;
  b2Vec2 p{0.0f, 0.0f};
  b2Vec2 n{0.0f, 1.0f};

 private:
  const WaveTerrain& wave_;
};

}  // namespace

bool raycastWave(b2World* world, const WaveTerrain& wave, b2Vec2 from, b2Vec2 to, b2Vec2* point, b2Vec2* normal) {
  if ((to - from).LengthSquared() < 1e-8f) return false;
  WaveRay cb(wave);
  world->RayCast(&cb, from, to);
  if (!cb.hit) return false;
  if (point) *point = cb.p;
  if (normal) *normal = cb.n;
  return true;
}

void SurfboardController::init(b2World* world) {
  world_ = world;
  b2BodyDef def;
  def.type = b2_dynamicBody;
  def.bullet = true;
  def.angularDamping = 1.5f;
  body_ = world_->CreateBody(&def);
  b2PolygonShape box;
  box.SetAsBox(kHalfLength, kHalfThick);
  b2FixtureDef fd;
  fd.shape = &box;
  fd.density = kMass / (4.0f * kHalfLength * kHalfThick);
  fd.friction = 0.0f;
  fd.restitution = 0.0f;
  fd.filter.categoryBits = kCategory;
  fd.filter.maskBits = WaveTerrain::kCategory;
  fixture_ = body_->CreateFixture(&fd);
}

void SurfboardController::reset(b2Vec2 position, float angle) {
  setWhitewash(false);
  body_->SetTransform(position, angle);
  body_->SetLinearVelocity(b2Vec2(0.0f, 0.0f));
  body_->SetAngularVelocity(0.0f);
  body_->SetAwake(true);
  report_ = {};
  sample_ = {};
  bite_ = 0.0f;
  carvingPrev_ = false;
  pumpCooldown_ = 0.0f;
  pumpFatigue_ = 1.0f;
  airTime_ = 0.0f;
}

SurfaceSample SurfboardController::sampleSurface(const WaveTerrain& wave) const {
  SurfaceSample s;
  const b2Vec2 c = body_->GetWorldCenter();
  b2Vec2 p, n;
  if (raycastWave(world_, wave, c + b2Vec2(0.0f, 0.4f), c - b2Vec2(0.0f, 3.0f), &p, &n)) {
    s.hit = true;
    s.point = p;
    s.normal = n;
    s.gap = b2Dot(c - p, n) - kHalfThick;
  }
  return s;
}

float SurfboardController::misalignment(const SurfaceSample& s) const {
  const b2Vec2 axis = body_->GetWorldVector(b2Vec2(1.0f, 0.0f));
  const b2Vec2 tangent(s.normal.y, -s.normal.x);
  return std::acos(std::clamp(std::fabs(b2Dot(axis, tangent)), 0.0f, 1.0f));
}

bool SurfboardController::touchingLipUnderside(const WaveTerrain& wave) const {
  for (b2ContactEdge* ce = body_->GetContactList(); ce; ce = ce->next) {
    b2Contact* contact = ce->contact;
    if (!contact->IsTouching()) continue;
    const bool aIsWave = wave.isWave(contact->GetFixtureA());
    if (!aIsWave && !wave.isWave(contact->GetFixtureB())) continue;
    b2WorldManifold wm;
    contact->GetWorldManifold(&wm);
    const b2Vec2 waveToBoard = aIsWave ? wm.normal : -wm.normal;
    if (waveToBoard.y < -0.35f) return true;
  }
  return false;
}

void SurfboardController::applyForces(const WaveTerrain& wave, const BoardInput& in, float dt) {
  const b2Vec2 c = body_->GetWorldCenter();
  const float m = body_->GetMass();
  const float dir = wave.dir();
  sample_ = sampleSurface(wave);

  bool touching = false;
  for (b2ContactEdge* ce = body_->GetContactList(); ce; ce = ce->next)
    if (ce->contact->IsTouching()) touching = true;

  // The wave body is static and is moved by SetTransform, so Box2D's contact
  // sees a surface standing still. A contact with a moving surface allows no
  // velocity into it relative to the surface: remove that component here, so
  // the face carries the board as a moving platform would.
  if (sample_.hit && (touching || sample_.gap < kContactGap)) {
    const b2Vec2 n = sample_.normal;
    const b2Vec2 vb = body_->GetLinearVelocity();
    const float into = b2Dot(vb - wave.surfaceVelocity(), n);
    if (into < 0.0f) body_->SetLinearVelocity(vb - into * n);
  }
  const b2Vec2 v = body_->GetLinearVelocity();
  // A band rather than a contact test: planing lift lifts the board a few
  // centimetres, and the forces must not flicker on and off as it does.
  const bool onWater = sample_.hit && (sample_.gap < kWaterBand || touching);

  // Rail bite: spikes when the rail goes in, settles while held, releases fast.
  const bool carving = !in.prone && (in.carveUp || in.carveDown);
  if (carving && !carvingPrev_) bite_ = 1.0f;
  else if (carving) bite_ += (0.45f - bite_) * (1.0f - std::exp(-dt / 0.18f));
  else bite_ += (0.0f - bite_) * (1.0f - std::exp(-dt / 0.08f));
  carvingPrev_ = carving;
  pumpCooldown_ = std::max(0.0f, pumpCooldown_ - dt);
  pumpFatigue_ = std::min(1.0f, pumpFatigue_ + dt * 0.35f);

  report_ = {};
  report_.onWater = onWater;
  report_.bite = bite_;

  if (!onWater) {
    airTime_ += dt;
    // Air: light drag, and the rider can tuck the nose up or down to land.
    body_->ApplyForceToCenter(-0.4f * v.Length() * v, true);
    body_->ApplyTorque(dir * -in.lean * 140.0f - body_->GetAngularVelocity() * 20.0f, true);
    return;
  }
  airTime_ = 0.0f;

  const b2Vec2 n = sample_.normal;
  b2Vec2 tf(n.y, -n.x);  // along the surface, toward the direction of travel
  if (tf.x * dir < 0.0f) tf = -tf;
  report_.slope = -tf.y;

  const b2Vec2 vRel = v - b2Vec2(wave.orbitalAt(c.x), 0.0f);
  const float vt = b2Dot(vRel, tf);
  const b2Vec2 vWave = v - b2Vec2(dir * wave.speed(), 0.0f);
  const float wt = b2Dot(vWave, tf);
  report_.vt = vt;
  report_.wt = wt;

  // Drag. A prone paddler is a displacement hull, strongly coupled to the
  // water; a standing surfer planes once moving and the drag falls away.
  float c1, c2;
  if (in.prone) {
    c1 = 34.0f;
    c2 = 8.0f;
  } else if (std::fabs(vt) > 3.0f) {
    c1 = 5.0f;
    c2 = 1.3f;
  } else {
    c1 = 12.0f;
    c2 = 3.0f;
  }
  if (!in.prone) {
    c1 *= 1.0f + 0.9f * std::max(0.0f, -in.lean);   // lean back: stall
    c1 *= 1.0f - 0.25f * std::max(0.0f, in.lean);   // lean forward: trim
  }
  float dragMag = (c1 + c2 * std::fabs(vt)) * vt * (1.0f + 5.0f * bite_);
  const float dragCap = 0.8f * m * std::fabs(vt) / dt;  // never reverses vt in one step
  dragMag = std::clamp(dragMag, -dragCap, dragCap);
  const b2Vec2 drag = -dragMag * tf;

  // Planing lift, perpendicular to the face, quadratic in speed. It fades
  // out across the band, so the board skims rather than bouncing.
  const float immersion = std::clamp(1.0f - std::max(0.0f, sample_.gap) / kWaterBand, 0.0f, 1.0f);
  float lift = 0.5f * kRhoWater * kLiftArea * (in.prone ? 0.3f : 1.0f) * vt * vt * immersion;
  lift = std::min(lift, 1.0f * m * kG);
  const b2Vec2 liftF = lift * n;

  // Carve: the buried rail is a hydrofoil in the water rushing past. Its lift,
  // quadratic in that flow, pushes along the face: up (W) or down (S). This is
  // how a surfer climbs a face at all: the energy comes from the wave moving
  // through the water, and the induced drag (the spike above) is the price.
  b2Vec2 carveF(0.0f, 0.0f);
  if (carving) {
    const float sgn = in.carveUp ? -1.0f : 1.0f;
    const float flow = vRel.Length();
    float mag = 0.5f * kRhoWater * kRailArea * flow * flow * bite_ * immersion;
    // Already moving hard that way in the wave's frame: the rail has less to give.
    const float along = sgn * wt;
    if (along > 4.0f) mag *= std::max(0.0f, 1.0f - (along - 4.0f) / 4.0f);
    mag = std::min(mag, 2.2f * m * kG);
    carveF = (in.carveUp ? -mag : mag) * tf;  // +tf points down the face
  }

  // Pump: a timed push of the rider's weight down the face.
  b2Vec2 pumpJ(0.0f, 0.0f);
  if (!in.prone && in.pump && pumpCooldown_ <= 0.0f) {
    const float gain = (0.7f + 1.1f * std::max(0.0f, report_.slope)) * pumpFatigue_;
    pumpJ = (m * gain) * tf;
    body_->ApplyLinearImpulseToCenter(pumpJ, true);
    pumpCooldown_ = 0.28f;
    pumpFatigue_ *= 0.8f;
  }

  b2Vec2 paddle(0.0f, 0.0f);
  if (in.prone) paddle = b2Vec2(std::clamp(in.paddle, -1.0f, 1.0f) * 90.0f, 0.0f);

  body_->ApplyForceToCenter(drag + liftF + carveF + paddle, true);

  // Attitude: the board lies along the face; leaning back lifts the nose.
  const float tangentAngle = std::atan2(tf.y, tf.x);
  const float noseUp = in.prone ? 0.0f : -in.lean * 0.22f;
  const float target = tangentAngle + dir * noseUp;
  const float diff = wrapPi(target - body_->GetAngle());
  body_->ApplyTorque(1800.0f * diff - 260.0f * body_->GetAngularVelocity(), true);

  report_.lift = liftF;
  report_.drag = drag;
  report_.carve = carveF;
  report_.pump = pumpJ;
}

void SurfboardController::setWhitewash(bool on) {
  if (!fixture_) return;
  b2Filter f = fixture_->GetFilterData();
  f.maskBits = on ? 0 : WaveTerrain::kCategory;
  fixture_->SetFilterData(f);
  body_->SetAwake(true);
}

void SurfboardController::applyWhitewash(const WaveTerrain& wave, float holdLeft, float turbulence, float dt) {
  (void)dt;
  const b2Vec2 c = body_->GetWorldCenter();
  const b2Vec2 v = body_->GetLinearVelocity();
  const float m = body_->GetMass();
  const float surface = wave.baseHeightAt(c.x);
  // Held under while the foam is moving, then buoyancy brings you up.
  const float targetY = holdLeft > 0.0f ? surface - 1.4f : surface - 0.05f;
  const float foam = holdLeft > 0.0f ? wave.dir() * wave.speed() * 0.75f : 0.0f;
  b2Vec2 f;
  f.x = m * 2.2f * (foam - v.x);
  f.y = m * kG + m * (9.0f * (targetY - c.y) - 3.5f * v.y);
  body_->ApplyForceToCenter(f, true);
  body_->ApplyTorque(turbulence * m * 6.0f - body_->GetAngularVelocity() * 25.0f, true);
  report_ = {};
  airTime_ = 0.0f;
}

}  // namespace barrel
