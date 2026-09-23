/**
 * Incoming job request ringtone for provider dashboard.
 * Uses Web Audio API — zero dependencies, no sound files needed.
 * ponytail: plays a repeating 2-tone chime (like a phone call ring).
 * Upgrade path: swap with an actual .mp3 asset for branded sound.
 */

let audioCtx: AudioContext | null = null;
let isRinging = false;
let ringInterval: ReturnType<typeof setInterval> | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

/** Play a single two-tone chime burst */
function playChime() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  // Two-tone pattern: high → low (like a call notification)
  const frequencies = [880, 660]; // A5 → E5
  const duration = 0.15;
  const gap = 0.08;

  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);

    const start = now + i * (duration + gap);
    gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
    gain.gain.setValueAtTime(0.3, start + duration - 0.03);
    gain.gain.linearRampToValueAtTime(0, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  });
}

/** Start ringing — repeats the chime every 2 seconds until stopped */
export function startJobRing() {
  if (isRinging) return;
  isRinging = true;

  playChime();
  ringInterval = setInterval(() => {
    if (isRinging) playChime();
  }, 2000);

  // Auto-stop after 30 seconds to avoid annoying endless ringing
  setTimeout(() => stopJobRing(), 30000);
}

/** Stop the ringtone */
export function stopJobRing() {
  isRinging = false;
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}

/** Play a single notification chime (non-repeating) */
export function playNotificationSound() {
  playChime();
}
