/**
 * AP Top 25 College Football Rankings
 * Source: 2026 AP Poll, Week 5 (ESPN)
 * Update weekly: https://www.espn.com/college-football/rankings
 * Used to filter which games to display and show rankings
 */

// [rank, school, mascot, ...extra aliases]
const AP_POLL = [
  [1, 'Texas', 'Longhorns'],
  [2, 'Georgia', 'Bulldogs'],
  [3, 'Notre Dame', 'Fighting Irish'],
  [4, 'Miami', 'Hurricanes', 'Miami (FL)'],
  [5, 'Ohio State', 'Buckeyes'],
  [6, 'Indiana', 'Hoosiers'],
  [7, 'Alabama', 'Crimson Tide'],
  [8, 'Florida', 'Gators'],
  [9, 'Ole Miss', 'Rebels', 'Mississippi', 'Mississippi Rebels'],
  [10, 'BYU', 'Cougars'],
  [11, 'LSU', 'Tigers'],
  [12, 'Texas Tech', 'Red Raiders'],
  [13, 'Utah', 'Utes'],
  [14, 'Iowa', 'Hawkeyes'],
  [15, 'Oregon', 'Ducks'],
  [16, 'Mississippi State', 'Bulldogs', 'Mississippi St Bulldogs'],
  [17, 'Tennessee', 'Volunteers'],
  [18, 'USC', 'Trojans'],
  [19, 'Oklahoma State', 'Cowboys', 'Oklahoma St Cowboys'],
  [20, 'Houston', 'Cougars'],
  [21, 'SMU', 'Mustangs'],
  [22, 'Boise State', 'Broncos', 'Boise St Broncos'],
  [23, 'UCLA', 'Bruins'],
  [24, 'Kentucky', 'Wildcats'],
  [25, 'Missouri', 'Tigers']
];

export const top25Rankings = AP_POLL.reduce((acc, [rank, school, mascot, ...aliases]) => {
  [school, `${school} ${mascot}`, ...aliases].forEach(name => { acc[name] = rank; });
  return acc;
}, {});

export const top25Teams = AP_POLL.map(([, school]) => school);

const rankingsByLowerName = Object.fromEntries(
  Object.entries(top25Rankings).map(([name, rank]) => [name.toLowerCase(), rank])
);

/**
 * Get team ranking if in top 25
 * Exact (case-insensitive) match only, so "Texas State" never picks up Texas's rank
 * @param {string} teamName - Team name from API
 * @returns {number|null} - Ranking number or null
 */
export const getTeamRanking = (teamName) => {
  if (!teamName) return null;
  return rankingsByLowerName[teamName.trim().toLowerCase()] || null;
};

/**
 * Check if a team is in the top 25
 * @param {string} teamName - Team name from API
 * @returns {boolean}
 */
export const isTop25Team = (teamName) => {
  return getTeamRanking(teamName) !== null;
};

/**
 * Check if a game involves at least one top 25 team
 * @param {string} homeTeam
 * @param {string} awayTeam
 * @returns {boolean}
 */
export const isTop25Game = (homeTeam, awayTeam) => {
  return isTop25Team(homeTeam) || isTop25Team(awayTeam);
};
