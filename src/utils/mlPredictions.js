import mlPredictionsAll from '../ml_predictions_all.json';

/**
 * Load ML model predictions (Win/Spread/Totals) and map them to game format
 * @param {Array} games - Games from the odds API
 * @returns {Object} - Predictions object keyed by game ID
 */
export const loadMLPredictions = (games) => {
  const predictions = {};

  games.forEach(game => {
    const homeTeam = game.home_team;
    const awayTeam = game.away_team;

    // Find matching prediction
    const prediction = mlPredictionsAll.find(
      pred => pred.home_team === homeTeam && pred.away_team === awayTeam
    );

    if (prediction) {
      // Calculate over/under probabilities based on predicted total vs actual line
      let overProb = 50.0;
      let underProb = 50.0;

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
export const getConfidenceLevel = (probability) => {
  if (probability >= 70) return 'High';
  if (probability >= 60) return 'Medium';
  if (probability >= 55) return 'Low';
  return 'Toss-up';
};

/**
 * Check if ML model recommends this bet
 * @param {number} mlProb - ML model probability
 * @param {number} marketOdds - American odds from bookmaker
 * @returns {boolean} - True if EV is positive
 */
export const isMLRecommended = (mlProb, marketOdds) => {
  // Simple check: if ML prob is higher than implied odds, it's recommended
  const impliedProb = marketOdds > 0
    ? (100 / (marketOdds + 100)) * 100
    : (Math.abs(marketOdds) / (Math.abs(marketOdds) + 100)) * 100;

  return mlProb > impliedProb;
};
