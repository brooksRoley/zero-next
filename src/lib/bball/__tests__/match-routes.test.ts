/**
 * Route contract tests for the two match endpoints, focused on the integrity
 * holes: ghost poisoning (submit-and-fetch storing unvalidated boards) and
 * result forgery/replay (resolve trusting an unbound client result).
 * The real public/engine_roster.json backs validation (Curry is rosterId 1).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

type SqlCall = { text: string; values: unknown[] };
const sqlCalls: SqlCall[] = [];

/** Route each tagged-template sql call to canned rows by query substring. */
function stubSql(routes: Array<{ match: string; rows: unknown[] }>) {
  mockSql.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(" ? ").replace(/\s+/g, " ");
    sqlCalls.push({ text, values });
    const route = routes.find((r) => text.includes(r.match));
    return Promise.resolve(route ? route.rows : []);
  });
}

function createReq(method: string, body: unknown): any {
  return { method, body, headers: {} };
}

function createRes(): any {
  const res: any = { _status: 200, _json: null, _ended: false };
  res.status = (code: number) => { res._status = code; return res; };
  res.json = (data: unknown) => { res._json = data; return res; };
  res.end = () => { res._ended = true; return res; };
  res.setHeader = () => res;
  return res;
}

const ACTIVE_RUN = [{ current_round: 1, status: "active" }];

function curryBoard(overrides: Record<string, unknown> = {}) {
  return {
    team_name: "You",
    offense: "spread_pnr",
    coverage: "drop",
    units: [
      {
        id: 7,
        rosterId: 1,
        name: "Steph Curry",
        team: "GSW",
        cost: 5,
        star: 1,
        x: 2,
        y: 3,
        stats: { shooting: 74, speed: 63, defense: 51 },
      },
    ],
    ...overrides,
  };
}

async function submitHandler() {
  const mod = await import("src/pages/api/bball/match/submit-and-fetch");
  return mod.default;
}

async function resolveHandler() {
  const mod = await import("src/pages/api/bball/match/resolve");
  return mod.default;
}

beforeEach(() => {
  mockSql.mockReset();
  sqlCalls.length = 0;
});

describe("POST /api/bball/match/submit-and-fetch", () => {
  it("rejects non-POST and missing fields", async () => {
    const handler = await submitHandler();

    const res405 = createRes();
    await handler(createReq("GET", {}), res405);
    expect(res405._status).toBe(405);

    for (const body of [
      {},
      { run_id: "r1", board_data: curryBoard() }, // no round
      { run_id: "r1", round_number: "1", board_data: curryBoard() }, // non-integer round
      { run_id: "r1", round_number: 1 }, // no board
      { run_id: 42, round_number: 1, board_data: curryBoard() }, // non-string run_id
    ]) {
      const res = createRes();
      await handler(createReq("POST", body), res);
      expect(res._status).toBe(400);
    }
    expect(sqlCalls).toHaveLength(0);
  });

  it("404s an unknown run and 409s inactive runs or a round mismatch", async () => {
    const handler = await submitHandler();

    stubSql([{ match: "FROM bball_runs", rows: [] }]);
    const resMissing = createRes();
    await handler(createReq("POST", { run_id: "ghost", round_number: 1, board_data: curryBoard() }), resMissing);
    expect(resMissing._status).toBe(404);

    stubSql([{ match: "FROM bball_runs", rows: [{ current_round: 3, status: "lost" }] }]);
    const resDead = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 3, board_data: curryBoard() }), resDead);
    expect(resDead._status).toBe(409);

    stubSql([{ match: "FROM bball_runs", rows: [{ current_round: 4, status: "active" }] }]);
    const resWrongRound = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 9, board_data: curryBoard() }), resWrongRound);
    expect(resWrongRound._status).toBe(409);
    // Nothing was written on any of these paths.
    expect(sqlCalls.some((c) => c.text.includes("INSERT"))).toBe(false);
  });

  it("rejects a forged board (unknown player, oversized team) with 400 and stores nothing", async () => {
    const handler = await submitHandler();
    stubSql([{ match: "FROM bball_runs", rows: ACTIVE_RUN }]);

    const resUnknown = createRes();
    await handler(
      createReq("POST", {
        run_id: "r1",
        round_number: 1,
        board_data: curryBoard({ units: [{ rosterId: 9999, star: 1, x: 0, y: 0 }] }),
      }),
      resUnknown
    );
    expect(resUnknown._status).toBe(400);

    const fourUnits = [0, 1, 2, 3].map((x) => ({ rosterId: 1, star: 1, x, y: 0 }));
    const resOversized = createRes();
    await handler(
      createReq("POST", { run_id: "r1", round_number: 1, board_data: curryBoard({ units: fourUnits }) }),
      resOversized
    );
    expect(resOversized._status).toBe(400);
    expect(sqlCalls.some((c) => c.text.includes("INSERT"))).toBe(false);
  });

  it("stores the sanitized board, not the client payload (poisoning regression)", async () => {
    const handler = await submitHandler();
    stubSql([
      { match: "FROM bball_runs", rows: ACTIVE_RUN },
      { match: "INSERT INTO bball_board_states", rows: [] },
      { match: "SELECT board_data", rows: [] },
    ]);

    const poisoned = curryBoard({
      units: [
        {
          rosterId: 1,
          name: "Godmode Curry",
          cost: 1,
          star: 1,
          x: 2,
          y: 3,
          stats: { shooting: 99, speed: 99, defense: 99 },
        },
      ],
    });
    const res = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 1, board_data: poisoned }), res);
    expect(res._status).toBe(200);

    const insert = sqlCalls.find((c) => c.text.includes("INSERT INTO bball_board_states"));
    expect(insert).toBeDefined();
    const stored = JSON.parse(insert!.values[2] as string);
    // The stored ghost carries roster truth: real stats, real cost, real name.
    expect(stored.units[0].stats).toEqual({ shooting: 74, speed: 63, defense: 51 });
    expect(stored.units[0].cost).toBe(5);
    expect(stored.units[0].name).toBe("Steph Curry");
    // Upsert path so re-locking a round can't stack duplicate ghost rows.
    expect(insert!.text).toContain("ON CONFLICT");
  });

  it("returns a stored opponent when one exists, bot fallback otherwise", async () => {
    const handler = await submitHandler();
    const ghost = { team_name: "Rival", units: [] };
    stubSql([
      { match: "FROM bball_runs", rows: ACTIVE_RUN },
      { match: "SELECT board_data", rows: [{ board_data: ghost }] },
    ]);
    const res = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 1, board_data: curryBoard() }), res);
    expect(res._json.opponent_board).toEqual(ghost);

    stubSql([
      { match: "FROM bball_runs", rows: ACTIVE_RUN },
      { match: "SELECT board_data", rows: [] },
    ]);
    const resBot = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 1, board_data: curryBoard() }), resBot);
    expect(resBot._json.opponent_board.is_bot).toBe(true);
  });
});

describe("POST /api/bball/match/resolve", () => {
  it("rejects non-POST, missing round_number, and non-whitelisted results", async () => {
    const handler = await resolveHandler();

    const res405 = createRes();
    await handler(createReq("GET", {}), res405);
    expect(res405._status).toBe(405);

    for (const body of [
      { run_id: "r1", result: "loss" }, // no round — the old replayable shape
      { run_id: "r1", round_number: 1, result: "banana" }, // was silently a win before
      { run_id: "r1", round_number: 1 },
      { run_id: "r1", round_number: 1, result: "WIN" },
    ]) {
      const res = createRes();
      await handler(createReq("POST", body), res);
      expect(res._status).toBe(400);
    }
    expect(sqlCalls).toHaveLength(0);
  });

  it("409s when no board was submitted for the round (forged resolve)", async () => {
    const handler = await resolveHandler();
    stubSql([{ match: "FROM bball_board_states", rows: [] }]);
    const res = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 1, result: "win" }), res);
    expect(res._status).toBe(409);
    expect(sqlCalls.some((c) => c.text.includes("UPDATE"))).toBe(false);
  });

  it("applies a loss: -20 HP, round advances, run stays active", async () => {
    const handler = await resolveHandler();
    stubSql([
      { match: "FROM bball_board_states", rows: [{ id: 1 }] },
      { match: "UPDATE bball_runs", rows: [{ health: 80, current_round: 2, status: "active" }] },
    ]);
    const res = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 1, result: "loss" }), res);
    expect(res._status).toBe(200);
    expect(res._json).toEqual({ health: 80, current_round: 2, status: "active" });

    const update = sqlCalls.find((c) => c.text.includes("UPDATE bball_runs"));
    // Damage is computed server-side from the whitelisted result…
    expect(update!.values).toContain(20);
    // …and the update is bound to status='active' AND the exact round.
    expect(update!.text).toContain("status = 'active'");
    expect(update!.text).toContain("current_round = ?");
  });

  it("a win deals 0 damage", async () => {
    const handler = await resolveHandler();
    stubSql([
      { match: "FROM bball_board_states", rows: [{ id: 1 }] },
      { match: "UPDATE bball_runs", rows: [{ health: 100, current_round: 2, status: "active" }] },
    ]);
    const res = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 1, result: "win" }), res);
    expect(res._status).toBe(200);
    const update = sqlCalls.find((c) => c.text.includes("UPDATE bball_runs"));
    expect(update!.values).toContain(0);
    expect(update!.values).not.toContain(20);
  });

  it("409s a replayed/stale round instead of re-applying damage (forgery regression)", async () => {
    const handler = await resolveHandler();
    // Board exists, but the guarded UPDATE matches no row: the run has moved
    // past this round (or ended), so the replay is a no-op.
    stubSql([
      { match: "FROM bball_board_states", rows: [{ id: 1 }] },
      { match: "UPDATE bball_runs", rows: [] },
    ]);
    const res = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 1, result: "loss" }), res);
    expect(res._status).toBe(409);
    expect(res._json.error).toContain("already");
  });

  it("passes through terminal states from the guarded update (lost / won)", async () => {
    const handler = await resolveHandler();
    stubSql([
      { match: "FROM bball_board_states", rows: [{ id: 1 }] },
      { match: "UPDATE bball_runs", rows: [{ health: 0, current_round: 6, status: "lost" }] },
    ]);
    const res = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 5, result: "loss" }), res);
    expect(res._json.status).toBe("lost");

    stubSql([
      { match: "FROM bball_board_states", rows: [{ id: 1 }] },
      { match: "UPDATE bball_runs", rows: [{ health: 60, current_round: 11, status: "won" }] },
    ]);
    const resWon = createRes();
    await handler(createReq("POST", { run_id: "r1", round_number: 10, result: "win" }), resWon);
    expect(resWon._json.status).toBe("won");
  });
});
