import playerPropPredictions from '../nfl_player_prop_predictions.json';

// Map market keys to prediction keys
const marketToPredictionMap = {
  'player_pass_yds': 'predicted_passing_yards',
  'player_pass_tds': 'predicted_passing_tds',
  'player_rush_yds': 'predicted_rushing_yards',
  'player_rush_tds': 'predicted_rushing_tds',
  'player_reception_yds': 'predicted_receiving_yards',
  'player_reception_tds': 'predicted_receiving_tds',
  'player_receptions': 'predicted_receptions'
};

// Calculate probability of over/under based on ML prediction and line
export const calculatePropProbability = (playerName, marketKey, line) => {
  // Find player prediction
  const playerPred = playerPropPredictions.find(p => p.player_name === playerName);

  if (!playerPred) {
    return { overProb: 50, underProb: 50 }; // Default 50/50 if no prediction
  }

  const predictionKey = marketToPredictionMap[marketKey];
  if (!predictionKey || !playerPred[predictionKey]) {
    return { overProb: 50, underProb: 50 };
  }

  const prediction = playerPred[predictionKey];

  // Calculate probability based on distance from line
  // Using normal distribution approximation
  const diff = prediction - line;

  // Standard deviations by stat type (estimated from MAE)
  const stdDevMap = {
    'predicted_passing_yards': 71,
    'predicted_passing_tds': 0.88,
    'predicted_rushing_yards': 15.7,
    'predicted_rushing_tds': 0.27,
    'predicted_receiving_yards': 19.1,
    'predicted_receiving_tds': 0.28,
    'predicted_receptions': 1.45
  };

  const stdDev = stdDevMap[predictionKey] || 10;

  // Z-score
  const z = diff / stdDev;

  // Convert to probability using normal CDF approximation
  const overProb = normalCDF(z);
  const underProb = 100 - overProb;

  return {
    overProb: Math.max(30, Math.min(70, overProb)), // Cap between 30-70%
    underProb: Math.max(30, Math.min(70, underProb)),
    prediction: prediction
  };
};

// Normal CDF approximation
function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  if (z > 0) {
    prob = 1 - prob;
  }

  return prob * 100; // Return as percentage
}

// Get all predictions for a player
export const getPlayerPredictions = (playerName) => {
  return playerPropPredictions.find(p => p.player_name === playerName) || null;
};
