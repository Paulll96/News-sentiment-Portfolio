require('dotenv').config({ path: '.env' });
const { query } = require('./server/db');

async function testPerformanceHistory() {
  try {
    const userIdRes = await query(`SELECT id FROM users LIMIT 1`);
    if (userIdRes.rows.length === 0) {
      console.log('No users found.');
      process.exit(0);
    }
    const userId = userIdRes.rows[0].id;

    const txResult = await query(
      `SELECT t.type, t.shares, t.executed_at, s.symbol
       FROM transactions t
       JOIN stocks s ON t.stock_id = s.id
       WHERE t.user_id = $1
       ORDER BY t.executed_at ASC`,
      [userId]
    );

    const initCapResult = await query(
      `SELECT COALESCE(SUM(t.total_value), 0) as initial_capital
       FROM transactions t
       WHERE t.user_id = $1 AND t.type = 'buy'
         AND t.executed_at = (
             SELECT MIN(executed_at) FROM transactions
             WHERE user_id = $1 AND type = 'buy'
         )`,
      [userId]
    );
    const initialValue = parseFloat(initCapResult.rows[0]?.initial_capital) || 0;
    console.log('Initial Value:', initialValue);

    const txHistory = txResult.rows;
    const uniqueSymbols = [...new Set(txHistory.map(tx => tx.symbol))];

    const { fetchHistoricalPrices } = require('./server/services/quoteService');
    const historicalPrices = uniqueSymbols.length > 0
      ? await fetchHistoricalPrices(uniqueSymbols, '1mo')
      : {};

    const perfHistory = [];
    const now = new Date();
    const dates30Days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates30Days.push(d);
    }

    const lastKnownPrices = {};

    for (const date of dates30Days) {
      const dateStrYYYYMMDD = date.toISOString().split('T')[0];
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      let dailyEquity = 0;
      const currentShares = {};

      for (const tx of txHistory) {
        if (new Date(tx.executed_at) <= endOfDay) {
          const shares = parseFloat(tx.shares) || 0;
          if (!currentShares[tx.symbol]) currentShares[tx.symbol] = 0;

          if (tx.type === 'buy') {
            currentShares[tx.symbol] += shares;
          } else if (tx.type === 'sell') {
            currentShares[tx.symbol] -= shares;
          }
        }
      }

      let dayHasData = false;
      for (const [symbol, shares] of Object.entries(currentShares)) {
        if (shares <= 0.0001) continue;

        let price = historicalPrices[symbol]?.[dateStrYYYYMMDD];
        if (price !== undefined) {
          lastKnownPrices[symbol] = price;
        } else {
          price = lastKnownPrices[symbol] || 0;
        }

        if (price > 0) {
          dailyEquity += (shares * price);
          dayHasData = true;
        }
      }

      if (dayHasData || Object.keys(currentShares).length > 0) {
        perfHistory.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          portfolio: Math.round(dailyEquity)
        });
      }
    }

    console.log('Performance History:', perfHistory);

    const monthlyReturns = perfHistory.map((p, i) => {
      if (i === 0 || perfHistory[i - 1].portfolio === 0) return 0;
      return (p.portfolio - perfHistory[i - 1].portfolio) / perfHistory[i - 1].portfolio;
    }).slice(1);
    
    console.log('Daily Returns:', monthlyReturns);

    const avgReturn = monthlyReturns.length > 0 ? monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length : 0;
    const stdDev = monthlyReturns.length > 1
      ? Math.sqrt(monthlyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / monthlyReturns.length)
      : 0;

    const sharpeRatio = (stdDev > 0.0001) ? (avgReturn / stdDev) * Math.sqrt(12) : 0;

    console.log('Avg Return (Daily over Month):', avgReturn);
    console.log('Standard Deviation:', stdDev);
    console.log('Annualized Sharpe Ratio Calculation:', sharpeRatio);

    const holdingsResult = await query(
      `SELECT current_value FROM portfolio_holdings WHERE user_id = $1`, [userId]
    );
    const totalValue = holdingsResult.rows.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);
    console.log('Total Current Value:', totalValue);

    const totalReturn = initialValue > 0 ? ((totalValue - initialValue) / initialValue * 100) : 0;
    const displayReturn = isFinite(totalReturn) && initialValue > 1 ? totalReturn.toFixed(2) : "0.00";
    console.log('Total Return %:', displayReturn);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testPerformanceHistory();
