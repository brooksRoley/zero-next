/**
 * Static NBA team data — mirrors nba_api.stats.static.teams.get_teams()
 */

export interface NbaTeamStatic {
  id: number;
  abbreviation: string;
  city: string;
  full_name: string;
  nickname: string;
  state: string;
  conference: string;
}

export const NBA_TEAMS: NbaTeamStatic[] = [
  { id: 1610612737, abbreviation: "ATL", city: "Atlanta", full_name: "Atlanta Hawks", nickname: "Hawks", state: "Georgia", conference: "East" },
  { id: 1610612738, abbreviation: "BOS", city: "Boston", full_name: "Boston Celtics", nickname: "Celtics", state: "Massachusetts", conference: "East" },
  { id: 1610612751, abbreviation: "BKN", city: "Brooklyn", full_name: "Brooklyn Nets", nickname: "Nets", state: "New York", conference: "East" },
  { id: 1610612766, abbreviation: "CHA", city: "Charlotte", full_name: "Charlotte Hornets", nickname: "Hornets", state: "North Carolina", conference: "East" },
  { id: 1610612741, abbreviation: "CHI", city: "Chicago", full_name: "Chicago Bulls", nickname: "Bulls", state: "Illinois", conference: "East" },
  { id: 1610612739, abbreviation: "CLE", city: "Cleveland", full_name: "Cleveland Cavaliers", nickname: "Cavaliers", state: "Ohio", conference: "East" },
  { id: 1610612742, abbreviation: "DAL", city: "Dallas", full_name: "Dallas Mavericks", nickname: "Mavericks", state: "Texas", conference: "West" },
  { id: 1610612743, abbreviation: "DEN", city: "Denver", full_name: "Denver Nuggets", nickname: "Nuggets", state: "Colorado", conference: "West" },
  { id: 1610612765, abbreviation: "DET", city: "Detroit", full_name: "Detroit Pistons", nickname: "Pistons", state: "Michigan", conference: "East" },
  { id: 1610612744, abbreviation: "GSW", city: "Golden State", full_name: "Golden State Warriors", nickname: "Warriors", state: "California", conference: "West" },
  { id: 1610612745, abbreviation: "HOU", city: "Houston", full_name: "Houston Rockets", nickname: "Rockets", state: "Texas", conference: "West" },
  { id: 1610612754, abbreviation: "IND", city: "Indiana", full_name: "Indiana Pacers", nickname: "Pacers", state: "Indiana", conference: "East" },
  { id: 1610612746, abbreviation: "LAC", city: "Los Angeles", full_name: "Los Angeles Clippers", nickname: "Clippers", state: "California", conference: "West" },
  { id: 1610612747, abbreviation: "LAL", city: "Los Angeles", full_name: "Los Angeles Lakers", nickname: "Lakers", state: "California", conference: "West" },
  { id: 1610612763, abbreviation: "MEM", city: "Memphis", full_name: "Memphis Grizzlies", nickname: "Grizzlies", state: "Tennessee", conference: "West" },
  { id: 1610612748, abbreviation: "MIA", city: "Miami", full_name: "Miami Heat", nickname: "Heat", state: "Florida", conference: "East" },
  { id: 1610612749, abbreviation: "MIL", city: "Milwaukee", full_name: "Milwaukee Bucks", nickname: "Bucks", state: "Wisconsin", conference: "East" },
  { id: 1610612750, abbreviation: "MIN", city: "Minnesota", full_name: "Minnesota Timberwolves", nickname: "Timberwolves", state: "Minnesota", conference: "West" },
  { id: 1610612740, abbreviation: "NOP", city: "New Orleans", full_name: "New Orleans Pelicans", nickname: "Pelicans", state: "Louisiana", conference: "West" },
  { id: 1610612752, abbreviation: "NYK", city: "New York", full_name: "New York Knicks", nickname: "Knicks", state: "New York", conference: "East" },
  { id: 1610612760, abbreviation: "OKC", city: "Oklahoma City", full_name: "Oklahoma City Thunder", nickname: "Thunder", state: "Oklahoma", conference: "West" },
  { id: 1610612753, abbreviation: "ORL", city: "Orlando", full_name: "Orlando Magic", nickname: "Magic", state: "Florida", conference: "East" },
  { id: 1610612755, abbreviation: "PHI", city: "Philadelphia", full_name: "Philadelphia 76ers", nickname: "76ers", state: "Pennsylvania", conference: "East" },
  { id: 1610612756, abbreviation: "PHX", city: "Phoenix", full_name: "Phoenix Suns", nickname: "Suns", state: "Arizona", conference: "West" },
  { id: 1610612757, abbreviation: "POR", city: "Portland", full_name: "Portland Trail Blazers", nickname: "Trail Blazers", state: "Oregon", conference: "West" },
  { id: 1610612758, abbreviation: "SAC", city: "Sacramento", full_name: "Sacramento Kings", nickname: "Kings", state: "California", conference: "West" },
  { id: 1610612759, abbreviation: "SAS", city: "San Antonio", full_name: "San Antonio Spurs", nickname: "Spurs", state: "Texas", conference: "West" },
  { id: 1610612761, abbreviation: "TOR", city: "Toronto", full_name: "Toronto Raptors", nickname: "Raptors", state: "Ontario", conference: "East" },
  { id: 1610612762, abbreviation: "UTA", city: "Utah", full_name: "Utah Jazz", nickname: "Jazz", state: "Utah", conference: "West" },
  { id: 1610612764, abbreviation: "WAS", city: "Washington", full_name: "Washington Wizards", nickname: "Wizards", state: "District of Columbia", conference: "East" },
];

export const TEAMS_BY_ID = new Map(NBA_TEAMS.map((t) => [t.id, t]));
