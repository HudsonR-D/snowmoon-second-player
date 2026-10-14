const MUTE_KEY = 'snowmoon-second-player-muted-v1';
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch { /* private mode: default to sound on */ }
let ac: AudioContext | null = null;
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch { /* private mode: session-only */ }
  return muted;
}
function ctx(): AudioContext | null {
  if (muted) return null;
  try {
    ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch { return null; }
}
function tone(f0: number, f1: number, ms: number, type: OscillatorType = 'square', vol = 0.05, delay = 0) {
  const a = ctx();
  if (!a) return;
  try {
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + ms / 1000);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + ms / 1000 + 0.02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  } catch { /* no audio */ }
}
/** Legacy blip: short square + soft harmonic. */
export function blip(freq = 440, ms = 60) {
  tone(freq, freq, ms, 'square', 0.05);
  tone(freq * 2, freq * 2, ms, 'sine', 0.02);
}
export const sMove = () => tone(330, 330, 50);
export const sClick = () => tone(520, 520, 55);
export const sBuild = () => { tone(520, 520, 60); tone(784, 784, 90, 'square', 0.05, 0.06); };
export const sRewind = () => tone(420, 140, 200, 'sawtooth', 0.05);
export const sWin = () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 130, 'square', 0.05, i * 0.09));
export const sLose = () => [330, 262, 196].forEach((f, i) => tone(f, f * 0.97, 160, 'triangle', 0.07, i * 0.11));
export const sNotice = () => { tone(740, 740, 80); tone(988, 988, 100, 'sine', 0.04, 0.08); };
