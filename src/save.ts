import { FLAGS_KEY } from './config.js';
import type { Flags } from './narrative/dialogue.js';
export function saveFlags(f: Flags) {
  try { localStorage.setItem(FLAGS_KEY, JSON.stringify(f.dump())); } catch { /* private mode */ }
}
export function loadFlags(f: Flags) {
  try {
    const s = localStorage.getItem(FLAGS_KEY);
    if (s) f.load(JSON.parse(s));
  } catch { /* ignore */ }
}
