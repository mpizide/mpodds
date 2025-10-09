/**
 * Cache Service - Reduces API calls by caching odds data
 * Cache duration: 15 minutes (odds don't change frequently)
 */

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

export const cacheService = {
  /**
   * Get cached data if it exists and is not expired
   * @param {string} key - Cache key
   * @returns {object|null} - Cached data or null if expired/missing
   */
  get: (key) => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - timestamp > CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return { data, timestamp };
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  },

  /**
   * Set data in cache with current timestamp
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  set: (key, data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error writing cache:', error);
    }
  },

  /**
   * Clear specific cache key
   * @param {string} key - Cache key
   */
  clear: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  },

  /**
   * Clear all cached data
   */
  clearAll: () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('odds_cache_') || key.startsWith('props_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  },

  /**
   * Get time remaining until cache expires
   * @param {number} timestamp - Cache timestamp
   * @returns {number} - Milliseconds until expiration
   */
  getTimeRemaining: (timestamp) => {
    const now = Date.now();
    const remaining = CACHE_DURATION - (now - timestamp);
    return Math.max(0, remaining);
  },

  /**
   * Format cache age for display
   * @param {number} timestamp - Cache timestamp
   * @returns {string} - Human readable time since cached
   */
  formatAge: (timestamp) => {
    const now = Date.now();
    const ageMs = now - timestamp;
    const ageMinutes = Math.floor(ageMs / 60000);
    const ageSeconds = Math.floor((ageMs % 60000) / 1000);

    if (ageMinutes > 0) {
      return `${ageMinutes}m ${ageSeconds}s ago`;
    }
    return `${ageSeconds}s ago`;
  }
};
