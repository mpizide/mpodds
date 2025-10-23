// NBA Player Prop Predictions Utility
import nbaPlayerPropPredictions from '../nba_player_prop_predictions.json';

// Map market keys to prediction keys
const marketToPredictionMap = {
  'player_points': 'predicted_points',
  'player_rebounds': 'predicted_rebounds',
  'player_assists': 'predicted_assists',
  'player_threes': 'predicted_threes',
  'player_blocks': 'predicted_blocks',
  'player_steals': 'predicted_steals',
  'player_turnovers': 'predicted_turnovers',
  'player_points_rebounds_assists': 'predicted_pra',
  'player_points_rebounds': 'predicted_points_rebounds',
  'player_points_assists': 'predicted_points_assists',
  'player_rebounds_assists': 'predicted_rebounds_assists'
};

// Calculate probability of over/under based on ML prediction and line
export const calculateNBAPropProbability = (playerName, marketKey, line) => {
  // Find player prediction
  const playerPred = nbaPlayerPropPredictions.find(p => p.player_name === playerName);

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

  // Standard deviations by stat type (estimated based on NBA stats variance)
  const stdDevMap = {
    'predicted_points': 6.5,
    'predicted_rebounds': 2.8,
    'predicted_assists': 2.2,
    'predicted_threes': 1.1,
    'predicted_blocks': 0.6,
    'predicted_steals': 0.5,
    'predicted_turnovers': 0.9,
    'predicted_pra': 8.5,
    'predicted_points_rebounds': 7.2,
    'predicted_points_assists': 7.0,
    'predicted_rebounds_assists': 4.5
  };

  const stdDev = stdDevMap[predictionKey] || 5;

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
export const getNBAPlayerPredictions = (playerName) => {
  return nbaPlayerPropPredictions.find(p => p.player_name === playerName) || null;
};
