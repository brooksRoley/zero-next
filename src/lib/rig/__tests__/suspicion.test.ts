import { describe, it, expect } from "vitest";
import {
  suspicionEngine,
  detectHeavyFavoriteLoss,
  detectBigLineMove,
  detectModelDisagreement,
  detectRevenueConvenience,
  detectBooksDisagree,
  consensusHomeSpread,
  easternHour,
  type GameCase,
} from "src/lib/rig/suspicion";
import { DEMO_CASES } from "src/lib/rig/fixtures";

function baseGame(overrides: Partial<GameCase> = {}): GameCase {
  return {
    eventId: "test-1",
    homeTeam: "Denver Nuggets",
    awayTeam: "Utah Jazz",
    // 15:00 ET — deliberately NOT prime time.
    commenceTime: "2026-04-14T19:00:00Z",
    books: [
      { bookmaker: "draftkings", spreadHome: -6.5, homeMl: -260, awayMl: 215 },
      { bookmaker: "fanduel", spreadHome: -6.5, homeMl: -255, awayMl: 210 },
    ],
    openingSpread: -6.5,
    closingSpread: -6.5,
    modelSpread: -6.0,
    actualMargin: null,
    gameLabel: null,
    ...overrides,
  };
}

describe("easternHour", () => {
  it("converts UTC to Eastern (EDT in April)", () => {
    expect(easternHour("2026-04-14T23:10:00Z")).toBe(19);
    expect(easternHour("2026-04-15T02:00:00Z")).toBe(22);
  });

  it("returns -1 for garbage input", () => {
    expect(easternHour("not-a-date")).toBe(-1);
  });
});

describe("consensusHomeSpread", () => {
  it("takes the median across books", () => {
    expect(
      consensusHomeSpread([
        { bookmaker: "a", spreadHome: -3, homeMl: null, awayMl: null },
        { bookmaker: "b", spreadHome: -4, homeMl: null, awayMl: null },
        { bookmaker: "c", spreadHome: -7, homeMl: null, awayMl: null },
      ])
    ).toBe(-4);
  });

  it("averages the middle pair for an even count", () => {
    expect(
      consensusHomeSpread([
        { bookmaker: "a", spreadHome: -3, homeMl: null, awayMl: null },
        { bookmaker: "b", spreadHome: -4, homeMl: null, awayMl: null },
      ])
    ).toBe(-3.5);
  });

  it("returns null with no books", () => {
    expect(consensusHomeSpread([])).toBeNull();
  });
});

describe("detectHeavyFavoriteLoss", () => {
  it("fires when a >=70% home favorite loses", () => {
    const ex = detectHeavyFavoriteLoss(
      baseGame({
        books: [{ bookmaker: "dk", spreadHome: -12.5, homeMl: -650, awayMl: 475 }],
        actualMargin: -4,
      })
    );
    expect(ex).not.toBeNull();
    expect(ex!.id).toBe("heavy-favorite-loss");
    expect(ex!.stat).toContain("87%");
    expect(ex!.severity).toBeGreaterThanOrEqual(20);
    expect(ex!.severity).toBeLessThanOrEqual(40);
  });

  it("fires when a heavy AWAY favorite loses", () => {
    const ex = detectHeavyFavoriteLoss(
      baseGame({
        books: [{ bookmaker: "dk", spreadHome: 12.5, homeMl: 475, awayMl: -650 }],
        actualMargin: 4, // home won, away favorite lost
      })
    );
    expect(ex).not.toBeNull();
  });

  it("stays quiet when the favorite wins", () => {
    const ex = detectHeavyFavoriteLoss(
      baseGame({
        books: [{ bookmaker: "dk", spreadHome: -12.5, homeMl: -650, awayMl: 475 }],
        actualMargin: 15,
      })
    );
    expect(ex).toBeNull();
  });

  it("stays quiet for a modest (<70%) favorite losing", () => {
    const ex = detectHeavyFavoriteLoss(
      baseGame({
        books: [{ bookmaker: "dk", spreadHome: -3.5, homeMl: -160, awayMl: 140 }],
        actualMargin: -6,
      })
    );
    expect(ex).toBeNull();
  });

  it("stays quiet with no final margin or no moneylines", () => {
    expect(detectHeavyFavoriteLoss(baseGame({ actualMargin: null }))).toBeNull();
    expect(
      detectHeavyFavoriteLoss(
        baseGame({
          books: [{ bookmaker: "dk", spreadHome: -12.5, homeMl: null, awayMl: null }],
          actualMargin: -4,
        })
      )
    ).toBeNull();
  });
});

describe("detectBigLineMove", () => {
  it("fires on a 2+ point move and names the direction", () => {
    const ex = detectBigLineMove(
      baseGame({ openingSpread: -3.5, closingSpread: -7.0 })
    );
    expect(ex).not.toBeNull();
    expect(ex!.id).toBe("big-line-move");
    expect(ex!.stat).toContain("3.5");
    expect(ex!.conspiracy).toContain("Denver Nuggets");
  });

  it("stays quiet under 2 points", () => {
    expect(
      detectBigLineMove(baseGame({ openingSpread: -6.0, closingSpread: -7.0 }))
    ).toBeNull();
  });

  it("stays quiet without line history", () => {
    expect(detectBigLineMove(baseGame({ openingSpread: null }))).toBeNull();
  });
});

describe("detectModelDisagreement", () => {
  it("fires when the model and Vegas differ by >3 points", () => {
    const ex = detectModelDisagreement(
      baseGame({ modelSpread: -1.5, closingSpread: 4.5 })
    );
    expect(ex).not.toBeNull();
    expect(ex!.id).toBe("model-vs-vegas");
    expect(ex!.stat).toContain("6");
  });

  it("falls back to book consensus when no closing spread", () => {
    const ex = detectModelDisagreement(
      baseGame({ modelSpread: -12.0, closingSpread: null }) // books consensus -6.5
    );
    expect(ex).not.toBeNull();
  });

  it("stays quiet inside 3 points or without a model", () => {
    expect(
      detectModelDisagreement(baseGame({ modelSpread: -6.0, closingSpread: -6.5 }))
    ).toBeNull();
    expect(detectModelDisagreement(baseGame({ modelSpread: null }))).toBeNull();
  });
});

describe("detectRevenueConvenience", () => {
  it("fires for a star-market team in prime time", () => {
    const ex = detectRevenueConvenience(
      baseGame({
        homeTeam: "Los Angeles Lakers",
        commenceTime: "2026-04-15T00:30:00Z", // 20:30 ET
      })
    );
    expect(ex).not.toBeNull();
    expect(ex!.id).toBe("revenue-convenient");
    expect(ex!.severity).toBe(12);
  });

  it("fires for a Game 7 regardless of market", () => {
    const ex = detectRevenueConvenience(baseGame({ gameLabel: "Game 7" }));
    expect(ex).not.toBeNull();
    expect(ex!.stat).toBe("Game 7 detected");
    expect(ex!.severity).toBe(20);
  });

  it("stays quiet for a small-market afternoon game", () => {
    expect(detectRevenueConvenience(baseGame())).toBeNull();
  });

  it("stays quiet for a star team OUTSIDE prime time", () => {
    expect(
      detectRevenueConvenience(
        baseGame({
          homeTeam: "Los Angeles Lakers",
          commenceTime: "2026-04-14T19:00:00Z", // 15:00 ET
        })
      )
    ).toBeNull();
  });
});

describe("detectBooksDisagree", () => {
  it("fires when books are 1.5+ points apart", () => {
    const ex = detectBooksDisagree(
      baseGame({
        books: [
          { bookmaker: "a", spreadHome: 3.5, homeMl: null, awayMl: null },
          { bookmaker: "b", spreadHome: 5.5, homeMl: null, awayMl: null },
        ],
      })
    );
    expect(ex).not.toBeNull();
    expect(ex!.id).toBe("books-disagree");
    expect(ex!.stat).toContain("2");
  });

  it("stays quiet when books agree or with a single book", () => {
    expect(detectBooksDisagree(baseGame())).toBeNull();
    expect(
      detectBooksDisagree(
        baseGame({
          books: [{ bookmaker: "a", spreadHome: -6.5, homeMl: null, awayMl: null }],
        })
      )
    ).toBeNull();
  });
});

describe("suspicionEngine", () => {
  it("is deterministic given the same input", () => {
    const game = DEMO_CASES[0];
    const a = suspicionEngine(game);
    const b = suspicionEngine(game);
    expect(a).toEqual(b);
  });

  it("gives a quiet game only the ambient-paranoia baseline", () => {
    const report = suspicionEngine(baseGame());
    expect(report.exhibits).toHaveLength(0);
    expect(report.suspicionScore).toBe(5);
  });

  it("clamps the score to 100", () => {
    // A settled Game 7 collapse with a huge line move, model dissent, and
    // books in disarray — the Bureau's fever dream.
    const report = suspicionEngine(
      baseGame({
        homeTeam: "Los Angeles Lakers",
        awayTeam: "Boston Celtics",
        commenceTime: "2026-04-15T00:30:00Z",
        gameLabel: "Game 7",
        books: [
          { bookmaker: "a", spreadHome: -12.5, homeMl: -900, awayMl: 600 },
          { bookmaker: "b", spreadHome: -8.5, homeMl: -700, awayMl: 500 },
        ],
        openingSpread: -4.0,
        closingSpread: -10.5,
        modelSpread: -2.0,
        actualMargin: -10,
      })
    );
    expect(report.suspicionScore).toBeLessThanOrEqual(100);
    expect(report.exhibits.length).toBeGreaterThanOrEqual(4);
  });

  it("every exhibit carries all three teaching fields", () => {
    for (const game of DEMO_CASES) {
      for (const ex of suspicionEngine(game).exhibits) {
        expect(ex.conspiracy.length).toBeGreaterThan(20);
        expect(ex.sober.length).toBeGreaterThan(20);
        expect(ex.lesson.length).toBeGreaterThan(20);
        expect(ex.severity).toBeGreaterThan(0);
        expect(ex.severity).toBeLessThanOrEqual(40);
      }
    }
  });

  it("the demo case file exercises every detector at least once", () => {
    const seen = new Set(
      DEMO_CASES.flatMap((g) => suspicionEngine(g).exhibits.map((e) => e.id))
    );
    expect(seen).toEqual(
      new Set([
        "heavy-favorite-loss",
        "big-line-move",
        "model-vs-vegas",
        "revenue-convenient",
        "books-disagree",
      ])
    );
  });
});
