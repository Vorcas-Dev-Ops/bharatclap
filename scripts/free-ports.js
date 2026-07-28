/**
 * scripts/free-ports.js
 * Pre-start port cleanup for Windows dev environment.
 * Detects and kills any stale Node.js processes occupying service ports
 * before launching the microservice stack.
 *
 * Usage: node scripts/free-ports.js
 */

const { execSync } = require('child_process');

const PORTS = [3000, 5000, 5001, 5002, 5003, 5004, 5005, 5006];

let freed = 0;

try {
  const out = execSync('netstat -ano', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = out.split('\n');

  for (const port of PORTS) {
    const portRegex = new RegExp(`[:.]${port}\\s+.*LISTENING\\s+(\\d+)`, 'i');
    const pids = new Set();

    for (const line of lines) {
      const match = line.match(portRegex);
      if (match && match[1] && match[1] !== '0') {
        pids.add(match[1]);
      }
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
        console.log(`  ✗ Port ${port} — killed PID ${pid}`);
        freed++;
      } catch {
        // Process may have already exited
      }
    }
  }
} catch (err) {
  console.error('Error freeing ports:', err.message);
}

if (freed > 0) {
  console.log(`\n  Freed ${freed} port(s). Waiting 1s for OS cleanup...\n`);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
} else {
  console.log(`  All ${PORTS.length} service ports are free.\n`);
}
