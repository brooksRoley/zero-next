// @vitest-environment jsdom
/**
 * Component coverage for League Lens — 548 lines of explorer view code that
 * shipped with none.
 *
 * The pure math it renders is covered in src/lib/nba/tests/analysis.test.ts;
 * this suite covers the layer between that math and the screen: the fetch
 * lifecycle, the pool filters that decide who is even eligible to be plotted,
 * the interaction paths (select a mark → comps, toggle table, switch views),
 * and the degenerate-data cases where a chart must decline to draw rather
 * than render something misleading.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import LeagueLens from "src/components/nba/LeagueLens";

type P = Record<string, unknown>;

const CURRENT = "2025-26";
const PRIOR = "2024-25";

/** A rotation player row; overrides win. */
function player(id: number, name: string, over: P = {}): P {
  return {
    id, name, pos: "G", age: 27, season: CURRENT, team: "LAL",
    gp: 60, mpg: 30, ppg: 20, rpg: 5, apg: 5, spg: 1, bpg: 0.5, topg: 2,
    fga: 15, fg3a: 5, fta: 4, fg_pct: 0.45, fg3_pct: 0.35, ft_pct: 0.8,
    salary: 20_000_000,
    ...over,
  };
}

// Eight distinct current-season players — enough to clear the pool.length >= 6
// gate that similarity comps require, with real spread so z-scores are defined.
const CURRENT_PLAYERS: P[] = [
  player(1, "LeBron James", { ppg: 24.8, fga: 18.6, pos: "F", age: 41, rpg: 7.1, apg: 8.3 }),
  player(2, "Anthony Davis", { ppg: 26.3, fga: 19.4, pos: "F-C", age: 33, rpg: 11.9, apg: 3.2 }),
  player(3, "Austin Reaves", { ppg: 17.2, fga: 13.1, pos: "G", age: 27, rpg: 4.2, apg: 5.9 }),
  player(4, "Rui Hachimura", { ppg: 12.4, fga: 9.8, pos: "F", age: 28, rpg: 4.9, apg: 1.2 }),
  player(5, "Max Christie", { ppg: 8.1, fga: 6.9, pos: "G", age: 23, rpg: 2.8, apg: 1.6 }),
  player(6, "Dalton Knecht", { ppg: 14.6, fga: 11.7, pos: "G-F", age: 24, rpg: 3.4, apg: 1.1 }),
  player(7, "Jarred Vanderbilt", { ppg: 6.2, fga: 5.1, pos: "F", age: 26, rpg: 6.8, apg: 1.4 }),
  player(8, "Jaxson Hayes", { ppg: 7.4, fga: 5.6, pos: "C", age: 25, rpg: 5.1, apg: 0.9 }),
];

const PRIOR_PLAYERS: P[] = [
  // Both are young enough for the default age filter and jumped year over year.
  // Knecht's delta (14.6 - 9.1 = +5.5) edges Christie's (8.1 - 3.2 = +4.9), so
  // Knecht must sort first — the ordering assertion below depends on it.
  player(5, "Max Christie", { season: PRIOR, ppg: 3.2, mpg: 14, fga: 2.9, age: 22 }),
  player(6, "Dalton Knecht", { season: PRIOR, ppg: 9.1, mpg: 21, fga: 7.8, age: 23 }),
  // Present in both seasons but over the age cutoff.
  player(1, "LeBron James", { season: PRIOR, ppg: 25.7, mpg: 35, fga: 19.2, age: 40 }),
];

const TEAMS: P[] = [
  { id: 1610612747, abbrev: "LAL", name: "Los Angeles Lakers", conference: "West", wins: 44, losses: 28, win_pct: 0.611, payroll: 190_000_000 },
  { id: 1610612738, abbrev: "BOS", name: "Boston Celtics", conference: "East", wins: 54, losses: 18, win_pct: 0.75, payroll: 205_000_000 },
  { id: 1610612760, abbrev: "OKC", name: "Oklahoma City Thunder", conference: "West", wins: 58, losses: 14, win_pct: 0.806, payroll: 168_000_000 },
];

function payload(over: P = {}) {
  return {
    current_season: CURRENT,
    salary_season: "2026-27",
    thresholds: { cap: 164_961_000, tax: 200_428_000, firstApron: 209_015_000, secondApron: 221_686_000 },
    players: [...CURRENT_PLAYERS, ...PRIOR_PLAYERS],
    teams: TEAMS,
    ...over,
  };
}

function mockFetchOk(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }) as never;
}

/** Render and wait for the loading state to clear. */
async function renderLoaded(data: unknown = payload()) {
  mockFetchOk(data);
  const view = render(<LeagueLens />);
  await waitFor(() =>
    expect(screen.queryByText(/loading league dataset/i)).toBeNull()
  );
  return view;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

describe("LeagueLens — fetch lifecycle", () => {
  it("shows a loading state before the dataset resolves", () => {
    let resolve: (v: unknown) => void = () => {};
    global.fetch = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; })) as never;
    render(<LeagueLens />);
    expect(screen.getByText(/loading league dataset/i)).toBeTruthy();
    resolve({ ok: true, json: async () => ({ data: payload() }) });
  });

  it("renders an error panel carrying the status when the endpoint fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as never;
    render(<LeagueLens />);
    await waitFor(() => expect(screen.getByText(/league lens unavailable/i)).toBeTruthy());
    // The 503 this endpoint returns on an unprovisioned DB must surface, not hide.
    expect(screen.getByText(/HTTP 503/)).toBeTruthy();
  });

  it("surfaces a network rejection rather than spinning forever", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as never;
    render(<LeagueLens />);
    await waitFor(() => expect(screen.getByText(/league lens unavailable/i)).toBeTruthy());
    expect(screen.getByText(/network down/)).toBeTruthy();
    expect(screen.queryByText(/loading league dataset/i)).toBeNull();
  });
});

describe("LeagueLens — scatter view", () => {
  it("plots the current season against the default axes", async () => {
    await renderLoaded();
    // Defaults are ppg (Y) over fga (X).
    expect(
      screen.getByRole("img", { name: /Points \/g vs FG att \/g scatter/i })
    ).toBeTruthy();
    expect(screen.getByText(/8 players · ≥20 GP · 2025-26/)).toBeTruthy();
  });

  it("gives every mark an accessible label carrying both plotted values", async () => {
    await renderLoaded();
    expect(
      screen.getByLabelText("LeBron James: 18.6 FG att /g, 24.8 Points /g")
    ).toBeTruthy();
  });

  /**
   * The >=20 GP floor is what keeps a 3-game cameo out of the outlier board.
   * Without it a tiny sample can post an extreme rate and dominate the z-space.
   */
  it("excludes players below the 20-game floor from the pool", async () => {
    await renderLoaded(
      payload({
        players: [
          ...CURRENT_PLAYERS,
          player(99, "Cameo Callup", { gp: 3, ppg: 40, fga: 30 }),
        ],
      })
    );
    expect(screen.getByText(/8 players · ≥20 GP/)).toBeTruthy();
    expect(screen.queryByLabelText(/Cameo Callup/)).toBeNull();
  });

  it("drops unsigned players when an axis is switched to salary", async () => {
    await renderLoaded(
      payload({
        players: [...CURRENT_PLAYERS, player(98, "Unsigned Two-Way", { salary: null })],
      })
    );
    expect(screen.getByText(/9 players/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("X axis stat"), { target: { value: "salary" } });

    // A null salary is not $0 — such rows leave the plot rather than pile on the axis.
    await waitFor(() => expect(screen.getByText(/8 players/)).toBeTruthy());
    expect(screen.queryByLabelText(/Unsigned Two-Way/)).toBeNull();
  });

  it("directly labels outliers by last name, capped at six", async () => {
    const { container } = await renderLoaded();
    const labels = Array.from(container.querySelectorAll("svg text"))
      .map((t) => t.textContent ?? "")
      .filter((t) => CURRENT_PLAYERS.some((p) => String(p.name).split(" ").slice(-1)[0] === t));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThanOrEqual(6);
  });

  it("redraws against a new axis when the stat select changes", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByLabelText("Y axis stat"), { target: { value: "rpg" } });
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: /Rebounds \/g vs FG att \/g scatter/i })
      ).toBeTruthy()
    );
  });

  it("declines to draw a scatter when the pool is too small to z-score", async () => {
    await renderLoaded(payload({ players: [player(1, "Only One")] }));
    // One point has no variance; the chart must be absent, not a degenerate plot.
    expect(screen.queryByRole("img", { name: /scatter/i })).toBeNull();
  });
});

describe("LeagueLens — similarity comps", () => {
  it("reveals comps for the selected player and hides them when deselected", async () => {
    await renderLoaded();
    const mark = screen.getByLabelText(/^Austin Reaves:/);

    fireEvent.click(mark);
    await waitFor(() =>
      expect(screen.getByText(/Closest statistical comps/)).toBeTruthy()
    );

    // Clicking the same mark toggles the selection back off.
    fireEvent.click(mark);
    await waitFor(() =>
      expect(screen.queryByText(/Closest statistical comps/)).toBeNull()
    );
  });

  it("lists the target plus five neighbours, target first", async () => {
    const { container } = await renderLoaded();
    fireEvent.click(screen.getByLabelText(/^Austin Reaves:/));
    await waitFor(() => expect(screen.getByText(/Closest statistical comps/)).toBeTruthy());

    const compTable = container.querySelectorAll("table");
    const rows = compTable[compTable.length - 1].querySelectorAll("tbody tr");
    expect(rows).toHaveLength(6); // target + 5
    expect(rows[0].textContent).toContain("Austin Reaves");
  });

  it("never lists the target again among its own comps", async () => {
    const { container } = await renderLoaded();
    fireEvent.click(screen.getByLabelText(/^Austin Reaves:/));
    await waitFor(() => expect(screen.getByText(/Closest statistical comps/)).toBeTruthy());

    const tables = container.querySelectorAll("table");
    const rows = Array.from(tables[tables.length - 1].querySelectorAll("tbody tr"));
    const named = rows.filter((r) => r.textContent?.includes("Austin Reaves"));
    expect(named).toHaveLength(1);
  });

  it("renders an unsigned comp as a dash rather than $0", async () => {
    await renderLoaded(
      payload({
        players: [
          ...CURRENT_PLAYERS.slice(0, 7),
          player(8, "Jaxson Hayes", { ppg: 7.4, fga: 5.6, pos: "C", age: 25, salary: null }),
        ],
      })
    );
    fireEvent.click(screen.getByLabelText(/^Jarred Vanderbilt:/));
    await waitFor(() => expect(screen.getByText(/Closest statistical comps/)).toBeTruthy());
    // The trade-comp lens is about price; a missing contract must not read as free.
    expect(screen.queryByText("$0.0M")).toBeNull();
  });
});

describe("LeagueLens — table view", () => {
  it("toggles the player table and ranks it by the Y axis", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: /table view/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /hide table/i })).toBeTruthy());

    const table = document.querySelectorAll("table")[0];
    const first = table.querySelectorAll("tbody tr")[0];
    // Default Y is ppg; Anthony Davis leads at 26.3.
    expect(first.textContent).toContain("Anthony Davis");

    fireEvent.click(screen.getByRole("button", { name: /hide table/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /table view/i })).toBeTruthy());
  });
});

describe("LeagueLens — breakout view", () => {
  it("ranks season-over-season risers and respects the age filter", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Breakouts" }));

    await waitFor(() => expect(screen.getByText("Δ PPG")).toBeTruthy());

    // Sorted by Δ PPG descending: Knecht (+5.5) then Christie (+4.9).
    const rows = document.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Dalton Knecht");
    expect(rows[1].textContent).toContain("Max Christie");
    // The rise is rendered with its direction marker, not a bare number.
    expect(rows[0].textContent).toContain("▲ 5.5");
    // LeBron appears in both seasons but is 41 — excluded while age ≤ 25 is on.
    expect(screen.queryByText("LeBron James")).toBeNull();
  });

  it("admits older players once the age filter is cleared", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Breakouts" }));
    await waitFor(() => expect(screen.getByText("Δ PPG")).toBeTruthy());

    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.getByText("LeBron James")).toBeTruthy());
  });

  it("explains itself when no player appears in both seasons", async () => {
    await renderLoaded(payload({ players: CURRENT_PLAYERS }));
    fireEvent.click(screen.getByRole("button", { name: "Breakouts" }));
    await waitFor(() =>
      expect(screen.getByText(/need rows in both seasons/i)).toBeTruthy()
    );
  });
});

describe("LeagueLens — payroll vs wins", () => {
  it("plots teams that have a payroll", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: /Payroll vs Wins/i }));
    await waitFor(() =>
      expect(document.querySelector("svg")).toBeTruthy()
    );
  });

  it("declines to plot when fewer than two teams have payroll data", async () => {
    await renderLoaded(
      payload({
        teams: [
          { ...TEAMS[0], payroll: null },
          { ...TEAMS[1], payroll: null },
          TEAMS[2],
        ],
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /Payroll vs Wins/i }));
    // One point cannot be z-scored; nothing should render rather than a lone dot
    // implying a payroll-to-wins relationship from a single observation.
    await waitFor(() => expect(document.querySelector("svg")).toBeNull());
  });
});
