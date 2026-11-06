// BARREL — fixed arena + size-class free lists behind Box2D's b2Alloc/b2Free.
//
// The wave's b2ChainShape is destroyed and recreated every physics step. Box2D
// copies chain vertices with b2Alloc on every CreateFixture and frees them on
// DestroyFixture, so without this hook the game would hit dlmalloc ~120 times a
// second. Here a freed block goes back on its size class's list and the next
// rebuild takes it straight back: after warm-up the system heap is not touched.
#pragma once
#include <cstddef>
#include <cstdint>

namespace barrel::pool {

struct Stats {
  uint32_t arenaBytesUsed;  // bytes carved from the arena (high-water mark)
  uint32_t arenaCarves;     // blocks carved fresh from the arena
  uint32_t reuses;          // allocations served from a free list
  uint32_t systemMallocs;   // oversize requests that fell through to malloc
  uint32_t liveBlocks;      // currently allocated blocks
};

void* allocate(int32_t size);
void release(void* mem);
Stats stats();

}  // namespace barrel::pool
