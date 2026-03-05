// College Basketball ML Predictions Utility
// Loads ML predictions from cbb_ml_predictions.json
// Includes momentum/streak-aware predictions

export const loadCBBMLPredictions = (games) => {
  try {
    // Try to load predictions from JSON file
    const predictions = require('../cbb_ml_predictions.json');
    console.log(`🤖 Loaded ${predictions.length} CBB ML predictions`);

    const predictionMap = {};
    let matchCount = 0;

    games.forEach(game => {
      const gameId = game.id;
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;

      console.log(`🔍 Looking for prediction: ${awayTeam} @ ${homeTeam}`);

      // Find matching prediction (try exact match first)
      let pred = predictions.find(p =>
        (p.home_team === homeTeam && p.away_team === awayTeam)
      );

      // Try case-insensitive partial match
      if (!pred) {
        pred = predictions.find(p => {
          const homeMatch = p.home_team.toLowerCase().includes(homeTeam.toLowerCase()) ||
                           homeTeam.toLowerCase().includes(p.home_team.toLowerCase());
          const awayMatch = p.away_team.toLowerCase().includes(awayTeam.toLowerCase()) ||
                           awayTeam.toLowerCase().includes(p.away_team.toLowerCase());
          return homeMatch && awayMatch;
        });
      }

      // Try matching by team keywords (Duke, Kentucky, etc.)
      if (!pred) {
        pred = predictions.find(p => {
          const homeWords = homeTeam.split(' ');
          const awayWords = awayTeam.split(' ');
          const predHomeWords = p.home_team.split(' ');
          const predAwayWords = p.away_team.split(' ');

          const homeMatch = homeWords.some(word =>
            predHomeWords.some(pw => pw.toLowerCase() === word.toLowerCase() && word.length > 3)
          );
          const awayMatch = awayWords.some(word =>
            predAwayWords.some(pw => pw.toLowerCase() === word.toLowerCase() && word.length > 3)
          );

          return homeMatch && awayMatch;
        });
      }

      if (pred) {
        matchCount++;
        console.log(`✅ Using ML prediction for ${awayTeam} @ ${homeTeam}`);

        // Log momentum indicators
        if (pred.home_streak || pred.away_streak) {
          console.log(`  📈 Momentum: Home ${pred.home_streak || 0} streak | Away ${pred.away_streak || 0} streak`);
        }

        predictionMap[gameId] = {
          [`${homeTeam}_ml`]: pred.home_win_prob || 50,
          [`${awayTeam}_ml`]: pred.away_win_prob || 50,
          [`${homeTeam}_spread`]: pred.home_spread_prob || 50,
          [`${awayTeam}_spread`]: pred.away_spread_prob || 50,
          'over': pred.over_prob || 50,
          'under': pred.under_prob || 50,

          // CBB-specific metadata
          _hasMLPredictions: true,  // THIS IS THE KEY FLAG
          _homeStreak: pred.home_streak || 0,
          _awayStreak: pred.away_streak || 0,
          _isNeutralSite: pred.is_neutral_site || false,
          _predictedSpread: pred.predicted_spread,
          _predictedTotal: pred.predicted_total
        };
      } else {
        console.log(`❌ No ML prediction found for ${awayTeam} @ ${homeTeam}`);
      }
    });

    console.log(`🎯 Matched ${matchCount} out of ${games.length} games with ML predictions`);
    return predictionMap;
  } catch (error) {
    console.log('⚠️ No CBB ML predictions found, using implied odds fallback');
    console.error(error);
    return {};
  }
};
