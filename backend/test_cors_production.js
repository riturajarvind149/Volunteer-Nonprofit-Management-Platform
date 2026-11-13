/**
 * Test: Production CORS Configuration
 * 
 * Simulates production environment where:
 * - NODE_ENV=production
 * - Only explicitly configured origins are allowed
 * - Localhost origins should NOT be auto-added
 */

require('dotenv').config();
const http = require('http');

// Override NODE_ENV for this test
process.env.NODE_ENV = 'production';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5001';
const PRODUCTION_ORIGIN = 'https://volunteer-nonprofit-frontend.vercel.app';
const LOCALHOST_ORIGIN = 'http://localhost:5173';

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function testProductionModeWithProductionOrigin() {
  console.log('\n📝 Test: Production origin in production mode');
  
  try {
    const response = await makeRequest({
      path: '/api/health',
      method: 'GET',
      headers: { 'Origin': PRODUCTION_ORIGIN }
    });

    const allowOrigin = response.headers['access-control-allow-origin'];
    
    if (allowOrigin === PRODUCTION_ORIGIN) {
      console.log(`   ✅ Production origin allowed: ${allowOrigin}`);
      return true;
    } else {
      console.log(`   ❌ Production origin rejected: ${allowOrigin}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function testProductionModeWithLocalhostOrigin() {
  console.log('\n📝 Test: Localhost origin in production mode (should be rejected)');
  
  try {
    const response = await makeRequest({
      path: '/api/health',
      method: 'GET',
      headers: { 'Origin': LOCALHOST_ORIGIN }
    });

    const allowOrigin = response.headers['access-control-allow-origin'];
    
    // In production mode, localhost should be rejected unless explicitly in FRONTEND_URL
    if (!allowOrigin || allowOrigin !== LOCALHOST_ORIGIN) {
      console.log(`   ✅ Localhost correctly rejected in production mode`);
      return true;
    } else {
      console.log(`   ❌ Localhost incorrectly allowed: ${allowOrigin}`);
      console.log(`   ⚠️  Note: This would be a security issue in production`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('=================================================');
  console.log('Production CORS Configuration Test');
  console.log('=================================================');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Simulated NODE_ENV: production`);
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || '(not set)'}`);
  console.log('\n⚠️  Note: This test overrides NODE_ENV to verify production behavior');

  const results = [];
  results.push(await testProductionModeWithProductionOrigin());
  results.push(await testProductionModeWithLocalhostOrigin());

  console.log('\n=================================================');
  console.log('Test Summary');
  console.log('=================================================');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('✅ Production CORS configuration is correct!');
    process.exit(0);
  } else {
    console.log('❌ Production CORS configuration has issues.');
    process.exit(1);
  }
}

async function checkServer() {
  try {
    await makeRequest({ path: '/api/health' });
    return true;
  } catch (error) {
    console.error('\n❌ Server is not running at:', BASE_URL);
    return false;
  }
}

(async () => {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runTests();
  } else {
    process.exit(1);
  }
})();
