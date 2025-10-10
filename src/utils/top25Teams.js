/**
 * AP Top 25 College Football Teams Rankings (Current - ESPN)
 * Used to filter which games to display and show rankings
 */
export const top25Rankings = {
  'Ohio State': 1, 'Ohio State Buckeyes': 1,
  'Miami': 2, 'Miami Hurricanes': 2,
  'Oregon': 3, 'Oregon Ducks': 3,
  'Ole Miss': 4, 'Ole Miss Rebels': 4, 'Mississippi': 4,
  'Texas A&M': 5, 'Texas A&M Aggies': 5,
  'Oklahoma': 6, 'Oklahoma Sooners': 6,
  'Indiana': 7, 'Indiana Hoosiers': 7,
  'Alabama': 8, 'Alabama Crimson Tide': 8,
  'Texas Tech': 9, 'Texas Tech Red Raiders': 9,
  'Georgia': 10, 'Georgia Bulldogs': 10,
  'LSU': 11, 'LSU Tigers': 11,
  'Tennessee': 12, 'Tennessee Volunteers': 12,
  'Georgia Tech': 13, 'Georgia Tech Yellow Jackets': 13,
  'Missouri': 14, 'Missouri Tigers': 14,
  'Michigan': 15, 'Michigan Wolverines': 15,
  'Notre Dame': 16, 'Notre Dame Fighting Irish': 16,
  'Illinois': 17, 'Illinois Fighting Illini': 17,
  'BYU': 18, 'BYU Cougars': 18,
  'Virginia': 19, 'Virginia Cavaliers': 19,
  'Vanderbilt': 20, 'Vanderbilt Commodores': 20,
  'Arizona State': 21, 'Arizona State Sun Devils': 21,
  'Iowa State': 22, 'Iowa State Cyclones': 22,
  'Memphis': 23, 'Memphis Tigers': 23,
  'South Florida': 24, 'South Florida Bulls': 24, 'USF': 24,
  'Florida State': 25, 'Florida State Seminoles': 25, 'FSU': 25
};

export const top25Teams = [
  'Ohio State', 'Miami', 'Oregon', 'Ole Miss', 'Texas A&M',
  'Oklahoma', 'Indiana', 'Alabama', 'Texas Tech', 'Georgia',
  'LSU', 'Tennessee', 'Georgia Tech', 'Missouri', 'Michigan',
  'Notre Dame', 'Illinois', 'BYU', 'Virginia', 'Vanderbilt',
  'Arizona State', 'Iowa State', 'Memphis', 'South Florida', 'Florida State'
];

/**
 * Get team ranking if in top 25
 * @param {string} teamName - Team name from API
 * @returns {number|null} - Ranking number or null
 */
export const getTeamRanking = (teamName) => {
  // Try exact match first
  if (top25Rankings[teamName]) {
    return top25Rankings[teamName];
  }

  // Convert to lowercase for comparison
  const lowerTeam = teamName.toLowerCase();

  // Try exact match with mascot variations
  const foundKey = Object.keys(top25Rankings).find(key => {
    const lowerKey = key.toLowerCase();

    // Exact match (case insensitive)
    if (lowerTeam === lowerKey) return true;

    // Check if key is mascot and team is full name (e.g., "Miami" matches "Miami Hurricanes")
    // But ONLY if they're the same base school
    const teamWords = lowerTeam.split(' ');
    const keyWords = lowerKey.split(' ');

    // If the key has multiple words, require exact match to avoid "Illinois" matching "Northern Illinois"
    if (keyWords.length > 1) {
      return lowerTeam === lowerKey;
    }

    // For single word keys (like "Miami", "Illinois", "Georgia"), only match if:
    // 1. Team name starts with the key (e.g., "Miami Hurricanes" starts with "Miami")
    // 2. AND it's not preceded by another word (e.g., "Northern Illinois" should NOT match "Illinois")
    if (keyWords.length === 1) {
      const singleKey = keyWords[0];

      // Team must start with the key OR be exact match
      if (teamWords[0] === singleKey) {
        return true;
      }

      // Also allow exact match with mascot
      if (lowerTeam === `${singleKey} ${getMascotForKey(key)}`.toLowerCase()) {
        return true;
      }
    }

    return false;
  });

  return foundKey ? top25Rankings[foundKey] : null;
};

// Helper to get mascot name from ranking key
const getMascotForKey = (key) => {
  const mascots = {
    'Ohio State': 'Buckeyes',
    'Miami': 'Hurricanes',
    'Oregon': 'Ducks',
    'Ole Miss': 'Rebels',
    'Texas A&M': 'Aggies',
    'Oklahoma': 'Sooners',
    'Indiana': 'Hoosiers',
    'Alabama': 'Crimson Tide',
    'Texas Tech': 'Red Raiders',
    'Georgia': 'Bulldogs',
    'LSU': 'Tigers',
    'Tennessee': 'Volunteers',
    'Georgia Tech': 'Yellow Jackets',
    'Missouri': 'Tigers',
    'Michigan': 'Wolverines',
    'Notre Dame': 'Fighting Irish',
    'Illinois': 'Fighting Illini',
    'BYU': 'Cougars',
    'Virginia': 'Cavaliers',
    'Vanderbilt': 'Commodores',
    'Arizona State': 'Sun Devils',
    'Iowa State': 'Cyclones',
    'Memphis': 'Tigers',
    'South Florida': 'Bulls',
    'Florida State': 'Seminoles'
  };
  return mascots[key] || '';
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
