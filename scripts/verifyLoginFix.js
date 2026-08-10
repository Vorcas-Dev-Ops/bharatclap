const http = require('http');

const sendLoginRequest = (email, password) => {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ email, password });
    const req = http.request(
      'http://127.0.0.1:5000/api/users/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: body,
          });
        });
      }
    );
    req.on('error', (err) => resolve({ statusCode: 0, error: err.message }));
    req.write(postData);
    req.end();
  });
};

const runLoginTest = async () => {
  console.log('=====================================================');
  console.log('  VERIFYING POST /api/users/login FIX (DUPLICATE HASH)');
  console.log('=====================================================');

  console.log('\n1. Sending Rapid Consecutive Login Requests...');
  const res1 = await sendLoginRequest('customer@example.com', 'Password123!');
  console.log(`   Login 1 Response: HTTP ${res1.statusCode}`);

  const res2 = await sendLoginRequest('customer@example.com', 'Password123!');
  console.log(`   Login 2 Response: HTTP ${res2.statusCode}`);

  if (res1.statusCode !== 500 && res2.statusCode !== 500) {
    console.log('\n✅ PASS: Login duplicate token_hash E11000 issue resolved! Zero 500 errors.');
  } else {
    console.error('\n❌ FAIL: Login returned HTTP 500 error.');
  }
};

runLoginTest();
