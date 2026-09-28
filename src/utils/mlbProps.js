// MLB batter props (hits / home runs / RBIs): market fair odds vs a stat projection
//
// Two independent opinions per prop:
//   market     - consensus no-vig probability across books (for one-sided markets like HR "yes",
//                each book's typical margin is estimated from its two-sided props in the same game)
//   projection - the hitter's season per-PA rates (shrunk toward league average), adjusted for the
//                opposing starter, times the expected plate appearances for his lineup spot
// A prop is flagged as value only when BOTH say the best available price is +EV.
import { americanToImplied, calculateEV } from './oddsCalculations';

export const PROP_MARKETS = {
  batter_hits: { label: 'Hits', short: 'H' },
  batter_home_runs: { label: 'Home Runs', short: 'HR' },
  batter_rbis: { label: 'RBIs', short: 'RBI' }
};

// League per-PA rates (recent MLB seasons) used as priors
const LEAGUE = { hits: 0.217, hr: 0.031, rbi: 0.115 };
const PRIOR_PA = { hits: 200, hr: 300, rbi: 250 };
const PITCHER_PRIOR_BF = 300;

// Average plate appearances by batting-order spot
const SLOT_PA = [4.65, 4.55, 4.45, 4.35, 4.25, 4.13, 4.02, 3.9, 3.78];
// Share of a hitter's PAs that come against the starter (roughly 2-3 times through the order)
const STARTER_SHARE = 0.6;
const DEFAULT_HOLD = 1.07;
const LEAGUE_RUNS_PER_TEAM_GAME = 4.45;

// Calibrated on 34k 2025 player-games (regulars, 3+ PA):
// - RBIs come in clumps: negative binomial with r = 0.9 matches P(1+ RBI) with ~0 bias
//   (Poisson overstated it by 6.5 points)
// - PA varies game to game: spreading expected PA by ±1 (25% each side) cuts the hits bias to 0.4 pts
const RBI_DISPERSION = 0.9;
const PA_SPREAD = 0.25;

// americanToImplied returns a percentage; the math below works in 0-1 probabilities
const implied = (odds) => americanToImplied(odds) / 100;

const normalizeName = (name) => (name || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\./g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
  .replace(/\s+/g, ' ').trim();

const shrink = (count, opportunities, leagueRate, priorN) =>
  ((count || 0) + leagueRate * priorN) / ((opportunities || 0) + priorN);

// ---- Distributions ---------------------------------------------------------

const choose = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

const binomAtLeast = (n, p, k) => {
  let below = 0;
  for (let i = 0; i < k && i <= n; i++) below += choose(n, i) * p ** i * (1 - p) ** (n - i);
  return Math.max(0, 1 - below);
};

// Expected PA is fractional and varies game to game: mix the neighbouring whole numbers,
// then spread each by ±1 PA (mean-preserving)
const atLeastWithVariablePA = (paExp, p, k) => {
  const lo = Math.floor(paExp);
  const w = paExp - lo;
  let total = 0;
  [[lo, 1 - w], [lo + 1, w]].forEach(([n, q]) => {
    [[-1, PA_SPREAD], [0, 1 - 2 * PA_SPREAD], [1, PA_SPREAD]].forEach(([d, qd]) => {
      total += q * qd * binomAtLeast(Math.max(n + d, 0), p, k);
    });
  });
  return total;
};

// Negative binomial with mean lambda and dispersion r: P(X >= k)
const negBinomAtLeast = (lambda, k, r = RBI_DISPERSION) => {
  const q = r / (r + lambda);
  let below = 0;
  let term = q ** r; // P(X = 0)
  for (let i = 0; i < k; i++) {
    below += term;
    term = (term * (r + i) * (1 - q)) / (i + 1);
  }
  return Math.max(0, 1 - below);
};

/**
 * Projected per-game rates and probabilities for one hitter
 * @param {object} hitting - season hitting stats (MLB Stats API)
 * @param {number} slot - 0-based batting order spot
 * @param {object|null} oppPitching - opposing starter's season pitching stats
 * @param {number|null} teamTotal - team's implied runs from the game odds (scales RBIs)
 */
export const projectBatter = (hitting, slot, oppPitching, teamTotal = null) => {
  const pa = hitting?.plateAppearances || 0;
  const bf = oppPitching?.battersFaced || 0;
  const factor = (pitcherCount, leagueRate) => {
    if (!oppPitching) return 1;
    const pitcherRate = shrink(pitcherCount, bf, leagueRate, PITCHER_PRIOR_BF);
    return STARTER_SHARE * (pitcherRate / leagueRate) + (1 - STARTER_SHARE);
  };

  const rates = {
    hits: shrink(hitting?.hits, pa, LEAGUE.hits, PRIOR_PA.hits) * factor(oppPitching?.hits, LEAGUE.hits),
    hr: shrink(hitting?.homeRuns, pa, LEAGUE.hr, PRIOR_PA.hr) * factor(oppPitching?.homeRuns, LEAGUE.hr),
    // RBIs track how many runs his team is expected to score (the game total already
    // prices in both pitchers, the park and the weather)
    rbi: shrink(hitting?.rbi, pa, LEAGUE.rbi, PRIOR_PA.rbi) * (teamTotal ? teamTotal / LEAGUE_RUNS_PER_TEAM_GAME : 1)
  };
  const paExp = SLOT_PA[Math.min(Math.max(slot, 0), 8)];

  return {
    paExp,
    expected: { hits: rates.hits * paExp, hr: rates.hr * paExp, rbi: rates.rbi * paExp },
    // P(stat > line) for a half-point line
    overProb: (market, line) => {
      const k = Math.floor(line) + 1;
      if (market === 'batter_hits') return atLeastWithVariablePA(paExp, rates.hits, k);
      if (market === 'batter_home_runs') return atLeastWithVariablePA(paExp, rates.hr, k);
      if (market === 'batter_rbis') return negBinomAtLeast(rates.rbi * paExp, k);
      return null;
    }
  };
};

// ---- Market ----------------------------------------------------------------

const median = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Group the event's prop outcomes: player -> market -> line -> [{ book, over, under }]
 * and estimate each book's margin from its two-sided props
 */
const organizeProps = (event) => {
  const byPlayer = {};
  const overrounds = {};
  (event?.bookmakers || []).forEach(book => {
    book.markets?.forEach(market => {
      if (!PROP_MARKETS[market.key]) return;
      const sides = {};
      market.outcomes?.forEach(o => {
        const key = `${normalizeName(o.description)}|${o.point}`;
        sides[key] = sides[key] || { name: o.description, line: o.point };
        sides[key][o.name === 'Over' ? 'over' : 'under'] = o.price;
      });
      Object.values(sides).forEach(s => {
        const player = normalizeName(s.name);
        byPlayer[player] = byPlayer[player] || {};
        byPlayer[player][market.key] = byPlayer[player][market.key] || {};
        const lines = byPlayer[player][market.key];
        lines[s.line] = lines[s.line] || [];
        lines[s.line].push({ book: book.title, over: s.over, under: s.under });
        if (s.over !== undefined && s.under !== undefined) {
          overrounds[book.title] = overrounds[book.title] || [];
          overrounds[book.title].push(implied(s.over) + implied(s.under));
        }
      });
    });
  });
  const hold = {};
  Object.entries(overrounds).forEach(([book, values]) => { hold[book] = median(values); });
  return { byPlayer, hold };
};

const bestSide = (quotes, side) => quotes
  .filter(q => q[side] !== undefined)
  .reduce((best, q) => (!best || q[side] > best.odds ? { odds: q[side], bookmaker: q.book } : best), null);

/**
 * Evaluate every prop for the lineup hitters and pick one standout per team
 * @param {object} event - Odds API event odds response
 * @param {object} lineups - { away: {players}, home: {players} }
 * @param {object} players - player info keyed by id (with hitting / pitching stats)
 * @param {object} probables - { away: pitcherId|null, home: pitcherId|null }
 * @param {object} teamTotals - { away: runs|null, home: runs|null } implied by the game odds
 * @returns {object} - { byPlayerId: {id: rows[]}, highlights: {away, home}, projections: {id} }
 */
export const evaluateMLBProps = (event, lineups, players, probables, teamTotals = {}) => {
  const { byPlayer, hold } = organizeProps(event);
  const byPlayerId = {};
  const projections = {};
  const highlights = { away: null, home: null };

  ['away', 'home'].forEach(side => {
    const oppSide = side === 'away' ? 'home' : 'away';
    const oppPitching = probables[oppSide] ? players[probables[oppSide]]?.pitching : null;

    (lineups[side]?.players || []).forEach((player, slot) => {
      const projection = projectBatter(players[player.id]?.hitting, slot, oppPitching, teamTotals[side]);
      projections[player.id] = projection;
      const markets = byPlayer[normalizeName(player.fullName)];
      if (!markets) return;

      const rows = [];
      Object.entries(markets).forEach(([marketKey, lines]) => {
        Object.entries(lines).forEach(([lineStr, quotes]) => {
          const line = parseFloat(lineStr);

          // Market fair P(over): no-vig per book, or implied / book margin for one-sided books
          const fair = quotes.map(q => {
            if (q.over !== undefined && q.under !== undefined) {
              const io = implied(q.over);
              return io / (io + implied(q.under));
            }
            if (q.over !== undefined) return implied(q.over) / (hold[q.book] || DEFAULT_HOLD);
            return null;
          }).filter(v => v !== null);
          const marketOver = median(fair);
          const oneSided = quotes.every(q => q.under === undefined);
          const projOver = projection.overProb(marketKey, line);

          [['Over', 'over'], ['Under', 'under']].forEach(([label, key]) => {
            const best = bestSide(quotes, key);
            if (!best) return;
            const marketProb = marketOver === null ? null : (key === 'over' ? marketOver : 1 - marketOver) * 100;
            const projProb = projOver === null ? null : (key === 'over' ? projOver : 1 - projOver) * 100;
            const evMarket = marketProb === null ? null : calculateEV(marketProb, best.odds);
            const evProj = projProb === null ? null : calculateEV(projProb, best.odds);
            const books = quotes.filter(q => q[key] !== undefined).length;
            // Value needs both opinions +EV and a price at least two books are quoting
            const agree = evMarket !== null && evProj !== null && evMarket > 0 && evProj > 0 && books >= 2;
            rows.push({
              market: marketKey,
              marketLabel: PROP_MARKETS[marketKey].label,
              short: PROP_MARKETS[marketKey].short,
              side: label,
              line,
              best,
              books,
              marketProb,
              marketEstimated: oneSided,
              projProb,
              evMarket,
              evProj,
              agree,
              score: evMarket !== null && evProj !== null ? (evMarket + evProj) / 2 : null
            });
          });
        });
      });

      rows.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
      byPlayerId[player.id] = rows;

      // Team standout: best combined score, ignoring thin markets (1 book) and long shots
      rows.filter(r => r.score !== null && r.books >= 2 && r.best.odds < 400 && r.marketProb <= 100).forEach(r => {
        if (!highlights[side] || r.score > highlights[side].prop.score) {
          highlights[side] = { playerId: player.id, name: player.fullName, prop: r };
        }
      });
    });
  });

  return { byPlayerId, highlights, projections };
};
