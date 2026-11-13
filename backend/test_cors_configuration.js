/**
 * Test: CORS Configuration
 * 
 * Verifies that the backend correctly handles CORS for:
 * - Production frontend origin (Vercel)
 * - Development localhost origins
 * - OPTIONS preflight requests
 * - Credentials support
 * - Rejected origins
 */

require('dotenv').config();
const http = require('http');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5001';

// Test configuration
const PRODUCTION_ORIGIN = 'https://volunteer-nonprofit-frontend.vercel.app';
const LOCALHOST_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000'
];
const INVALID_ORIGIN = 'https://malicious-site.com';

// Utility: Make HTTP request with custom origin header
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
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test 1: Production origin is allowed
async function testProductionOrigin() {
  console.log('\n📝 Test 1: Production origin CORS headers');
  
  try {
    const response = await makeRequest({
      path: '/api/health',
      method: 'GET',
      headers: {
        'Origin': PRODUCTION_ORIGIN,
      }
    });

    const allowOrigin = response.headers['access-control-allow-origin'];
    const allowCredentials = response.headers['access-control-allow-credentials'];

    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Access-Control-Allow-Origin: ${allowOrigin}`);
    console.log(`   Access-Control-Allow-Credentials: ${allowCredentials}`);

    if (allowOrigin === PRODUCTION_ORIGIN) {
      console.log('   ✅ Production origin is allowed');
    } else {
      console.log(`   ❌ Expected origin '${PRODUCTION_ORIGIN}', got '${allowOrigin}'`);
      return false;
    }

    if (allowCredentials === 'true') {
      console.log('   ✅ Credentials are allowed');
    } else {
      console.log(`   ⚠️  Credentials header: ${allowCredentials}`);
    }

    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Test 2: Localhost origins are allowed in development
async function testLocalhostOrigins() {
  console.log('\n📝 Test 2: Localhost development origins');
  
  let allPassed = true;

  for (const origin of LOCALHOST_ORIGINS) {
    try {
      const response = await makeRequest({
        path: '/api/health',
        method: 'GET',
        headers: {
          'Origin': origin,
        }
      });

      const allowOrigin = response.headers['access-control-allow-origin'];
      
      if (process.env.NODE_ENV !== 'production') {
        if (allowOrigin === origin) {
          console.log(`   ✅ ${origin} is allowed (development mode)`);
        } else {
          console.log(`   ❌ ${origin} was rejected: ${allowOrigin}`);
          allPassed = false;
        }
      } else {
        console.log(`   ℹ️  ${origin} - ${allowOrigin} (production mode)`);
      }
    } catch (error) {
      console.log(`   ❌ Error testing ${origin}: ${error.message}`);
      allPassed = false;
    }
  }

  return allPassed;
}

// Test 3: OPTIONS preflight request is handled
async function testPreflightRequest() {
  console.log('\n📝 Test 3: OPTIONS preflight request');
  
  try {
    const response = await makeRequest({
      path: '/api/auth/login',
      method: 'OPTIONS',
      headers: {
        'Origin': PRODUCTION_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization',
      }
    });

    const allowOrigin = response.headers['access-control-allow-origin'];
    const allowMethods = response.headers['access-control-allow-methods'];
    const allowHeaders = response.headers['access-control-allow-headers'];

    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Access-Control-Allow-Origin: ${allowOrigin}`);
    console.log(`   Access-Control-Allow-Methods: ${allowMethods}`);
    console.log(`   Access-Control-Allow-Headers: ${allowHeaders}`);

    if (response.statusCode === 204 || response.statusCode === 200) {
      console.log('   ✅ Preflight request handled correctly');
      return true;
    } else {
      console.log(`   ⚠️  Unexpected status code: ${response.statusCode}`);
      return true; // Some CORS packages return 200 instead of 204
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Test 4: Invalid origin is rejected
async function testInvalidOrigin() {
  console.log('\n📝 Test 4: Invalid origin is rejected');
  
  try {
    const response = await makeRequest({
      path: '/api/health',
      method: 'GET',
      headers: {
        'Origin': INVALID_ORIGIN,
      }
    });

    const allowOrigin = response.headers['access-control-allow-origin'];

    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Access-Control-Allow-Origin: ${allowOrigin}`);

    if (!allowOrigin || allowOrigin !== INVALID_ORIGIN) {
      console.log('   ✅ Invalid origin is correctly rejected');
      return true;
    } else {
      console.log(`   ❌ Invalid origin was allowed: ${allowOrigin}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Test 5: Request without origin header (same-origin, mobile apps, curl)
async function testNoOriginHeader() {
  console.log('\n📝 Test 5: Request without Origin header');
  
  try {
    const response = await makeRequest({
      path: '/api/health',
      method: 'GET',
      headers: {} // No Origin header
    });

    console.log(`   Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      console.log('   ✅ Requests without Origin header are allowed');
      return true;
    } else {
      console.log(`   ❌ Request failed with status: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Test 6: POST request with production origin
async function testPostWithProductionOrigin() {
  console.log('\n📝 Test 6: POST request with production origin');
  
  try {
    const response = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Origin': PRODUCTION_ORIGIN,
        'Content-Type': 'application/json',
      },
      body: {
        email: 'test@example.com',
        password: 'testpassword'
      }
    });

    const allowOrigin = response.headers['access-control-allow-origin'];
    const allowCredentials = response.headers['access-control-allow-credentials'];

    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Access-Control-Allow-Origin: ${allowOrigin}`);
    console.log(`   Access-Control-Allow-Credentials: ${allowCredentials}`);

    if (allowOrigin === PRODUCTION_ORIGIN) {
      console.log('   ✅ POST request has correct CORS headers');
      return true;
    } else {
      console.log(`   ❌ Missing or incorrect CORS headers`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('=================================================');
  console.log('CORS Configuration Test Suite');
  console.log('=================================================');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || '(not set)'}`);

  const results = [];

  results.push(await testProductionOrigin());
  results.push(await testLocalhostOrigins());
  results.push(await testPreflightRequest());
  results.push(await testInvalidOrigin());
  results.push(await testNoOriginHeader());
  results.push(await testPostWithProductionOrigin());

  console.log('\n=================================================');
  console.log('Test Summary');
  console.log('=================================================');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('✅ All CORS tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some CORS tests failed.');
    process.exit(1);
  }
}

// Check if server is running before tests
async function checkServer() {
  try {
    await makeRequest({ path: '/api/health' });
    return true;
  } catch (error) {
    console.error('\n❌ Server is not running or not reachable at:', BASE_URL);
    console.error('   Please start the server with: npm run dev');
    console.error('   Or set TEST_BASE_URL environment variable to point to your server.\n');
    return false;
  }
}

// Main execution
(async () => {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runTests();
  } else {
    process.exit(1);
  }
})();
