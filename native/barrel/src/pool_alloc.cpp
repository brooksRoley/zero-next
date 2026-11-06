#include "pool_alloc.hpp"

#include <cstdlib>
#include <cstring>

namespace barrel::pool {
namespace {

// 16 B .. 64 KiB in powers of two. Box2D's block allocator asks for 16 KiB
// chunks; the chain copy of ~300 vertices is 2.4 KiB.
constexpr int kMinShift = 4;
constexpr int kMaxShift = 16;
constexpr int kClasses = kMaxShift - kMinShift + 1;
constexpr size_t kHeader = 16;  // keeps the payload 16-byte aligned
constexpr size_t kArenaBytes = 8u << 20;
constexpr uint32_t kSystemTag = 0xFFFFFFFFu;

alignas(16) unsigned char gArena[kArenaBytes];
size_t gArenaUsed = 0;

struct FreeBlock {
  FreeBlock* next;
};
FreeBlock* gFree[kClasses] = {};
Stats gStats = {};

int classFor(size_t size) {
  int shift = kMinShift;
  while ((size_t(1) << shift) < size) ++shift;
  return shift - kMinShift;
}

}  // namespace

void* allocate(int32_t requested) {
  const size_t size = requested > 0 ? size_t(requested) : 1;
  const int cls = classFor(size);
  if (cls >= kClasses) {
    unsigned char* raw = static_cast<unsigned char*>(std::malloc(size + kHeader));
    if (!raw) return nullptr;
    std::memcpy(raw, &kSystemTag, sizeof kSystemTag);
    ++gStats.systemMallocs;
    ++gStats.liveBlocks;
    return raw + kHeader;
  }
  unsigned char* block;
  if (gFree[cls]) {
    block = reinterpret_cast<unsigned char*>(gFree[cls]);
    gFree[cls] = gFree[cls]->next;
    ++gStats.reuses;
  } else {
    const size_t bytes = (size_t(1) << (cls + kMinShift)) + kHeader;
    if (gArenaUsed + bytes > kArenaBytes) {
      // Arena exhausted: degrade to the system heap rather than fail.
      unsigned char* raw = static_cast<unsigned char*>(std::malloc(size + kHeader));
      if (!raw) return nullptr;
      std::memcpy(raw, &kSystemTag, sizeof kSystemTag);
      ++gStats.systemMallocs;
      ++gStats.liveBlocks;
      return raw + kHeader;
    }
    block = gArena + gArenaUsed;
    gArenaUsed += bytes;
    gStats.arenaBytesUsed = uint32_t(gArenaUsed);
    ++gStats.arenaCarves;
  }
  const uint32_t tag = uint32_t(cls);
  std::memcpy(block, &tag, sizeof tag);
  ++gStats.liveBlocks;
  return block + kHeader;
}

void release(void* mem) {
  if (!mem) return;
  unsigned char* block = static_cast<unsigned char*>(mem) - kHeader;
  uint32_t tag;
  std::memcpy(&tag, block, sizeof tag);
  --gStats.liveBlocks;
  if (tag == kSystemTag) {
    std::free(block);
    return;
  }
  FreeBlock* node = reinterpret_cast<FreeBlock*>(block);
  node->next = gFree[tag];
  gFree[tag] = node;
}

Stats stats() { return gStats; }

}  // namespace barrel::pool
