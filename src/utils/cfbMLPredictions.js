import cfbMLPredictionsData from '../cfb_ml_predictions.json';

// Map full team names to names used in ML predictions
const teamNameMapping = {
  // Top 25 teams
  'Ohio State': 'Ohio State',
  'Ohio State Buckeyes': 'Ohio State',
  'Miami': 'Miami',
  'Miami Hurricanes': 'Miami',
  'Oregon': 'Oregon',
  'Oregon Ducks': 'Oregon',
  'Ole Miss': 'Ole Miss',
  'Ole Miss Rebels': 'Ole Miss',
  'Mississippi': 'Ole Miss',
  'Texas A&M': 'Texas A&M',
  'Texas A&M Aggies': 'Texas A&M',
  'Oklahoma': 'Oklahoma',
  'Oklahoma Sooners': 'Oklahoma',
  'Indiana': 'Indiana',
  'Indiana Hoosiers': 'Indiana',
  'Alabama': 'Alabama',
  'Alabama Crimson Tide': 'Alabama',
  'Texas Tech': 'Texas Tech',
  'Texas Tech Red Raiders': 'Texas Tech',
  'Georgia': 'Georgia',
  'Georgia Bulldogs': 'Georgia',
  'LSU': 'LSU',
  'LSU Tigers': 'LSU',
  'Tennessee': 'Tennessee',
  'Tennessee Volunteers': 'Tennessee',
  'Georgia Tech': 'Georgia Tech',
  'Georgia Tech Yellow Jackets': 'Georgia Tech',
  'Missouri': 'Missouri',
  'Missouri Tigers': 'Missouri',
  'Michigan': 'Michigan',
  'Michigan Wolverines': 'Michigan',
  'Notre Dame': 'Notre Dame',
  'Notre Dame Fighting Irish': 'Notre Dame',
  'Illinois': 'Illinois',
  'Illinois Fighting Illini': 'Illinois',
  'BYU': 'BYU',
  'BYU Cougars': 'BYU',
  'Virginia': 'Virginia',
  'Virginia Cavaliers': 'Virginia',
  'Vanderbilt': 'Vanderbilt',
  'Vanderbilt Commodores': 'Vanderbilt',
  'Arizona State': 'Arizona State',
  'Arizona State Sun Devils': 'Arizona State',
  'Iowa State': 'Iowa State',
  'Iowa State Cyclones': 'Iowa State',
  'Memphis': 'Memphis',
  'Memphis Tigers': 'Memphis',
  'South Florida': 'South Florida',
  'South Florida Bulls': 'South Florida',
  'USF': 'South Florida',
  'Florida State': 'Florida State',
  'Florida State Seminoles': 'Florida State',
  'FSU': 'Florida State',

  // Other common teams
  'Penn State': 'Penn State',
  'Penn State Nittany Lions': 'Penn State',
  'North Carolina': 'North Carolina',
  'North Carolina Tar Heels': 'North Carolina',
  'UNC': 'North Carolina',
  'Washington': 'Washington',
  'Washington Huskies': 'Washington',
  'Mississippi State': 'Mississippi State',
  'Mississippi State Bulldogs': 'Mississippi State',
  'South Carolina': 'South Carolina',
  'South Carolina Gamecocks': 'South Carolina',
  'Nebraska': 'Nebraska',
  'Nebraska Cornhuskers': 'Nebraska',
  'Baylor': 'Baylor',
  'Baylor Bears': 'Baylor',
  'Texas': 'Texas',
  'Texas Longhorns': 'Texas',
  'Auburn': 'Auburn',
  'Auburn Tigers': 'Auburn',
  'Arizona': 'Arizona',
  'Arizona Wildcats': 'Arizona',
  'Ball State': 'Ball State',
  'Ball State Cardinals': 'Ball State',
  'Cincinnati': 'Cincinnati',
  'Cincinnati Bearcats': 'Cincinnati',
  'Duke': 'Duke',
  'Duke Blue Devils': 'Duke'
};

/**
 * Normalize team name to match ML predictions format
 */
const normalizeTeamName = (teamName) => {
  // Try exact match first
  if (teamNameMapping[teamName]) {
    return teamNameMapping[teamName];
  }

  // Try to find partial match
  const foundKey = Object.keys(teamNameMapping).find(key => {
    const lowerTeam = teamName.toLowerCase();
    const lowerKey = key.toLowerCase();

    // Split into words for first-word matching
    const teamWords = lowerTeam.split(' ');
    const keyWords = lowerKey.split(' ');

    // First word must match exactly (prevents "Northern Illinois" matching "Illinois")
    if (teamWords[0] === keyWords[0]) {
      return true;
    }

    return false;
  });

  if (foundKey) {
    return teamNameMapping[foundKey];
  }

  // Return original if no mapping found
  return teamName;
};

/**
 * Load CFB ML model predictions and map them to game format
 * @param {Array} games - Games from the odds API
 * @returns {Object} - Predictions object keyed by game ID
 */
export const loadCFBMLPredictions = (games) => {
  const predictions = {};

  games.forEach(game => {
    const homeTeam = game.home_team;
    const awayTeam = game.away_team;

    // Normalize team names to match ML predictions
    const homeNormalized = normalizeTeamName(homeTeam);
    const awayNormalized = normalizeTeamName(awayTeam);

    // Find matching prediction
    const prediction = cfbMLPredictionsData.find(
      pred => pred.home_team === homeNormalized && pred.away_team === awayNormalized
    );

    if (prediction) {
      // Calculate over/under probabilities based on predicted total vs actual line
      let overProb = prediction.over_prob || 50.0;
      let underProb = prediction.under_prob || 50.0;

      // Try to get the total line from bookmakers
      const totalsMarket = game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals');
      if (totalsMarket && totalsMarket.outcomes && prediction.predicted_total) {
        const line = totalsMarket.outcomes[0]?.point;
        if (line) {
          // If predicted total > line, favor over
          // Simple heuristic: 5 point difference = ~10% probability shift
          const diff = prediction.predicted_total - line;
          const probShift = Math.min(Math.abs(diff) * 2, 20); // Max 20% shift

          if (diff > 0) {
            overProb = Math.min(50 + probShift, 70);
            underProb = 100 - overProb;
          } else if (diff < 0) {
            underProb = Math.min(50 + probShift, 70);
            overProb = 100 - underProb;
          }
        }
      }

      predictions[game.id] = {
        // Moneyline predictions
        [`${homeTeam}_ml`]: prediction.home_win_prob.toString(),
        [`${awayTeam}_ml`]: prediction.away_win_prob.toString(),

        // Spread predictions (use spread-specific probabilities)
        [`${homeTeam}_spread`]: prediction.home_spread_prob.toString(),
        [`${awayTeam}_spread`]: prediction.away_spread_prob.toString(),

        // Totals predictions
        'over': overProb.toFixed(1),
        'under': underProb.toFixed(1),

        // Store predicted values for reference
        '_predicted_spread': prediction.predicted_spread,
        '_predicted_total': prediction.predicted_total
      };
    }
  });

  return predictions;
};

/**
 * Get ML prediction confidence level
 * @param {number} probability - Win probability (0-100)
 * @returns {string} - Confidence level
 */
export const getCFBConfidenceLevel = (probability) => {
  if (probability >= 70) return 'High';
  if (probability >= 60) return 'Medium';
  if (probability >= 55) return 'Low';
  return 'Toss-up';
};

/**
 * Check if CFB ML model recommends this bet
 * @param {number} mlProb - ML model probability
 * @param {number} marketOdds - American odds from bookmaker
 * @returns {boolean} - True if EV is positive
 */
export const isCFBMLRecommended = (mlProb, marketOdds) => {
  // Simple check: if ML prob is higher than implied odds, it's recommended
  const impliedProb = marketOdds > 0
    ? (100 / (marketOdds + 100)) * 100
    : (Math.abs(marketOdds) / (Math.abs(marketOdds) + 100)) * 100;

  return mlProb > impliedProb;
};
