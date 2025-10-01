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