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

  it("marks the dropdown trigger as a popup owner that starts collapsed", () => {
    render(<NavHeader />);
    const btn = trigger("Games");
    expect(btn.getAttribute("aria-haspopup")).toBe("true");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("flips aria-expanded to true when its menu opens", () => {
    render(<NavHeader />);
    fireEvent.click(trigger("Games"));
    expect(trigger("Games").getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("nav-submenu-Games")).not.toBeNull();
  });

  it("collapses again when the open trigger is clicked a second time", () => {
    render(<NavHeader />);
    fireEvent.click(trigger("Games"));
    expect(trigger("Games").getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger("Games"));
    expect(trigger("Games").getAttribute("aria-expanded")).toBe("false");
  });
});

describe("NavHeader Basketball entry", () => {
  it("is a plain link to the hub, not a dropdown", () => {
    render(<NavHeader />);
    expect(screen.queryByRole("button", { name: "Basketball" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Projects" })).toBeNull();
    const links = screen.getAllByRole("link", { name: "Basketball" });
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/basketball"]);
  });

  it("appears once in the open mobile menu too", () => {
    render(<NavHeader />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    const menu = document.getElementById("mobile-menu");
    const hrefs = [...menu.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs.filter((h) => h === "/basketball")).toHaveLength(1);
    expect(hrefs).not.toContain("/games/hardwood");
  });
});
