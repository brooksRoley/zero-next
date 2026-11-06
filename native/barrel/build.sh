#!/usr/bin/env bash
# BARREL — build the WASM module into public/barrel/.
#
#   native/barrel/build.sh          native tests, then the WASM build
#   native/barrel/build.sh --wasm   WASM build only
#
# Needs emcc (Emscripten 3.1+; built with 5.0.2) and a C++20 clang++. Box2D
# v2.4.1 is fetched once into .deps/ at a pinned commit and compiled from
# source; nothing is downloaded at runtime.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DEPS="$HERE/.deps"
BUILD="$HERE/.build"
OUT="$ROOT/public/barrel"
BOX2D_TAG="v2.4.1"
BOX2D_COMMIT="9ebbbcd960ad424e03e5de6e66a40764c16f51bc"

mkdir -p "$DEPS" "$BUILD" "$OUT"

if [ ! -d "$DEPS/box2d" ]; then
  git clone --quiet --depth 1 --branch "$BOX2D_TAG" https://github.com/erincatto/box2d.git "$DEPS/box2d"
fi
GOT="$(git -C "$DEPS/box2d" rev-parse HEAD)"
if [ "$GOT" != "$BOX2D_COMMIT" ]; then
  echo "box2d at $GOT, expected $BOX2D_COMMIT" >&2
  exit 1
fi

B2_SRC=$(find "$DEPS/box2d/src" -name '*.cpp' -not -path '*/rope/*' | sort)
GAME_SRC="$HERE/src/pool_alloc.cpp $HERE/src/conditions.cpp $HERE/src/wave.cpp $HERE/src/board.cpp $HERE/src/game.cpp"
FLAGS="-std=c++20 -O2 -DB2_USER_SETTINGS -I$HERE/src -I$DEPS/box2d/include -I$DEPS/box2d/src"

if [ "${1:-}" != "--wasm" ]; then
  echo "== native tests"
  mkdir -p "$BUILD/native/b2"
  for f in $B2_SRC; do
    o="$BUILD/native/b2/$(basename "$f" .cpp).o"
    [ "$o" -nt "$f" ] || clang++ $FLAGS -c "$f" -o "$o"
  done
  # shellcheck disable=SC2086
  clang++ $FLAGS $GAME_SRC "$HERE/test/native_test.cpp" "$BUILD"/native/b2/*.o -o "$BUILD/native_test"
  "$BUILD/native_test"
fi

echo "== wasm"
# shellcheck disable=SC2086
emcc $FLAGS -O3 $B2_SRC $GAME_SRC "$HERE/src/render.cpp" "$HERE/src/main.cpp" \
  -lembind \
  -sMODULARIZE=1 -sEXPORT_NAME=createBarrelModule -sEXPORT_ES6=0 \
  -sENVIRONMENT=web,node \
  -sMIN_WEBGL_VERSION=2 -sMAX_WEBGL_VERSION=2 \
  -sINITIAL_MEMORY=33554432 -sALLOW_MEMORY_GROWTH=0 -sSTACK_SIZE=1048576 \
  -sFILESYSTEM=0 -sASSERTIONS=0 \
  -o "$OUT/barrel.js"

HASH="$(node "$HERE/sourceHash.mjs")"
cat > "$ROOT/src/lib/barrel/buildInfo.ts" <<TS
// Written by native/barrel/build.sh. Do not edit by hand.
// sourceHash covers native/barrel/src and build.sh (native/barrel/sourceHash.mjs).
export const BARREL_BUILD = {
  sourceHash: '$HASH',
  box2d: '$BOX2D_TAG ($BOX2D_COMMIT)',
  emcc: '$(emcc --version | head -1 | sed "s/'/ /g")',
} as const
TS
rm -f "$OUT/BUILD.json"
ls -l "$OUT"
