import type { PlantKind } from './plants'

/**
 * Every number that sets how Tend feels, in one place.
 *
 * DRAFT VALUES. These are learning surfaces under CLAUDE.md "Learning Mode":
 * Brooks derives and tunes them (M1 adds a balance simulator to test them).
 * Until then they are reasonable first guesses, not tested design.
 */
export const TUNING = {
  /** Grid edge length at the start (M1 grows it as seasons are weathered). */
  gridSize: 6,

  /** Hour (local time) when a new day starts, so a late night still counts as "today". */
  rolloverHour: 4,

  /** A season arrives every this many days after the garden is started. */
  seasonEveryDays: 7,

  /** The forecast appears this many days before a season. */
  forecastDays: 2,

  /**
   * Tended days needed to reach each stage: [seed, sprout, grown, bloom].
   * A tended day is a day the player checked in after the bed was planted,
   * with or without habits kept, while the bed was not dormant.
   */
  stageDays: {
    oak: [0, 2, 4, 7],
    vine: [0, 1, 3, 5],
    moonflower: [0, 1, 3, 5],
    sunflower: [0, 1, 2, 4],
    fern: [0, 1, 3, 5],
    // DRAFT (M1, opt-in lanes): toyon is slow alone and quick beside oaks; buckwheat is slow but never sleeps.
    toyon: [0, 2, 4, 6],
    buckwheat: [0, 2, 4, 7],
  } satisfies Record<PlantKind, readonly [number, number, number, number]>,

  /** Vine: extra tended days counted for each oak it touches. */
  vineDaysPerOak: 1,

  /** DRAFT (M1). Toyon: extra tended days counted for each oak it touches ("lifting holds up the search"). */
  toyonDaysPerOak: 1,

  /** Calendar days a bed sleeps after a season hits it. */
  dormantDays: 3,

  /** Moonflower: days taken off a touching bed's dormancy. */
  moonflowerRecoveryDays: 1,
} as const
