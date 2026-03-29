require('dotenv').config({ path: '.env' });
const { query } = require('./server/db');

async function checkTransactions() {
  try {
    const res = await query(`
      SELECT t.type, t.shares, t.price, t.total_value, t.executed_at, s.symbol 
      FROM transactions t 
      JOIN stocks s ON t.stock_id = s.id 
      ORDER BY t.executed_at ASC 
      LIMIT 10;
    `);
    console.log("First 10 transactions:");
    console.table(res.rows);
    
    const initCap = await query(`
      SELECT user_id, COALESCE(SUM(t.total_value), 0) as initial_capital
      FROM transactions t
      WHERE t.type = 'buy'
      AND t.executed_at = (
          SELECT MIN(executed_at) FROM transactions sub_t
          WHERE sub_t.user_id = t.user_id AND sub_t.type = 'buy'
      )
      GROUP BY user_id;
    `);
    console.log("\nInitial capital query results:");
    console.table(initCap.rows);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTransactions();
