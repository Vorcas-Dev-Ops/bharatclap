/**
 * scripts/free-ports.js
 * ponytail: Pre-start port cleanup for Windows dev environment.
 * Detects and kills any stale Node.js processes occupying service ports
 * before launching the microservice stack.
 *
 * Usage: node scripts/free-ports.js
 */

const { execSync } = require('child_process');

const PORTS = [3000, 5000, 5001, 5002, 5003, 5004, 5005, 5006];

let freed = 0;
let alreadyFree = 0;

for (const port of PORTS) {
  try {
    // netstat -ano finds the PID bound to the port
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse PID from last column of each matching line
    const pids = new Set();
    for (const line of out.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
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
  } catch {
    // No process on this port
    alreadyFree++;
  }
}

if (freed > 0) {
  console.log(`\n  Freed ${freed} port(s). Waiting 1s for OS cleanup...\n`);
  // ponytail: Atomics.wait is the simplest synchronous sleep in Node without shell gymnastics
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
} else {
  console.log(`  All ${PORTS.length} service ports are free.\n`);
}
