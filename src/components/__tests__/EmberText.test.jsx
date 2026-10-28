// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import EmberText from "src/components/EmberText";

// The home hero and the Theater marquee draw their words as Ember dots. The
// words themselves must stay a real, readable heading; the canvas stays silent.
afterEach(cleanup);

const noop = () => noopCtx;
const noopCtx = new Proxy({}, { get: (_, k) => (k === "measureText" ? () => ({ width: 10 }) : noop), set: () => true });
HTMLCanvasElement.prototype.getContext = () => noopCtx;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };

describe("EmberText", () => {
  it("renders the words as a real heading", () => {
    render(<EmberText text="Brooks Roley" id="home-hero-title" seed={1} />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Brooks Roley" });
    expect(h1.id).toBe("home-hero-title");
    expect(h1.getAttribute("aria-hidden")).toBeNull();
  });

  it("joins accent parts into one accessible name", () => {
    render(<EmberText text={[{ text: "The Zero " }, { text: "Theater", accent: true }]} accentClassName="text-brass-400" seed={1} />);
    const h1 = screen.getByRole("heading", { level: 1, name: "The Zero Theater" });
    expect(h1.querySelector(".text-brass-400").textContent).toBe("Theater");
  });

  it("keeps the canvas out of the accessibility tree", () => {
    const { container } = render(<EmberText text="Brooks Roley" seed={1} />);
    expect(container.querySelector("canvas").getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });
});
