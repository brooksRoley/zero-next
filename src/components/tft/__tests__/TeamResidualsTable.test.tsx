// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import TeamResidualsTable from "src/components/tft/TeamResidualsTable";

afterEach(() => cleanup());

const rows = [
  { team_id: 1, sim_wins: 41, actual_wins: 45, eps_engine: 4.2, eps_tactics: -1.1 },
  { team_id: 2, sim_wins: 50, actual_wins: 48, eps_engine: -2.0, eps_tactics: 3.5 },
];

describe("TeamResidualsTable", () => {
  it("wraps the table in a horizontally scrollable container", () => {
    const { container } = render(<TeamResidualsTable rows={rows} />);
    const wrapper = container.querySelector(".overflow-x-auto");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector("table")).not.toBeNull();
  });

  it("renders sortable columns as real, keyboard-operable buttons", () => {
    render(<TeamResidualsTable rows={rows} />);
    const button = screen.getByRole("button", { name: /Sim W/ });
    expect(button.tagName).toBe("BUTTON");
  });

  it("marks the active sort column via aria-sort and re-sorts on click", () => {
    render(<TeamResidualsTable rows={rows} />);
    // default sort key is eps_engine (descending by absolute value): team 1 (4.2) before team 2 (-2.0)
    let cells = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(cells[0]).toContain("41.0");

    fireEvent.click(screen.getByRole("button", { name: /Sim W/ }));

    const simWHeader = screen.getByRole("button", { name: /Sim W/ }).closest("th");
    expect(simWHeader?.getAttribute("aria-sort")).toBe("descending");

    // sorted by sim_wins descending now: team 2 (50) before team 1 (41)
    cells = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(cells[0]).toContain("50.0");
  });
});
