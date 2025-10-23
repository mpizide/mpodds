import axios from 'axios';
import { cacheService } from './cacheService';

const API_KEY = process.env.REACT_APP_ODDS_API_KEY || 'e514f85edc19264c12ee274c2df7f21c';
const BASE_URL = 'https://api.the-odds-api.com/v4';

const NFL_ODDS_CACHE_KEY = 'odds_cache_nfl';

export const getNFLOdds = async (forceRefresh = false) => {
  try {
    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = cacheService.get(NFL_ODDS_CACHE_KEY);
      if (cached) {
        console.log(`✅ Using cached odds (${cacheService.formatAge(cached.timestamp)})`);
        return { data: cached.data, cached: true, timestamp: cached.timestamp };
      }
    }

    // Fetch fresh data from API
    console.log('🔄 Fetching fresh odds from API...');
    const response = await axios.get(`${BASE_URL}/sports/americanfootball_nfl/odds`, {
      params: {
        apiKey: API_KEY,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american'
      }
    });

    // Cache the response
    cacheService.set(NFL_ODDS_CACHE_KEY, response.data);
    console.log('✅ Odds cached successfully');

    return { data: response.data, cached: false, timestamp: Date.now() };
  } catch (error) {
    console.error('Error fetching odds:', error);

    // Try to return stale cache as fallback
    const cached = cacheService.get(NFL_ODDS_CACHE_KEY);
    if (cached) {
      console.warn('⚠️ Using stale cache due to API error');
      return { data: cached.data, cached: true, timestamp: cached.timestamp, stale: true };
    }

    throw error;
  }
};

export const getPlayerProps = async (eventId, forceRefresh = false) => {
  try {
    const cacheKey = `props_cache_${eventId}`;

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log(`✅ Using cached props for ${eventId} (${cacheService.formatAge(cached.timestamp)})`);
        return { data: cached.data, cached: true, timestamp: cached.timestamp };
      }
    }

    // Fetch fresh data from API
    console.log(`🔄 Fetching fresh props for ${eventId}...`);
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

    // Cache the response
    cacheService.set(cacheKey, response.data);
    console.log(`✅ Props for ${eventId} cached successfully`);

    return { data: response.data, cached: false, timestamp: Date.now() };
  } catch (error) {
    console.error('Error fetching player props:', error);

    // Try to return stale cache as fallback
    const cacheKey = `props_cache_${eventId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      console.warn(`⚠️ Using stale cache for ${eventId} due to API error`);
      return { data: cached.data, cached: true, timestamp: cached.timestamp, stale: true };
    }

    throw error;
  }
};

/**
 * Get College Football odds with caching
 * @param {boolean} forceRefresh - Force fresh API call
 * @returns {object} - { data, cached, timestamp }
 */
export const getCFBOdds = async (forceRefresh = false) => {
  try {
    const cacheKey = 'odds_cache_cfb';

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log(`✅ Using cached CFB odds (${cacheService.formatAge(cached.timestamp)})`);
        return { data: cached.data, cached: true, timestamp: cached.timestamp };
      }
    }

    // Fetch fresh data from API
    console.log('🔄 Fetching fresh CFB odds from API...');
    const response = await axios.get(`${BASE_URL}/sports/americanfootball_ncaaf/odds`, {
      params: {
        apiKey: API_KEY,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american'
      }
    });

    // Cache the response
    cacheService.set(cacheKey, response.data);
    console.log('✅ CFB odds cached successfully');

    return { data: response.data, cached: false, timestamp: Date.now() };
  } catch (error) {
    console.error('Error fetching CFB odds:', error);

    // Try to return stale cache as fallback
    const cached = cacheService.get('odds_cache_cfb');
    if (cached) {
      console.warn('⚠️ Using stale CFB cache due to API error');
      return { data: cached.data, cached: true, timestamp: cached.timestamp, stale: true };
    }

    throw error;
  }
};

/**
 * Get NBA odds with caching
 * @param {boolean} forceRefresh - Force fresh API call
 * @returns {object} - { data, cached, timestamp }
 */
export const getNBAOdds = async (forceRefresh = false) => {
  try {
    const cacheKey = 'odds_cache_nba';

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log(`✅ Using cached NBA odds (${cacheService.formatAge(cached.timestamp)})`);
        return { data: cached.data, cached: true, timestamp: cached.timestamp };
      }
    }

    // Fetch fresh data from API
    console.log('🔄 Fetching fresh NBA odds from API...');
    const response = await axios.get(`${BASE_URL}/sports/basketball_nba/odds`, {
      params: {
        apiKey: API_KEY,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american'
      }
    });

    // Cache the response
    cacheService.set(cacheKey, response.data);
    console.log('✅ NBA odds cached successfully');

    return { data: response.data, cached: false, timestamp: Date.now() };
  } catch (error) {
    console.error('Error fetching NBA odds:', error);

    // Try to return stale cache as fallback
    const cached = cacheService.get('odds_cache_nba');
    if (cached) {
      console.warn('⚠️ Using stale NBA cache due to API error');
      return { data: cached.data, cached: true, timestamp: cached.timestamp, stale: true };
    }

    throw error;
  }
};

/**
 * Get NBA player props with caching
 * @param {string} eventId - The event ID
 * @param {boolean} forceRefresh - Force fresh API call
 * @returns {object} - { data, cached, timestamp }
 */
export const getNBAPlayerProps = async (eventId, forceRefresh = false) => {
  try {
    const cacheKey = `nba_props_cache_${eventId}`;

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log(`✅ Using cached NBA props for ${eventId} (${cacheService.formatAge(cached.timestamp)})`);
        return { data: cached.data, cached: true, timestamp: cached.timestamp };
      }
    }

    // Fetch fresh data from API
    console.log(`🔄 Fetching fresh NBA props for ${eventId}...`);
    const playerPropMarkets = [
      'player_points',
      'player_rebounds',
      'player_assists',
      'player_threes',
      'player_blocks',
      'player_steals',
      'player_turnovers',
      'player_points_rebounds_assists',
      'player_points_rebounds',
      'player_points_assists',
      'player_rebounds_assists'
    ].join(',');

    const response = await axios.get(
      `${BASE_URL}/sports/basketball_nba/events/${eventId}/odds`,
      {
        params: {
          apiKey: API_KEY,
          regions: 'us',
          markets: playerPropMarkets,
          oddsFormat: 'american'
        }
      }
    );

    // Cache the response
    cacheService.set(cacheKey, response.data);
    console.log(`✅ NBA props for ${eventId} cached successfully`);

    return { data: response.data, cached: false, timestamp: Date.now() };
  } catch (error) {
    console.error('Error fetching NBA player props:', error);

    // Try to return stale cache as fallback
    const cacheKey = `nba_props_cache_${eventId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      console.warn(`⚠️ Using stale cache for ${eventId} due to API error`);
      return { data: cached.data, cached: true, timestamp: cached.timestamp, stale: true };
    }

    throw error;
  }
};

/**
 * Clear all cached odds data
 */
export const clearAllCache = () => {
  cacheService.clearAll();
  console.log('🗑️ All cache cleared');
};