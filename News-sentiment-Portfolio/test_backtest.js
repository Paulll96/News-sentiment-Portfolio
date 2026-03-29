require('dotenv').config({ path: '.env' });
const http = require('http');

const loginData = JSON.stringify({ email: 'testuser@example.com', password: 'password123' });

function doRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Try login with common passwords
  const passwords = ['password123', 'test1234', 'Password1', 'password', '12345678'];
  let token = null;
  
  for (const pw of passwords) {
    const res = await doRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/login',
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ email: 'testuser@example.com', password: pw }));
    
    try {
      const parsed = JSON.parse(res.body);
      if (parsed.token) {
        token = parsed.token;
        console.log('Login OK with password:', pw);
        break;
      }
    } catch(e) {}
  }
  
  if (!token) {
    // Try registering
    console.log('Could not login, registering new user...');
    const regRes = await doRequest({
      hostname: 'localhost', port: 3000, path: '/api/auth/register',
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ email: 'backtest_test@example.com', password: 'test1234', name: 'Test' }));
    
    try {
      const parsed = JSON.parse(regRes.body);
      token = parsed.token;
      console.log('Registered OK');
    } catch(e) {
      console.log('Register failed:', regRes.body);
      process.exit(1);
    }
  }
  
  if (!token) { console.log('No token'); process.exit(1); }
  
  // Run backtest
  const btRes = await doRequest({
    hostname: 'localhost', port: 3000, path: '/api/backtest/run',
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, JSON.stringify({ startDate: '2025-01-01', endDate: '2026-03-28', initialCapital: 10000 }));
  
  try {
    const result = JSON.parse(btRes.body);
    console.log('Status:', btRes.status);
    console.log('Keys:', Object.keys(result));
    console.log('equityCurve length:', result.equityCurve?.length);
    console.log('First 3:', JSON.stringify(result.equityCurve?.slice(0, 3), null, 2));
    console.log('Last:', JSON.stringify(result.equityCurve?.slice(-1), null, 2));
    console.log('Summary:', JSON.stringify(result.summary, null, 2));
    
    // Check the keys in equityCurve entries
    if (result.equityCurve && result.equityCurve.length > 0) {
      console.log('equityCurve[0] keys:', Object.keys(result.equityCurve[0]));
    }
  } catch(e) {
    console.log('Parse error:', btRes.body?.substring(0,500));
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
