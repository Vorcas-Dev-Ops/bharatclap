/**
 * scripts/dev-frontend.js
 * Inspects port 3000 before launching Next.js frontend.
 * - Prevents duplicate frontend startup if Next.js is already running.
 * - Protects unrelated processes from being killed.
 * - Launches next dev if port 3000 is free.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3000;

function getListeningPid(port) {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = out.split('\n');
    const portRegex = new RegExp(`[:.]${port}\\s+.*LISTENING\\s+(\\d+)`, 'i');
    for (const line of lines) {
      const match = line.match(portRegex);
      if (match && match[1] && match[1] !== '0') {
        return match[1].trim();
      }
    }
  } catch (_) {}
  return null;
}

function getProcessCommandLine(pid) {
  try {
    const cmd = `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CommandLine`;
    const out = execSync(`powershell -NoProfile -Command "${cmd}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return out.trim();
  } catch (_) {
    return '';
  }
}

async function main() {
  const pid = getListeningPid(PORT);

  if (pid) {
    const cmdLine = getProcessCommandLine(pid);
    const isNext = cmdLine.toLowerCase().includes('next') || cmdLine.toLowerCase().includes('frontend');

    if (isNext) {
      console.log(`\n==================================================`);
      console.log(`[FRONTEND] Next.js dev server is ALREADY running on port ${PORT}`);
      console.log(`[FRONTEND] Active PID: ${pid}`);
      console.log(`[FRONTEND] Skipping duplicate startup to prevent port collisions.`);
      console.log(`==================================================\n`);

      // Monitor health of existing Next.js instance so concurrently stays attached
      setInterval(() => {
        const checkPid = getListeningPid(PORT);
        if (!checkPid) {
          console.log(`[FRONTEND] Previous instance (PID ${pid}) exited. Restarting Next.js dev server...`);
          process.exit(0);
        }
      }, 10000);
      return;
    } else {
      console.warn(`\n[FRONTEND] WARNING: Port ${PORT} is occupied by unrelated process (PID ${pid}).`);
      console.warn(`[FRONTEND] Command: ${cmdLine || 'Unknown'}`);
      console.warn(`[FRONTEND] Preserving unrelated process. Frontend will not start until port 3000 is freed.\n`);
      return;
    }
  }

  console.log(`[FRONTEND] Port ${PORT} is free. Starting Next.js dev server...`);
  const frontendDir = path.resolve(__dirname, '../frontend');
  const child = spawn('npx', ['next', 'dev'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: true
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch(err => {
  console.error('[FRONTEND] Startup error:', err);
  process.exit(1);
});
