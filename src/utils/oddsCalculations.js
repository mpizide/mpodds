export const americanToDecimal = (american) => {
  const num = parseFloat(american);
  if (isNaN(num)) return null;
  if (num >= 100) return (num / 100) + 1;
  if (num <= -100) return (100 / Math.abs(num)) + 1;
  return null;
};

export const americanToImplied = (american) => {
  const num = parseFloat(american);
  if (isNaN(num)) return null;
  if (num >= 100) return (100 / (num + 100)) * 100;
  if (num <= -100) return (Math.abs(num) / (Math.abs(num) + 100)) * 100;
  return null;
};

export const calculateEV = (yourProbability, bookOdds, betType = null) => {
  const prob = parseFloat(yourProbability) / 100;
  const decimal = americanToDecimal(bookOdds);
  if (!prob || !decimal || prob <= 0 || prob >= 1) return null;
  const profit = decimal - 1;
  let ev = (prob * profit) - ((1 - prob) * 1);

  // Apply risk penalty to moneylines based on odds
  if (betType === 'moneyline') {
    const odds = parseFloat(bookOdds);

    // Extreme penalty for massive underdogs (+200 or higher) - essentially eliminate these
    if (odds >= 200) {
      ev = ev * 0.05; // 95% penalty - make it nearly impossible to be top pick
    }
    // Very heavy penalty for big underdogs (+150 to +199)
    else if (odds >= 150) {
      ev = ev * 0.2; // 80% penalty
    }
    // Heavy penalty for medium underdogs (+110 to +149)
    else if (odds >= 110) {
      ev = ev * 0.5; // 50% penalty
    }
    // Moderate penalty for slight underdogs (+100 to +109)
    else if (odds >= 100) {
      ev = ev * 0.7; // 30% penalty
    }
    // Slight penalty for favorites (negative odds)
    else if (odds < 0 && odds >= -150) {
      ev = ev * 0.9; // 10% penalty (still prefer spreads)
    }
    // Heavy penalty for big favorites (worse than -150)
    else if (odds < -150) {
      ev = ev * 0.5; // 50% penalty (too much juice)
    }
  }

  // Small bonus for spreads (more consistent)
  if (betType === 'spread') {
    ev = ev * 1.1; // 10% bonus
  }

  return ev * 100;
};

export const findBestOdds = (bookmakers, marketKey, outcomeKey, selectedBookmakers = []) => {
  let bestOdds = null;
  let bestBook = null;

  // Filter bookmakers if selections are provided
  const filteredBookmakers = selectedBookmakers.length > 0
    ? bookmakers.filter(book => selectedBookmakers.includes(book.title))
    : bookmakers;

  filteredBookmakers.forEach(book => {
    const market = book.markets && book.markets.find(m => m.key === marketKey);
    if (!market) return;
    const outcome = market.outcomes && market.outcomes.find(o => o.name === outcomeKey);
    if (!outcome) return;
    const odds = outcome.price;

    if (bestOdds === null ||
        (odds > 0 && odds > bestOdds) ||
        (odds < 0 && bestOdds < 0 && odds > bestOdds) ||
        (odds > 0 && bestOdds < 0)) {
      bestOdds = odds;
      bestBook = book.title;
    }
  });

  return bestOdds && bestBook ? { bookmaker: bestBook, odds: bestOdds } : null;
};

export const findBestTotals = (bookmakers, type, selectedBookmakers = []) => {
  let bestOdds = null;
  let bestBook = null;
  let bestPoints = null;

  // Filter bookmakers if selections are provided
  const filteredBookmakers = selectedBookmakers.length > 0
    ? bookmakers.filter(book => selectedBookmakers.includes(book.title))
    : bookmakers;

  filteredBookmakers.forEach(book => {
    const market = book.markets && book.markets.find(m => m.key === 'totals');
    if (!market) return;

    const outcome = market.outcomes && market.outcomes.find(o => o.name === type);
    if (!outcome) return;

    const odds = outcome.price;
    const points = outcome.point;

    if (bestOdds === null ||
        (odds > 0 && odds > bestOdds) ||
        (odds < 0 && bestOdds < 0 && odds > bestOdds) ||
        (odds > 0 && bestOdds < 0)) {
      bestOdds = odds;
      bestBook = book.title;
      bestPoints = points;
    }
  });

  return bestOdds && bestBook ? { bookmaker: bestBook, odds: bestOdds, points: bestPoints } : null;
};