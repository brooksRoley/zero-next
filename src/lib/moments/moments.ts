import type { Moment, Grade } from 'src/lib/moments/geometry'

/**
 * The repertory of frozen seconds. Positions are reconstructions from
 * broadcast footage — close enough to teach the geometry, not survey data.
 *
 * `expectedHistoricalGrade` is the floor the real, historical spot must earn
 * inside its own puzzle (enforced by tests). It is deliberately not always
 * 'A': when the geometry says history took the second-best shot, the epilogue
 * owns that instead of the model lying about it.
 */
export type MomentSpec = Moment & { expectedHistoricalGrade: Grade }

export const MOMENTS: MomentSpec[] = [
  {
    id: 'allen_2013',
    kind: 'shape',
    title: 'The Backpedal',
    date: 'June 18, 2013',
    series: 'NBA Finals, Game 6 — Spurs at Heat',
    clock: '5.2 on the clock, Heat down 3',
    story:
      'Bosh rips the rebound of LeBron’s miss. The Spurs’ championship rope is already coming out of the tunnel. You are Ray Allen, and you were just crashing the glass — now the ball is about to be kicked back out to you.',
    question: 'You have about two and a half seconds to relocate before the catch. Click where you go.',
    epilogue:
      'Allen backpedaled to the right corner without ever looking down, toes a half-inch inside the line, and hit the most famous corner three ever taken. Overtime. The Heat won the title two nights later.',
    protagonist: { name: 'Ray Allen', pos: { x: 36, y: 13 }, speed: 15 },
    timeLeft: 2.4,
    defenderTime: 0.8,
    defenders: [
      { name: 'Tony Parker', pos: { x: 33, y: 22 }, speed: 15 },
      { name: 'Manu Ginóbili', pos: { x: 27, y: 8 }, speed: 15 },
      { name: 'Boris Diaw', pos: { x: 21, y: 12 }, speed: 13 },
      { name: 'Kawhi Leonard', pos: { x: 12, y: 20 }, speed: 16 },
    ],
    teammates: [
      { name: 'Chris Bosh', pos: { x: 29, y: 11 }, speed: 12 },
      { name: 'LeBron James', pos: { x: 20, y: 26 }, speed: 17 },
    ],
    historicalSpot: { x: 47, y: 3.5 },
    expectedHistoricalGrade: 'B',
  },
  {
    id: 'jordan_1998',
    kind: 'shape',
    title: 'The Push-Off That Wasn’t',
    date: 'June 14, 1998',
    series: 'NBA Finals, Game 6 — Bulls at Jazz',
    clock: '10 seconds, Bulls down 1',
    story:
      'You are Michael Jordan, and you have just planted your crossover. Bryon Russell is sliding past you on skates — his momentum is spent, and for one beat the floor in front of you is empty. Everyone in Utah is standing.',
    question: 'The separation lasts about a second. Click where you rise up.',
    epilogue:
      'Jordan rose at the top of the key, held the follow-through like a portrait, and won the sixth title with 5.2 seconds left. The geometry says the pull-up was the only clean look on the floor — Russell’s slide erased everything else.',
    protagonist: { name: 'Michael Jordan', pos: { x: 31, y: 25 }, speed: 13 },
    timeLeft: 1.3,
    defenderTime: 0.85,
    defenders: [
      { name: 'Bryon Russell', pos: { x: 20, y: 29 }, speed: 4 },
      { name: 'Greg Ostertag', pos: { x: 27, y: 9 }, speed: 11 },
      { name: 'Shandon Anderson', pos: { x: 41, y: 30 }, speed: 13 },
      { name: 'John Stockton', pos: { x: 11, y: 25 }, speed: 14 },
    ],
    teammates: [{ name: 'Steve Kerr', pos: { x: 8, y: 26 }, speed: 13 }],
    historicalSpot: { x: 27, y: 24 },
    expectedHistoricalGrade: 'B',
  },
  {
    id: 'james_2016',
    kind: 'deny',
    title: 'The Chase-Down',
    date: 'June 19, 2016',
    series: 'NBA Finals, Game 7 — Cavaliers at Warriors',
    clock: '1:50 left, tied 89–89',
    story:
      'The break is going the wrong way. Iguodala takes the outlet with Curry filling the lane, and you are LeBron James, a full quarter of the court behind the play. Every step you take has to be a bet on where the ball will be — not where it is.',
    question: 'Iguodala will lay it off the glass in about two and a half seconds. Click the point you run to.',
    epilogue:
      'LeBron ignored both runners and ran a straight line to the ball’s future: the high glass on the right side. The block didn’t just save two points — statistically, it froze the game until Kyrie’s three won it. The Cavs ended a 52-year drought.',
    protagonist: { name: 'LeBron James', pos: { x: 12, y: 44 }, speed: 27 },
    timeLeft: 2.6,
    defenderTime: 0.8,
    defenders: [
      { name: 'Andre Iguodala', pos: { x: 30, y: 36 }, speed: 22 },
      { name: 'Stephen Curry', pos: { x: 21, y: 30 }, speed: 20 },
    ],
    teammates: [{ name: 'J.R. Smith', pos: { x: 33, y: 39 }, speed: 22 }],
    historicalSpot: { x: 23.5, y: 5.5 },
    denyPoint: { x: 23.5, y: 5.5 },
    expectedHistoricalGrade: 'A',
  },
  {
    id: 'fisher_2004',
    kind: 'shape',
    title: 'Point Four',
    date: 'May 13, 2004',
    series: 'West Semifinals, Game 5 — Lakers at Spurs',
    clock: '0.4 on the clock, Lakers down 1',
    story:
      'Duncan has just hit an impossible fadeaway to take the lead. Four tenths of a second is not enough time to dribble, pump, or think — it is enough time to catch with your wrist already loaded. You are Derek Fisher, flashing toward Gary Payton’s inbound pass.',
    question: 'Pick the catch-and-shoot spot. You can only cover a few feet — and the defense is already close.',
    epilogue:
      'Fisher caught it on the left wing, already falling away, and let go in 0.3 seconds. The geometry grades the spot a C — a contested midrange leaner. History grades it 74–73, Lakers. Sometimes the shot you can get beats the shot the floor recommends.',
    protagonist: { name: 'Derek Fisher', pos: { x: 13, y: 20 }, speed: 16 },
    timeLeft: 0.4,
    defenderTime: 0.4,
    defenders: [
      { name: 'Manu Ginóbili', pos: { x: 18, y: 27 }, speed: 17 },
      { name: 'Tony Parker', pos: { x: 24, y: 18 }, speed: 15 },
      { name: 'Tim Duncan', pos: { x: 25, y: 9 }, speed: 12 },
    ],
    teammates: [
      { name: 'Gary Payton (inbound)', pos: { x: 0.5, y: 22 }, speed: 0.1 },
      { name: 'Shaquille O’Neal', pos: { x: 28, y: 7 }, speed: 11 },
    ],
    historicalSpot: { x: 11, y: 19 },
    expectedHistoricalGrade: 'C',
  },
  {
    id: 'leonard_2019',
    kind: 'shape',
    title: 'Four Bounces',
    date: 'May 12, 2019',
    series: 'East Semifinals, Game 7 — 76ers at Raptors',
    clock: '4.2 on the clock, tied 90–90',
    story:
      'You are Kawhi Leonard, and the whole building knows you are getting the ball. Simmons is chest-to-chest, Embiid is lurking, and the sideline is coming up fast. The only real estate left on the floor is the shrinking triangle in the right baseline corner.',
    question: 'You have about a second and a half of dribble left. Click where you take off from.',
    epilogue:
      'Leonard drifted to the right baseline corner and hung a fadeaway over Embiid’s outstretched reach. The ball bounced on the rim four times while both teams watched from a crouch. The geometry grades the spot a C — a smothered two, a step inside the arc. The rim debated it four times and sided with Kawhi: the only Game 7 buzzer-beater in NBA history.',
    protagonist: { name: 'Kawhi Leonard', pos: { x: 38, y: 19 }, speed: 15 },
    timeLeft: 1.15,
    defenderTime: 0.7,
    defenders: [
      { name: 'Ben Simmons', pos: { x: 31, y: 21 }, speed: 16 },
      { name: 'Joel Embiid', pos: { x: 33, y: 12 }, speed: 12 },
      { name: 'Jimmy Butler', pos: { x: 22, y: 17 }, speed: 15 },
    ],
    teammates: [{ name: 'Danny Green', pos: { x: 8, y: 6 }, speed: 14 }],
    historicalSpot: { x: 45, y: 3 },
    expectedHistoricalGrade: 'C',
  },
]

export function getMoment(id: string): MomentSpec | undefined {
  return MOMENTS.find((m) => m.id === id)
}
