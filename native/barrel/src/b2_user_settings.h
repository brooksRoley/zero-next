// Box2D v2.4.1 user settings for BARREL (compiled with -DB2_USER_SETTINGS).
// Identical to Box2D's defaults except that allocation goes through the
// BARREL pool (see pool_alloc.hpp) and logging is silenced.
#pragma once

#include <stdarg.h>
#include <stdint.h>

#include "pool_alloc.hpp"

#define b2_lengthUnitsPerMeter 1.0f
#define b2_maxPolygonVertices 8

struct B2_API b2BodyUserData {
  b2BodyUserData() { pointer = 0; }
  uintptr_t pointer;
};

struct B2_API b2FixtureUserData {
  b2FixtureUserData() { pointer = 0; }
  uintptr_t pointer;
};

struct B2_API b2JointUserData {
  b2JointUserData() { pointer = 0; }
  uintptr_t pointer;
};

inline void* b2Alloc(int32_t size) { return barrel::pool::allocate(size); }
inline void b2Free(void* mem) { barrel::pool::release(mem); }
inline void b2Log(const char*, ...) {}
