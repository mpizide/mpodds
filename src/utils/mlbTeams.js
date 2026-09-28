// MLB teams keyed by full name (as used by both The Odds API and the MLB Stats API).
// `id` is the MLB Stats API team id, which also drives the logo URL.
const MLB_TEAMS = {
  'Arizona Diamondbacks': { id: 109, abbr: 'AZ' },
  'Athletics': { id: 133, abbr: 'ATH' },
  'Atlanta Braves': { id: 144, abbr: 'ATL' },
  'Baltimore Orioles': { id: 110, abbr: 'BAL' },
  'Boston Red Sox': { id: 111, abbr: 'BOS' },
  'Chicago Cubs': { id: 112, abbr: 'CHC' },
  'Chicago White Sox': { id: 145, abbr: 'CWS' },
  'Cincinnati Reds': { id: 113, abbr: 'CIN' },
  'Cleveland Guardians': { id: 114, abbr: 'CLE' },
  'Colorado Rockies': { id: 115, abbr: 'COL' },
  'Detroit Tigers': { id: 116, abbr: 'DET' },
  'Houston Astros': { id: 117, abbr: 'HOU' },
  'Kansas City Royals': { id: 118, abbr: 'KC' },
  'Los Angeles Angels': { id: 108, abbr: 'LAA' },
  'Los Angeles Dodgers': { id: 119, abbr: 'LAD' },
  'Miami Marlins': { id: 146, abbr: 'MIA' },
  'Milwaukee Brewers': { id: 158, abbr: 'MIL' },
  'Minnesota Twins': { id: 142, abbr: 'MIN' },
  'New York Mets': { id: 121, abbr: 'NYM' },
  'New York Yankees': { id: 147, abbr: 'NYY' },
  'Philadelphia Phillies': { id: 143, abbr: 'PHI' },
  'Pittsburgh Pirates': { id: 134, abbr: 'PIT' },
  'San Diego Padres': { id: 135, abbr: 'SD' },
  'San Francisco Giants': { id: 137, abbr: 'SF' },
  'Seattle Mariners': { id: 136, abbr: 'SEA' },
  'St. Louis Cardinals': { id: 138, abbr: 'STL' },
  'Tampa Bay Rays': { id: 139, abbr: 'TB' },
  'Texas Rangers': { id: 140, abbr: 'TEX' },
  'Toronto Blue Jays': { id: 141, abbr: 'TOR' },
  'Washington Nationals': { id: 120, abbr: 'WSH' }
};

// Alternate names some sources still use
const ALIASES = {
  'Oakland Athletics': 'Athletics'
};

export const getMLBTeam = (teamName) => MLB_TEAMS[ALIASES[teamName] || teamName] || null;

export const getMLBTeamLogo = (teamName) => {
  const team = getMLBTeam(teamName);
  return team ? `https://www.mlbstatic.com/team-logos/${team.id}.svg` : '';
};

export const getMLBTeamAbbr = (teamName) => getMLBTeam(teamName)?.abbr || teamName;

export const getPlayerHeadshot = (playerId) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`;
