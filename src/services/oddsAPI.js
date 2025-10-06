import axios from 'axios';

const API_KEY = 'e514f85edc19264c12ee274c2df7f21c';
const BASE_URL = 'https://api.the-odds-api.com/v4';

export const getNFLOdds = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/sports/americanfootball_nfl/odds`, {
      params: {
        apiKey: API_KEY,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching odds:', error);
    throw error;
  }
};

export const getPlayerProps = async (eventId) => {
  try {
    const playerPropMarkets = [
      'player_pass_yds',
      'player_pass_tds',
      'player_pass_completions',
      'player_pass_attempts',
      'player_pass_interceptions',
      'player_pass_longest_completion',
      'player_rush_yds',
      'player_rush_attempts',
      'player_rush_tds',
      'player_rush_longest',
      'player_reception_yds',
      'player_receptions',
      'player_reception_tds',
      'player_reception_longest',
      'player_anytime_td'
    ].join(',');

    const response = await axios.get(
      `${BASE_URL}/sports/americanfootball_nfl/events/${eventId}/odds`,
      {
        params: {
          apiKey: API_KEY,
          regions: 'us',
          markets: playerPropMarkets,
          oddsFormat: 'american'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching player props:', error);
    throw error;
  }
};