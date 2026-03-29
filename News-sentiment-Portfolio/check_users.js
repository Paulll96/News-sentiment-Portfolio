require('dotenv').config({ path: '.env' });
const { query } = require('./server/db');

async function checkUsers() {
  try {
    const res = await query(`SELECT id, email FROM users LIMIT 5`);
    console.log('Users:');
    for (const row of res.rows) {
      console.log(`  ${row.email} -> ${row.id}`);
    }
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
checkUsers();
