/**
 * Synthesizes a short two-note chime (D5 → A5) via the Web Audio API. Used
 * when the unread-count poll detects a fresh notification. Generating the
 * tone in code lets us avoid shipping a binary asset and keeps the bundle
 * lean; users can also mute via OS-level controls if they want.
 *
 * Browsers refuse AudioContext.start() until the user has interacted with
 * the page, so the first call after a hard reload may silently no-op — the
 * try/catch just swallows that, no toast or warning.
 */
let cachedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (cachedContext) return cachedContext;
  const Ctor =
    typeof window !== "undefined"
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      : undefined;
  if (!Ctor) return null;
  try {
    cachedContext = new Ctor();
    return cachedContext;
  } catch {
    return null;
  }
}

function tone(ctx: AudioContext, freq: number, start: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  // Soft attack + exponential release so the chime sounds like a notification,
  // not a sine-wave beep.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

export function playNotificationChime(): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    tone(ctx, 587.33, t0, 0.18); // D5
    tone(ctx, 880.0, t0 + 0.09, 0.22); // A5
  } catch {
    // Audio is best-effort; never let a sound failure break the UI.
  }
}
