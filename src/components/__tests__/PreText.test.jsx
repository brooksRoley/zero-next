// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PreText from "src/components/PreText";

// The home hero draws "Brooks Roley" on a canvas over a sizing element. That
// element was `invisible` (visibility:hidden), which removes it from the
// accessibility tree, so the home page had no heading for screen readers
// (layout audit, 2026-10-28). It must stay readable; the canvas stays silent.
afterEach(cleanup);

// jsdom has no canvas; a context whose every method is a no-op lets the draw
// effect run without a real raster.
const noop = () => noopCtx;
const noopCtx = new Proxy({}, { get: (_, k) => (k === "measureText" ? () => ({ width: 10 }) : noop), set: () => true });
HTMLCanvasElement.prototype.getContext = () => noopCtx;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

describe("PreText", () => {
  it("exposes its text as a real heading, not a hidden one", () => {
    render(<PreText text="Brooks Roley" tag="h1" />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Brooks Roley" });
    expect(h1.className).not.toMatch(/\binvisible\b/);
    expect(h1.getAttribute("aria-hidden")).toBeNull();
  });

  it("keeps the decorative canvas out of the accessibility tree", () => {
    const { container } = render(<PreText text="Brooks Roley" tag="h1" />);
    expect(container.querySelector("canvas").getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });
});
