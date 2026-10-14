import { Rng, type RngSnap } from './rng.js';
import type { Cell } from './board.js';

// Axial hex coords (flat-top): E(+1,0) NE(+1,-1) NW(0,-1) W(-1,0) SW(-1,+1) SE(0,+1).
export interface HexDir { dq: number; dr: number; key: string; }
export const HEX_DIRS: HexDir[] = [
  { dq: 1, dr: 0, key: 'E' }, { dq: 1, dr: -1, key: 'NE' }, { dq: 0, dr: -1, key: 'NW' },
  { dq: -1, dr: 0, key: 'W' }, { dq: -1, dr: 1, key: 'SW' }, { dq: 0, dr: 1, key: 'SE' },
];
export const hkey = (q: number, r: number) => `${q},${r}`;
export function hexDist(aq: number, ar: number, bq: number, br: number): number {
  const dq = aq - bq, dr = ar - br;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
const blank = (): Cell => ({ terrain: 'empty', piece: 'none', symbol: false, hp: 0, dirX: 0, dirY: 0, jammed: false, stickerT: 0 });

export class HexBoard {
  radius: number;
  map = new Map<string, Cell>();
  constructor(radius: number) {
    this.radius = radius;
    for (let q = -radius; q <= radius; q++)
      for (let r = -radius; r <= radius; r++) {
        if (hexDist(0, 0, q, r) <= radius) this.map.set(hkey(q, r), blank());
      }
  }
  has(q: number, r: number): boolean { return this.map.has(hkey(q, r)); }
  get(q: number, r: number): Cell { return this.map.get(hkey(q, r))!; }
  snap(): [string, Cell][] { return [...this.map.entries()].map(([k, c]) => [k, { ...c }]); }
  restore(s: [string, Cell][]) { this.map = new Map(s.map(([k, c]) => [k, { ...c }] as [string, Cell])); }
}

export interface HexDelta {
  turn: number;
  snap: [string, Cell][];
  rngState: RngSnap;
  pq: number; pr: number; bq: number; br: number;
  pSym: boolean; hold: number;
  won: boolean; lost: string;
  stun: number; tlen: number;
  moved: boolean;
}

// M-Z3 greybox: hunter Bo closes in every 2nd turn; hold center (dist<=1) to win.
// Rock pushed into Bo stuns him 2 turns. Rewind charges handled by Game (not restored).
export class HexSim {
  board: HexBoard;
  pq: number; pr: number; bq: number; br: number;
  pSym = false; turn = 0; hold = 0;
  won = false; lost = '';
  stun = 0; transcript: string[] = [];
  rng: Rng;
  holdNeed: number; turnLimit: number;
  constructor(board: HexBoard, pq: number, pr: number, bq: number, br: number, seed: string, holdNeed: number, turnLimit: number) {
    this.board = board; this.pq = pq; this.pr = pr; this.bq = bq; this.br = br;
    this.rng = new Rng(seed); this.holdNeed = holdNeed; this.turnLimit = turnLimit;
  }
  private note(t: string) { this.transcript.push(`T${this.turn} ${t}`); }
  tryPlayerMove(di: number): HexDelta {
    const d: HexDelta = {
      turn: this.turn, snap: this.board.snap(), rngState: this.rng.snapshot(),
      pq: this.pq, pr: this.pr, bq: this.bq, br: this.br,
      pSym: this.pSym, hold: this.hold, won: this.won, lost: this.lost,
      stun: this.stun, tlen: this.transcript.length, moved: false,
    };
    const dir = HEX_DIRS[di];
    if (!dir || !this.stepPlayer(dir.dq, dir.dr)) return d;
    d.moved = true;
    this.note(`you ${dir.key}`);
    this.turn++;
    if (this.turn % 2 === 0) this.stepBo(d);
    if (!this.lost && hexDist(0, 0, this.pq, this.pr) <= 1) {
      this.hold++;
      this.note(`hold ${this.hold}/${this.holdNeed}${this.pSym ? '' : ' (need ●)'}`);
      if (this.hold >= this.holdNeed && this.pSym) { this.won = true; }
    }
    if (!this.won && this.turn >= this.turnLimit) this.lost = 'time';
    void this.rng.nextGame();
    return d;
  }
  private stepPlayer(dq: number, dr: number): boolean {
    const nq = this.pq + dq, nr = this.pr + dr;
    if (!this.board.has(nq, nr)) return false;
    if (nq === this.bq && nr === this.br) return false; // can't walk into Bo
    const nc = this.board.get(nq, nr);
    if (nc.piece === 'wall' || nc.piece === 'factory' || nc.piece === 'mirror') return false;
    if (nc.piece === 'rock') {
      const bq = nq + dq, br = nr + dr;
      if (!this.board.has(bq, br)) return false;
      // Rock into Bo: stun him 2 turns, rock stays.
      if (bq === this.bq && br === this.br) {
        this.stun = 2;
        this.commit(nq, nr);
        this.note('rock hits Bo — stunned 2');
        return true;
      }
      const bc = this.board.get(bq, br);
      if (bc.piece !== 'none' || bc.terrain === 'shrine' || (bq === this.bq && br === this.br)) return false;
      bc.piece = 'rock';
      nc.piece = 'none';
      this.commit(nq, nr);
      return true;
    }
    if (nc.piece === 'spaceship') return false;
    this.commit(nq, nr);
    return true;
  }
  private commit(nq: number, nr: number) {
    this.pq = nq; this.pr = nr;
    const c = this.board.get(nq, nr);
    if (c.symbol) { c.symbol = false; this.pSym = true; this.note('took ●'); }
  }
  private stepBo(_d: HexDelta) {
    if (this.stun > 0) { this.stun--; this.note(`Bo stunned (${this.stun})`); return; }
    let best = -1, bestD = hexDist(this.bq, this.br, this.pq, this.pr);
    for (let i = 0; i < HEX_DIRS.length; i++) {
      const nq = this.bq + HEX_DIRS[i].dq, nr = this.br + HEX_DIRS[i].dr;
      if (!this.board.has(nq, nr)) continue;
      const c = this.board.get(nq, nr);
      if (c.piece === 'wall' || c.piece === 'factory' || c.piece === 'mirror' || c.piece === 'rock' || c.piece === 'spaceship') continue;
      const dd = hexDist(nq, nr, this.pq, this.pr);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    if (best < 0) { this.note('Bo holds'); return; }
    this.bq += HEX_DIRS[best].dq; this.br += HEX_DIRS[best].dr;
    this.note(`Bo ${HEX_DIRS[best].key}`);
    if (this.bq === this.pq && this.br === this.pr) this.lost = 'caught';
  }
  applyInverse(d: HexDelta) {
    this.board.restore(d.snap);
    this.rng.restore(d.rngState);
    this.pq = d.pq; this.pr = d.pr; this.bq = d.bq; this.br = d.br;
    this.pSym = d.pSym; this.hold = d.hold;
    this.won = d.won; this.lost = d.lost; this.stun = d.stun;
    this.turn = d.turn;
    this.transcript.length = d.tlen;
  }
}

// Flat-top axial → pixel. Returns center for (q,r) given size + origin.
export function hexCenter(q: number, r: number, size: number, ox: number, oy: number): [number, number] {
  return [ox + size * 1.5 * q, oy + size * Math.sqrt(3) * (r + q / 2)];
}
export function drawHexBoard(ctx: CanvasRenderingContext2D, b: HexBoard, pq: number, pr: number, bq: number, br: number, pSym: boolean) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#10141d'; ctx.fillRect(0, 0, W, H);
  const size = Math.min(W, H) / (b.radius * 3.4);
  const ox = W / 2, oy = H / 2;
  const corners = (cx: number, cy: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i);
      pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
    }
    return pts;
  };
  for (const [k, c] of b.map) {
    const [q, r] = k.split(',').map(Number);
    const [cx, cy] = hexCenter(q, r, size, ox, oy);
    const pts = corners(cx, cy);
    ctx.beginPath();
    pts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.closePath();
    const center = hexDist(0, 0, q, r) <= 1;
    if (c.terrain === 'shrine') ctx.fillStyle = '#3a2f12';
    else if (center) ctx.fillStyle = '#1a2436';
    else ctx.fillStyle = (q + r) % 2 === 0 ? '#161d2b' : '#141a26';
    ctx.fill();
    ctx.strokeStyle = c.terrain === 'shrine' ? '#d8a723' : '#2a3446';
    ctx.stroke();
    if (c.piece === 'wall') { ctx.fillStyle = '#8b93a5'; ctx.beginPath(); ctx.arc(cx, cy, size * 0.45, 0, 7); ctx.fill(); }
    if (c.piece === 'rock') { ctx.fillStyle = '#a0aec0'; ctx.beginPath(); ctx.arc(cx, cy, size * 0.32, 0, 7); ctx.fill(); }
    if (c.symbol) { ctx.fillStyle = '#ecc94b'; ctx.beginPath(); ctx.arc(cx, cy, size * 0.2, 0, 7); ctx.fill(); }
  }
  const dot = (q: number, r: number, col: string, label: string) => {
    const [cx, cy] = hexCenter(q, r, size, ox, oy);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, size * 0.55, 0, 7); ctx.fill();
    ctx.fillStyle = '#0b0e14'; ctx.font = `bold ${Math.max(12, size * 0.4)}px system-ui`;
    ctx.fillText(label, cx - size * 0.18, cy + size * 0.15);
  };
  dot(bq, br, '#f6ad55', 'Bo');
  dot(pq, pr, '#63e6be', 'Z');
  if (pSym) { ctx.fillStyle = '#ecc94b'; ctx.fillRect(6, 6, 12, 12); }
}
