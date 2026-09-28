import axios from 'axios';
import { cacheService } from './cacheService';
import { getMLBTeam } from '../utils/mlbTeams';

const STATS_API = 'https://statsapi.mlb.com/api/v1';
const SAVANT = 'https://baseballsavant.mlb.com/leaderboard';

// ---------------------------------------------------------------------------
// Percentile metric definitions (Baseball Savant style)
// `pct` = column in Savant's percentile-rankings CSV (already oriented so higher = better)
// `raw` = column holding the actual stat value (custom / statcast / arm strength leaderboards)
// `higher` = whether a bigger raw value is better (used for estimated percentiles)
// ---------------------------------------------------------------------------

const rate3 = (v) => v.toFixed(3).replace(/^0/, '');
const dec1 = (v) => v.toFixed(1);
const dec2 = (v) => v.toFixed(2);
const int0 = (v) => Math.round(v).toString();

export const BATTER_METRICS = [
  { section: 'Batting', label: 'xwOBA', pct: 'xwoba', raw: 'xwoba', fmt: rate3, higher: true },
  { section: 'Batting', label: 'xBA', pct: 'xba', raw: 'xba', fmt: rate3, higher: true },
  { section: 'Batting', label: 'xSLG', pct: 'xslg', raw: 'xslg', fmt: rate3, higher: true },
  { section: 'Batting', label: 'xOBP', pct: 'xobp', raw: 'xobp', fmt: rate3, higher: true },
  { section: 'Batting', label: 'xISO', pct: 'xiso', raw: 'xiso', fmt: rate3, higher: true },
  { section: 'Batting', label: 'Avg Exit Velo', pct: 'exit_velocity', raw: 'exit_velocity_avg', fmt: dec1, higher: true },
  { section: 'Batting', label: 'Max Exit Velo', pct: 'max_ev', raw: 'max_hit_speed', fmt: dec1, higher: true },
  { section: 'Batting', label: 'Barrel %', pct: 'brl_percent', raw: 'barrel_batted_rate', fmt: dec1, higher: true },
  { section: 'Batting', label: 'Hard-Hit %', pct: 'hard_hit_percent', raw: 'hard_hit_percent', fmt: dec1, higher: true },
  { section: 'Batting', label: 'LA Sweet-Spot %', pct: null, raw: 'sweet_spot_percent', fmt: dec1, higher: true },
  { section: 'Batting', label: 'Bat Speed', pct: 'bat_speed', raw: 'avg_swing_speed', fmt: dec1, higher: true },
  { section: 'Batting', label: 'Squared-Up %', pct: 'squared_up_rate', raw: 'squared_up_swing', fmt: dec1, higher: true },
  { section: 'Batting', label: 'Swing Length', pct: 'swing_length', raw: 'avg_swing_length', fmt: dec1, higher: true },
  { section: 'Batting', label: 'Chase %', pct: 'chase_percent', raw: 'oz_swing_percent', fmt: dec1, higher: false },
  { section: 'Batting', label: 'Whiff %', pct: 'whiff_percent', raw: 'whiff_percent', fmt: dec1, higher: false },
  { section: 'Batting', label: 'K %', pct: 'k_percent', raw: 'k_percent', fmt: dec1, higher: false },
  { section: 'Batting', label: 'BB %', pct: 'bb_percent', raw: 'bb_percent', fmt: dec1, higher: true },
  { section: 'Fielding', label: 'Range (OAA)', pct: 'oaa', raw: 'n_outs_above_average', fmt: int0, higher: true },
  { section: 'Fielding', label: 'Arm Strength', pct: 'arm_strength', raw: 'arm_overall', fmt: dec1, higher: true },
  { section: 'Running', label: 'Sprint Speed', pct: 'sprint_speed', raw: 'sprint_speed', fmt: dec1, higher: true }
];

export const PITCHER_METRICS = [
  { section: 'Pitching', label: 'xERA', pct: 'xera', raw: 'xera', fmt: dec2, higher: false },
  { section: 'Pitching', label: 'xwOBA', pct: 'xwoba', raw: 'xwoba', fmt: rate3, higher: false },
  { section: 'Pitching', label: 'xBA', pct: 'xba', raw: 'xba', fmt: rate3, higher: false },
  { section: 'Pitching', label: 'xSLG', pct: 'xslg', raw: 'xslg', fmt: rate3, higher: false },
  { section: 'Pitching', label: 'Avg Exit Velo', pct: 'exit_velocity', raw: 'exit_velocity_avg', fmt: dec1, higher: false },
  { section: 'Pitching', label: 'Barrel %', pct: 'brl_percent', raw: 'barrel_batted_rate', fmt: dec1, higher: false },
  { section: 'Pitching', label: 'Hard-Hit %', pct: 'hard_hit_percent', raw: 'hard_hit_percent', fmt: dec1, higher: false },
  { section: 'Pitching', label: 'Chase %', pct: 'chase_percent', raw: 'oz_swing_percent', fmt: dec1, higher: true },
  { section: 'Pitching', label: 'Whiff %', pct: 'whiff_percent', raw: 'whiff_percent', fmt: dec1, higher: true },
  { section: 'Pitching', label: 'K %', pct: 'k_percent', raw: 'k_percent', fmt: dec1, higher: true },
  { section: 'Pitching', label: 'BB %', pct: 'bb_percent', raw: 'bb_percent', fmt: dec1, higher: false },
  { section: 'Pitch Arsenal', label: 'Fastball Velo', pct: 'fb_velocity', raw: 'ff_avg_speed', fmt: dec1, higher: true },
  { section: 'Pitch Arsenal', label: 'Fastball Spin', pct: 'fb_spin', raw: 'ff_avg_spin', fmt: int0, higher: true },
  { section: 'Pitch Arsenal', label: 'Curve Spin', pct: 'curve_spin', raw: 'cu_avg_spin', fmt: int0, higher: true }
];

// Raw columns that come from the statcast / arm strength leaderboards instead of the custom one
const NON_CUSTOM_RAW = ['max_hit_speed', 'arm_overall'];

// Minimum sample before we estimate a percentile for a non-qualified player
const MIN_PA_FOR_ESTIMATE = 20;

// Recent games used to project a lineup when the official one isn't posted
const PROJECTION_GAMES = 7;

// ---------------------------------------------------------------------------
// Savant CSV loading
// ---------------------------------------------------------------------------

// Minimal CSV parser that handles quoted fields and the UTF-8 BOM Savant sends
const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const [header = [], ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
};

// Keep only the numeric columns we care about, keyed by player_id
const indexById = (rows, columns) => {
  const out = {};
  rows.forEach(r => {
    const id = r.player_id;
    if (!id) return;
    const entry = {};
    columns.forEach(col => {
      const v = r[col];
      if (v !== undefined && v !== '') {
        const num = parseFloat(v);
        if (!Number.isNaN(num)) entry[col] = num;
      }
    });
    out[id] = entry;
  });
  return out;
};

const fetchCSV = async (url) => {
  const response = await axios.get(url, { responseType: 'text' });
  return parseCSV(response.data);
};

// Fetch a CSV but don't let one optional leaderboard break the whole page
const fetchOptionalCSV = (url) => fetchCSV(url).catch(err => {
  console.warn(`⚠️ Could not load ${url}`, err);
  return [];
});

const combine = (pctRows, rawMaps, metrics) => {
  const pct = indexById(pctRows, metrics.map(m => m.pct).filter(Boolean));
  const ids = new Set([...Object.keys(pct), ...rawMaps.flatMap(m => Object.keys(m))]);
  const out = {};
  ids.forEach(id => {
    out[id] = {
      pct: pct[id] || {},
      raw: Object.assign({}, ...rawMaps.map(m => m[id] || {}))
    };
  });
  return out;
};

/**
 * Load Savant percentile rankings + raw values for batters and pitchers.
 * @returns {object} - { batters: {id: {pct, raw}}, pitchers: {id: {pct, raw}} }
 */
export const getSavantData = async (season, forceRefresh = false) => {
  const cacheKey = `mlb_savant_${season}`;

  if (!forceRefresh) {
    const cached = cacheService.get(cacheKey);
    if (cached) return cached.data;
  }

  const customCols = (metrics) => [
    ...new Set(metrics.map(m => m.raw).filter(c => !NON_CUSTOM_RAW.includes(c))),
    'pa'
  ];
  const batterCols = customCols(BATTER_METRICS);
  const pitcherCols = customCols(PITCHER_METRICS);

  console.log('🔄 Fetching Savant percentile rankings...');
  const [batPct, pitPct, batVals, pitVals, statcast, arm] = await Promise.all([
    fetchCSV(`${SAVANT}/percentile-rankings?type=batter&year=${season}&csv=true`),
    fetchCSV(`${SAVANT}/percentile-rankings?type=pitcher&year=${season}&csv=true`),
    fetchCSV(`${SAVANT}/custom?year=${season}&type=batter&min=1&selections=${batterCols.join(',')}&csv=true`),
    fetchCSV(`${SAVANT}/custom?year=${season}&type=pitcher&min=1&selections=${pitcherCols.join(',')}&csv=true`),
    fetchOptionalCSV(`${SAVANT}/statcast?type=batter&year=${season}&position=&team=&min=1&csv=true`),
    fetchOptionalCSV(`${SAVANT}/arm-strength?type=player&year=${season}&minThrows=1&pos=&team=&csv=true`)
  ]);

  const data = {
    batters: combine(batPct, [
      indexById(batVals, batterCols),
      indexById(statcast, ['max_hit_speed']),
      indexById(arm, ['arm_overall'])
    ], BATTER_METRICS),
    pitchers: combine(pitPct, [indexById(pitVals, pitcherCols)], PITCHER_METRICS)
  };

  cacheService.set(cacheKey, data);
  console.log(`✅ Savant data loaded: ${Object.keys(data.batters).length} batters, ${Object.keys(data.pitchers).length} pitchers`);
  return data;
};

/**
 * Build the percentile rows for one player.
 * Uses Savant's official percentile when the player qualifies; otherwise estimates it
 * by ranking the player's raw value against the qualified pool (flagged `estimated`).
 * @param {object} group - savantData.batters or savantData.pitchers
 * @returns {array} - [{ ...metric, value, percentile, estimated }]
 */
export const buildPercentiles = (group, playerId, metrics) => {
  const player = group?.[playerId];
  if (!player) return metrics.map(m => ({ ...m, value: null, percentile: null, estimated: false }));

  const sampleOk = (player.raw.pa ?? 0) >= MIN_PA_FOR_ESTIMATE;

  return metrics.map(m => {
    const value = player.raw[m.raw] ?? null;
    const official = m.pct ? player.pct[m.pct] : undefined;
    if (official !== undefined) {
      return { ...m, value, percentile: official, estimated: false };
    }
    if (value === null || !sampleOk) {
      return { ...m, value, percentile: null, estimated: false };
    }

    // Qualified pool: players with an official percentile for this metric
    // (or, for metrics Savant doesn't rank, players with an official xwOBA percentile)
    const qualifier = m.pct || 'xwoba';
    const pool = Object.values(group)
      .filter(p => p.pct[qualifier] !== undefined && p.raw[m.raw] !== undefined)
      .map(p => p.raw[m.raw]);
    if (pool.length < 20) return { ...m, value, percentile: null, estimated: false };

    const worse = pool.filter(v => (m.higher ? v < value : v > value)).length;
    const equal = pool.filter(v => v === value).length;
    const percentile = Math.min(100, Math.max(1, Math.round(((worse + equal / 2) / pool.length) * 100)));
    return { ...m, value, percentile, estimated: true };
  });
};

// ---------------------------------------------------------------------------
// MLB Stats API: schedule, lineups, players
// ---------------------------------------------------------------------------

const toISODate = (d) => d.toISOString().split('T')[0];

const addDays = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

/**
 * Get MLB schedule (with probable pitchers, lineups, records) for a date range
 */
export const getMLBSchedule = async (startDate, endDate, forceRefresh = false) => {
  const cacheKey = `mlb_schedule_${startDate}_${endDate}`;

  if (!forceRefresh) {
    const cached = cacheService.get(cacheKey);
    if (cached) return cached.data;
  }

  const response = await axios.get(`${STATS_API}/schedule`, {
    params: { sportId: 1, startDate, endDate, hydrate: 'probablePitcher,lineups,team' }
  });

  const games = (response.data.dates || []).flatMap(d => d.games);
  cacheService.set(cacheKey, games);
  return games;
};

/**
 * Schedule covering every game in a list of Odds API events
 */
export const getScheduleForOddsGames = async (oddsGames, forceRefresh = false) => {
  if (!oddsGames.length) return [];
  const times = oddsGames.map(g => new Date(g.commence_time).getTime());
  // MLB schedule dates are local (ET), so pad a day before the earliest UTC time
  const start = toISODate(addDays(new Date(Math.min(...times)), -1));
  const end = toISODate(new Date(Math.max(...times)));
  return getMLBSchedule(start, end, forceRefresh);
};

/**
 * Match an Odds API event to an MLB Stats API game (same teams, closest start time)
 */
export const matchScheduleGame = (oddsGame, scheduleGames) => {
  const homeId = getMLBTeam(oddsGame.home_team)?.id;
  const awayId = getMLBTeam(oddsGame.away_team)?.id;
  const start = new Date(oddsGame.commence_time).getTime();

  const candidates = scheduleGames.filter(g =>
    g.teams.home.team.id === homeId && g.teams.away.team.id === awayId
  );
  if (!candidates.length) return null;

  return candidates.reduce((best, g) =>
    Math.abs(new Date(g.gameDate) - start) < Math.abs(new Date(best.gameDate) - start) ? g : best
  );
};

/**
 * Get a team's lineup for a game. Uses the official lineup when posted;
 * otherwise projects it from the team's recent lineups.
 * @returns {object} - { players: [...], status: 'confirmed' | 'projected' | 'unavailable', gamesUsed }
 */
export const getTeamLineup = async (scheduleGame, side) => {
  const official = scheduleGame.lineups?.[`${side}Players`];
  if (official?.length) {
    return { players: official, status: 'confirmed', gamesUsed: 0 };
  }

  const teamId = scheduleGame.teams[side].team.id;
  const cacheKey = `mlb_projected_lineup_${teamId}_${scheduleGame.gamePk}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return cached.data;

  const gameDate = new Date(scheduleGame.gameDate);
  const response = await axios.get(`${STATS_API}/schedule`, {
    params: {
      sportId: 1,
      teamId,
      startDate: toISODate(addDays(gameDate, -14)),
      endDate: toISODate(gameDate),
      hydrate: 'lineups'
    }
  });

  const recentGames = (response.data.dates || [])
    .flatMap(d => d.games)
    .filter(g => g.gamePk !== scheduleGame.gamePk && new Date(g.gameDate) < gameDate)
    .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));

  // Project from the last few lineups so one rest day doesn't drop a regular:
  // take the 9 most frequent starters, ordered by their average batting slot
  const recentLineups = recentGames
    .map(g => g.lineups?.[`${g.teams.home.team.id === teamId ? 'home' : 'away'}Players`])
    .filter(players => players?.length)
    .slice(0, PROJECTION_GAMES);

  const starters = {};
  recentLineups.forEach((players, gameIndex) => {
    players.forEach((player, slot) => {
      if (!starters[player.id]) starters[player.id] = { player, starts: 0, slotTotal: 0, lastSeen: gameIndex };
      starters[player.id].starts += 1;
      starters[player.id].slotTotal += slot;
    });
  });

  const projected = Object.values(starters)
    .sort((a, b) => b.starts - a.starts || a.lastSeen - b.lastSeen)
    .slice(0, 9)
    .sort((a, b) => a.slotTotal / a.starts - b.slotTotal / b.starts)
    .map(s => ({ ...s.player, recentStarts: s.starts }));

  const result = projected.length
    ? { players: projected, status: 'projected', gamesUsed: recentLineups.length }
    : { players: [], status: 'unavailable', gamesUsed: 0 };

  cacheService.set(cacheKey, result);
  return result;
};

/**
 * Player bio + season stats for a list of player ids
 * @returns {object} - { [id]: { batSide, pitchHand, position, age, hitting, pitching } }
 */
export const getPlayers = async (playerIds, season) => {
  const ids = [...new Set(playerIds.filter(Boolean))];
  if (!ids.length) return {};

  const response = await axios.get(`${STATS_API}/people`, {
    params: {
      personIds: ids.join(','),
      hydrate: `stats(group=[hitting,pitching],type=[season],season=${season})`
    }
  });

  const players = {};
  (response.data.people || []).forEach(p => {
    const statFor = (group) =>
      p.stats?.find(s => s.group.displayName === group)?.splits?.[0]?.stat || null;
    players[p.id] = {
      id: p.id,
      fullName: p.fullName,
      batSide: p.batSide?.code,
      pitchHand: p.pitchHand?.code,
      position: p.primaryPosition?.abbreviation,
      age: p.currentAge,
      number: p.primaryNumber,
      hitting: statFor('hitting'),
      pitching: statFor('pitching')
    };
  });
  return players;
};
