// BARREL — the game: one Box2D world, the wave, the board, and the rules.
//
//   PADDLING --(S then W in the window)--> RIDING --(over the back)--> DONE: kick out
//      |  \--(wave passes under you)--> MISSED       \--(wave backs off)----> DONE: rode it out
//      \--(pop-up out of the window)--> WIPEOUT <----(lip, rail, landing)---/
//
// Everything is advanced at a fixed 60 Hz step; the renderer only reads.
#pragma once

#include <array>
#include <cstdint>

#include "board.hpp"
#include "conditions.hpp"
#include "wave.hpp"

namespace barrel {

constexpr float kStep = 1.0f / 60.0f;

enum Key : uint32_t { kKeyLeft = 1, kKeyRight = 2, kKeyUp = 4, kKeyDown = 8, kKeySpace = 16 };

enum class GameState : int { Paddling = 0, Riding = 1, Wipeout = 2, Done = 3, Missed = 4 };
enum class Outcome : int { None = 0, KickOut = 1, RodeOut = 2, Wipeout = 3, Missed = 4 };
enum class Cause : int {
  None = 0,
  TooEarly = 1,     // stood up before the wave lifted you
  OverTheFalls = 2, // stood up too late, at the lip
  Pearled = 3,      // never stood up; the nose buried at the bottom
  Lip = 4,          // the lip landed on you
  Rail = 5,         // board knifed across the face
  Landing = 6,      // landed an air sideways
};

struct Particle {
  float x, y, vx, vy, life, maxLife, size;
  uint8_t kind;  // 0 spray, 1 foam
};

struct Snapshot {
  int state;
  int outcome;
  int cause;
  int phase;
  float score;        // points this wave (live while riding)
  float lastScore;    // final score of the last finished wave
  float rideTime;
  float tubeTime;
  float speed;        // board speed, m/s
  float popMeter;     // height on the face, 0..1 (pop-up meter)
  float popQuality;   // 0..1 for the last pop-up
  int popStage;       // 0 idle, 1 hands down (S pressed)
  bool inWindow;
  bool inBarrel;
  bool crouching;
  float curl;
  float waveHeight;
  float waveSpeed;
  float energy;
  float swellDistance; // metres from the crest to the board (paddling HUD)
  float tubeBack;      // local u of the throat (back of the tube)
  float tubeFront;     // local u of the lip tip (front of the tube)
  float boardX, boardY, boardAngle;
  float crestX;
  int rides;           // waves finished (done, wipeout or missed)
  int chainCount;
  int breakType;
  float condHeight, condPeriod, condWind;
};

class Game {
 public:
  static constexpr int kMaxParticles = 640;

  Game();
  Game(const Game&) = delete;
  Game& operator=(const Game&) = delete;

  void setConditions(const SurfConditions& c);
  const SurfConditions& conditions() const { return conditions_; }
  void newWave();
  void step(uint32_t keys);
  Snapshot snapshot() const;

  b2World& world() { return world_; }
  const WaveTerrain& wave() const { return wave_; }
  const SurfboardController& board() const { return board_; }
  GameState state() const { return state_; }
  Cause cause() const { return cause_; }
  float stateTime() const { return stateTime_; }
  float crouchAmount() const { return crouch_; }
  float leanAmount() const { return lean_; }
  bool carving() const { return carveUpHeld_ || carveDownHeld_; }
  bool inBarrel() const { return inBarrel_; }
  float popMeter() const { return popMeter_; }
  bool inWindow() const { return inWindow_; }
  int popStage() const { return popStage_; }
  float score() const { return score_; }
  float bestScore() const { return best_; }
  void setBest(float b) { best_ = b; }
  const std::array<Particle, kMaxParticles>& particles() const { return particles_; }
  float wipeoutHoldLeft() const { return holdLeft_; }

  // For tests: does the wave's chain cross itself anywhere?
  bool chainSelfIntersects() const;

 private:
  void enter(GameState s);
  void finish(Outcome o);
  void wipeout(Cause c);
  void stepPaddling(uint32_t pressed);
  void stepRiding(uint32_t pressed);
  void stepWipeout();
  void updateParticles();
  void spawnParticle(float x, float y, float vx, float vy, float life, float size, uint8_t kind);
  float rand01();

  b2World world_;
  WaveTerrain wave_;
  SurfboardController board_;
  SurfConditions conditions_{};
  WaveParams params_{};

  GameState state_ = GameState::Paddling;
  Outcome outcome_ = Outcome::None;
  Cause cause_ = Cause::None;
  float stateTime_ = 0.0f;
  uint32_t prevKeys_ = 0;
  bool ignoreUpUntilRelease_ = false;

  // Pop-up
  int popStage_ = 0;
  float popTimer_ = 0.0f;
  float popMeter_ = 0.0f;
  bool inWindow_ = false;
  bool wasInWindow_ = false;
  float lostTimer_ = 0.0f;
  float popQuality_ = 0.0f;

  // Riding
  float rideTime_ = 0.0f;
  float tubeTime_ = 0.0f;
  float score_ = 0.0f;
  float lastScore_ = 0.0f;
  float best_ = 0.0f;
  bool inBarrel_ = false;
  bool wasAirborne_ = false;
  float crouch_ = 0.0f;
  float lean_ = 0.0f;
  bool carveUpHeld_ = false;
  bool carveDownHeld_ = false;

  // Wipeout
  float holdLeft_ = 0.0f;
  float turbulence_ = 0.0f;

  int rides_ = 0;
  uint32_t rng_ = 0x9E3779B9u;
  std::array<Particle, kMaxParticles> particles_{};
  int nextParticle_ = 0;
};

}  // namespace barrel
