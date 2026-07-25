// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import CoefficientsTable from "src/components/tft/CoefficientsTable";

afterEach(() => cleanup());

describe("CoefficientsTable", () => {
  it("wraps the table in a horizontally scrollable container", () => {
    const { container } = render(
      <CoefficientsTable coeffs={{ engine: { pace: 1.2345, drift: -0.5 } }} />
    );
    const wrapper = container.querySelector(".overflow-x-auto");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector("table")).not.toBeNull();
  });

  it("flattens nested group/coefficient objects into rows", () => {
    render(<CoefficientsTable coeffs={{ engine: { pace: 1.2345 }, tactics: { spacing: 2 } }} />);
    expect(screen.getByText("engine")).toBeDefined();
    expect(screen.getByText("pace")).toBeDefined();
    expect(screen.getByText("1.2345")).toBeDefined();
    expect(screen.getByText("tactics")).toBeDefined();
  });

  it("renders non-numeric values as-is", () => {
    render(<CoefficientsTable coeffs={{ meta: { note: "n/a" } }} />);
    expect(screen.getByText("n/a")).toBeDefined();
  });
});
