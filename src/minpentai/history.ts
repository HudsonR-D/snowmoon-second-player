import type { TurnDelta } from './sim.js';
// Fixed ring buffer, 200 deep. Slice uses 10-step undo.
export class History {
  buf: TurnDelta[] = [];
  cap = 200;
  push(d: TurnDelta) { this.buf.push(d); if (this.buf.length > this.cap) this.buf.shift(); }
  pop() { return this.buf.pop(); }
  get length() { return this.buf.length; }
  clear() { this.buf = []; }
}
