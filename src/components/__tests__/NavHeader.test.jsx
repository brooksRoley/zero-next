// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// NavHeader pulls in next/router, next/link and next/image; stub them so the
// component renders in isolation under jsdom.
vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/",
    events: { on: vi.fn(), off: vi.fn() },
  }),
}));
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  __esModule: true,
  // Drop Next-only props so jsdom doesn't warn about unknown <img> attributes.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ priority, fill, ...props }) => <img {...props} />,
}));

import NavHeader from "src/components/NavHeader";

afterEach(() => cleanup());

describe("NavHeader desktop dropdown a11y", () => {
  const trigger = (label) => screen.getByRole("button", { name: label });

  it("marks dropdown triggers as popup owners that start collapsed", () => {
    render(<NavHeader />);
    for (const label of ["Projects", "Games"]) {
      const btn = trigger(label);
      expect(btn.getAttribute("aria-haspopup")).toBe("true");
      expect(btn.getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("flips aria-expanded to true when its menu opens, and only that menu", () => {
    render(<NavHeader />);
    fireEvent.click(trigger("Projects"));
    expect(trigger("Projects").getAttribute("aria-expanded")).toBe("true");
    // Sibling dropdown stays collapsed — only one menu opens at a time.
    expect(trigger("Games").getAttribute("aria-expanded")).toBe("false");
  });

  it("collapses again when the open trigger is clicked a second time", () => {
    render(<NavHeader />);
    fireEvent.click(trigger("Games"));
    expect(trigger("Games").getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger("Games"));
    expect(trigger("Games").getAttribute("aria-expanded")).toBe("false");
  });
});
