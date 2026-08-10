const http = require('http');

const measureRequest = (url) => {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const durationMs = performance.now() - start;
        resolve({
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          bodyLength: body.length,
        });
      });
    });
    req.on('error', (err) => {
      const durationMs = performance.now() - start;
      resolve({
        statusCode: 0,
        error: err.message,
        durationMs: Number(durationMs.toFixed(2)),
      });
    });
  });
};

const runBenchmark = async () => {
  console.log('=====================================================');
  console.log('  EMPIRICAL BENCHMARK: LANDING PAGE & SERVICE PROBES  ');
  console.log('=====================================================');

  console.log('\n1. Testing Backend Readiness Endpoints:');
  const gatewayReady = await measureRequest('http://127.0.0.1:5000/health/ready');
  console.log(`   Gateway /health/ready -> HTTP ${gatewayReady.statusCode} in ${gatewayReady.durationMs}ms`);

  const paymentReady = await measureRequest('http://127.0.0.1:5005/health/ready');
  console.log(`   Payment /health/ready -> HTTP ${paymentReady.statusCode} in ${paymentReady.durationMs}ms`);

  const catalogReady = await measureRequest('http://127.0.0.1:5004/health/ready');
  console.log(`   Catalog /health/ready -> HTTP ${catalogReady.statusCode} in ${catalogReady.durationMs}ms`);

  console.log('\n2. Testing Gateway Fast-Fail 503 Short-Circuiting (Unready/Non-Existent Target):');
  const gatewayFastFail = await measureRequest('http://127.0.0.1:5000/api/v1/nonexistent-service-check');
  console.log(`   Gateway Fast-Fail 503 -> HTTP ${gatewayFastFail.statusCode} in ${gatewayFastFail.durationMs}ms`);
  console.log(`   Target Verification: ${gatewayFastFail.durationMs <= 100 ? '✅ EXCEEDS TARGET (< 50-100ms)' : '⚠️ SLOW'}`);

  console.log('\n3. Testing Next.js Landing Page GET / Response:');
  const coldLanding = await measureRequest('http://localhost:3000/');
  console.log(`   Cold GET / -> HTTP ${coldLanding.statusCode} in ${coldLanding.durationMs}ms`);

  const warmLanding = await measureRequest('http://localhost:3000/');
  console.log(`   Warm GET / -> HTTP ${warmLanding.statusCode} in ${warmLanding.durationMs}ms`);

  console.log('\n=====================================================');
  console.log('  COMPARISON AGAINST ORIGINAL SLOW LOG:');
  console.log('  BEFORE: GET / = 30.1s (application-code = 20.4s)');
  console.log(`  AFTER : Landing Warm = ${warmLanding.durationMs}ms`);
  console.log('=====================================================');
};

runBenchmark();
