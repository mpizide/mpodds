import fs from 'fs';
import path from 'path';

/**
 * Saves the top 3 picks (green) plus the pick of the week to pick_history.json
 * This function should be called at the end of each week
 */
export const saveTopPicks = async (games, predictions, selectedWeek, selectedBookmakers) => {
  const { calculateEV, findBestOdds, findBestTotals } = require('./oddsCalculations');

  const allBets = [];

  games.forEach(game => {
    const gameId = game.id;
    const homeTeam = game.home_team;
    const awayTeam = game.away_team;

    // Moneyline bets
    const homeBestML = findBestOdds(game.bookmakers, 'h2h', homeTeam, selectedBookmakers);
    const awayBestML = findBestOdds(game.bookmakers, 'h2h', awayTeam, selectedBookmakers);
    const homePredML = predictions[gameId]?.[`${homeTeam}_ml`];
    const awayPredML = predictions[gameId]?.[`${awayTeam}_ml`];

    if (homePredML && homeBestML) {
      const ev = calculateEV(homePredML, homeBestML.odds);
      if (ev !== null) {
        allBets.push({
          gameId,
          type: 'moneyline',
          team: homeTeam,
          opponent: awayTeam,
          ev,
          odds: homeBestML.odds,
          bookmaker: homeBestML.bookmaker,
          prediction: homePredML,
          matchup: `${awayTeam} @ ${homeTeam}`,
          description: `${homeTeam} ML`
        });
      }
    }
    if (awayPredML && awayBestML) {
      const ev = calculateEV(awayPredML, awayBestML.odds);
      if (ev !== null) {
        allBets.push({
          gameId,
          type: 'moneyline',
          team: awayTeam,
          opponent: homeTeam,
          ev,
          odds: awayBestML.odds,
          bookmaker: awayBestML.bookmaker,
          prediction: awayPredML,
          matchup: `${awayTeam} @ ${homeTeam}`,
          description: `${awayTeam} ML`
        });
      }
    }

    // Spread bets
    const homeBestSpread = findBestOdds(game.bookmakers, 'spreads', homeTeam, selectedBookmakers);
    const awayBestSpread = findBestOdds(game.bookmakers, 'spreads', awayTeam, selectedBookmakers);
    const homePredSpread = predictions[gameId]?.[`${homeTeam}_spread`];
    const awayPredSpread = predictions[gameId]?.[`${awayTeam}_spread`];

    if (homePredSpread && homeBestSpread) {
      const ev = calculateEV(homePredSpread, homeBestSpread.odds);
      if (ev !== null) {
        allBets.push({
          gameId,
          type: 'spread',
          team: homeTeam,
          opponent: awayTeam,
          ev,
          odds: homeBestSpread.odds,
          bookmaker: homeBestSpread.bookmaker,
          prediction: homePredSpread,
          line: homeBestSpread.point,
          matchup: `${awayTeam} @ ${homeTeam}`,
          description: `${homeTeam} ${homeBestSpread.point > 0 ? '+' : ''}${homeBestSpread.point}`
        });
      }
    }
    if (awayPredSpread && awayBestSpread) {
      const ev = calculateEV(awayPredSpread, awayBestSpread.odds);
      if (ev !== null) {
        allBets.push({
          gameId,
          type: 'spread',
          team: awayTeam,
          opponent: homeTeam,
          ev,
          odds: awayBestSpread.odds,
          bookmaker: awayBestSpread.bookmaker,
          prediction: awayPredSpread,
          line: awayBestSpread.point,
          matchup: `${awayTeam} @ ${homeTeam}`,
          description: `${awayTeam} ${awayBestSpread.point > 0 ? '+' : ''}${awayBestSpread.point}`
        });
      }
    }

    // Totals bets
    const overBest = findBestTotals(game.bookmakers, 'Over', selectedBookmakers);
    const underBest = findBestTotals(game.bookmakers, 'Under', selectedBookmakers);
    const overPred = predictions[gameId]?.['over'];
    const underPred = predictions[gameId]?.['under'];

    if (overPred && overBest) {
      const ev = calculateEV(overPred, overBest.odds);
      if (ev !== null) {
        allBets.push({
          gameId,
          type: 'total',
          team: 'Over',
          ev,
          odds: overBest.odds,
          bookmaker: overBest.bookmaker,
          prediction: overPred,
          line: overBest.point,
          matchup: `${awayTeam} @ ${homeTeam}`,
          description: `Over ${overBest.point}`
        });
      }
    }
    if (underPred && underBest) {
      const ev = calculateEV(underPred, underBest.odds);
      if (ev !== null) {
        allBets.push({
          gameId,
          type: 'total',
          team: 'Under',
          ev,
          odds: underBest.odds,
          bookmaker: underBest.bookmaker,
          prediction: underPred,
          line: underBest.point,
          matchup: `${awayTeam} @ ${homeTeam}`,
          description: `Under ${underBest.point}`
        });
      }
    }
  });

  // Sort by EV
  const rankedBets = allBets.sort((a, b) => b.ev - a.ev);

  // Apply same logic as getBorderColor to get top picks
  const topBets = [];
  const seenGames = new Set();
  const seenGameBetTypes = new Map();

  for (const bet of rankedBets) {
    const gameKey = bet.gameId;

    if (bet.type === 'spread' || bet.type === 'moneyline') {
      if (seenGames.has(gameKey)) {
        continue;
      }
    }

    if (bet.type === 'total') {
      const totalKey = `${bet.gameId}-total`;
      if (seenGameBetTypes.has(totalKey)) {
        continue;
      }
      seenGameBetTypes.set(totalKey, true);
    }

    topBets.push(bet);

    if (bet.type === 'spread' || bet.type === 'moneyline') {
      seenGames.add(gameKey);
    }

    if (topBets.length === 3) break; // Get top 3 green picks
  }

  // Load existing pick history
  const pickHistoryPath = path.join(__dirname, '..', 'pick_history.json');
  let pickHistory = [];

  try {
    const data = fs.readFileSync(pickHistoryPath, 'utf8');
    pickHistory = JSON.parse(data);
  } catch (err) {
    console.error('Error reading pick history:', err);
  }

  // Add new picks
  const currentYear = new Date().getFullYear();

  topBets.forEach((bet, index) => {
    const pick = {
      week: selectedWeek,
      season: currentYear,
      description: bet.description,
      matchup: bet.matchup,
      bet_type: bet.type,
      odds: bet.odds,
      bookmaker: bet.bookmaker,
      ev: parseFloat(bet.ev.toFixed(2)),
      ml_prediction: parseFloat(bet.prediction),
      result: 'pending',
      units_won: null,
      pick_rank: index === 0 ? 'potw' : 'top3'
    };

    pickHistory.push(pick);
  });

  // Save back to file
  try {
    fs.writeFileSync(pickHistoryPath, JSON.stringify(pickHistory, null, 2));
    console.log(`Saved ${topBets.length} picks for Week ${selectedWeek}`);
    return true;
  } catch (err) {
    console.error('Error saving pick history:', err);
    return false;
  }
};
