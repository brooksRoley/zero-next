import { loadAlpine } from './alpine'
import { loadFarm } from './farm'
import { creditNudges, loadKelp, newKelpPlay, type KelpPlay } from './kelp'
import type { JournalProgress } from './journal'
import { sampleGarden } from './sample'
import { loadGarden } from './storage'
import { dayIndex } from './time'
import { unlockedTiers, type GardenProgress } from './watershed'

/**
 * Everything Tend's pages read from this browser, in one place. In the sample
 * nothing is read or written: a fresh sample garden stands in for the player's.
 */

export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export type TendProgress = GardenProgress & { checkins: number }

export function readGardenProgress(sample: boolean, storage: Storage | null = browserStorage()): TendProgress {
  try {
    const garden = sample ? sampleGarden(dayIndex(new Date())) : loadGarden(storage)
    return {
      notes: garden?.notes?.length ?? 0,
      seasons: garden?.seasons.length ?? 0,
      checkins: garden ? Object.keys(garden.checkins).length : 0,
    }
  } catch {
    return { notes: 0, seasons: 0, checkins: 0 }
  }
}

/** The player's kelp forest, with a nudge credited for each garden check-in since the last visit. */
export function readKelp(sample: boolean, checkins: number, storage: Storage | null = browserStorage()): KelpPlay {
  if (sample) return newKelpPlay()
  const play = loadKelp(storage) ?? { ...newKelpPlay(), credited: checkins }
  return creditNudges(play, checkins)
}

/** What the Journal needs to know to mark entries collected. */
export function readJournalProgress(sample: boolean, storage: Storage | null = browserStorage()): JournalProgress {
  const garden = readGardenProgress(sample, storage)
  return {
    tiers: unlockedTiers(garden),
    kelp: sample ? undefined : loadKelp(storage)?.seen,
    farm: sample ? undefined : loadFarm(storage)?.seen,
    alpine: sample ? undefined : loadAlpine(storage)?.seen,
  }
}
