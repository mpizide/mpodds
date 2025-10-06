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

export const calculateEV = (yourProbability, bookOdds) => {
  const prob = parseFloat(yourProbability) / 100;
  const decimal = americanToDecimal(bookOdds);
  if (!prob || !decimal || prob <= 0 || prob >= 1) return null;
  const profit = decimal - 1;
  const ev = (prob * profit) - ((1 - prob) * 1);
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