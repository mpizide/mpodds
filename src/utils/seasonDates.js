// Football season dates are anchored to Labor Day (first Monday of September),
// so week numbers stay correct every year without hardcoding a start date.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const getLaborDay = (year) => {
  const sept1 = new Date(year, 8, 1);
  const daysUntilMonday = (1 - sept1.getDay() + 7) % 7;
  return new Date(year, 8, 1 + daysUntilMonday);
};

// Games in Jan-Jun (playoffs, bowls) belong to the previous year's season
const getSeasonYear = (date) => (date.getMonth() < 6 ? date.getFullYear() - 1 : date.getFullYear());

// Football season label, e.g. a January 2027 playoff game is the 2026 season
export const getFootballSeason = (date = new Date()) => getSeasonYear(new Date(date));

// Basketball seasons span two years and are labeled by the year they end,
// e.g. Nov 2026 and Mar 2027 are both the 2027 (2026-27) season
export const getBasketballSeason = (date = new Date()) => {
  const d = new Date(date);
  return d.getMonth() >= 7 ? d.getFullYear() + 1 : d.getFullYear();
};

// NFL Week 1 starts the Thursday after Labor Day (e.g. Sept 4, 2025)
export const getNFLSeasonStart = (year) => new Date(getLaborDay(year).getTime() + 3 * DAY_MS);

// CFB Week 1 starts the Thursday before Labor Day (e.g. Aug 28, 2025)
export const getCFBSeasonStart = (year) => new Date(getLaborDay(year).getTime() - 4 * DAY_MS);

const getWeekNumber = (gameTime, getSeasonStart) => {
  const gameDate = new Date(gameTime);
  const seasonStart = getSeasonStart(getSeasonYear(gameDate));
  return Math.floor((gameDate - seasonStart) / WEEK_MS) + 1;
};

export const getNFLWeek = (gameTime) => getWeekNumber(gameTime, getNFLSeasonStart);
export const getCFBWeek = (gameTime) => getWeekNumber(gameTime, getCFBSeasonStart);
