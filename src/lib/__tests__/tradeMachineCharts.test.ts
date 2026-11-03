import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Both Trade Machine charts lay out at the container's measured width so a
// 390px phone sees the whole chart. A fixed minimum width brings back the
// sideways scroll.
const src = readFileSync(join(process.cwd(), "src/pages/tools/trade-machine.tsx"), "utf8");

describe("trade machine charts fit a phone", () => {
  it("sets no fixed minimum width on a chart", () => {
    expect(src).not.toMatch(/min-w-\[640px\]/);
  });

  it("measures each chart's container", () => {
    expect(src.match(/new ResizeObserver/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
