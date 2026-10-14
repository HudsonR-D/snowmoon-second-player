import { Board, type Cell } from './board.js';
import { Rng, type RngSnap } from './rng.js';

export interface TurnDelta {
  turn: number;
  snap: Cell[];
  rngState: RngSnap;
  px: number; py: number; ax: number; ay: number;
  pSym: boolean; aSym: boolean;
  won: boolean;
  moved: boolean;
  energy: number; foe: number; tlen: number;
  signalOn: boolean; claimed: boolean[];
  hunters: { x: number; y: number; wi: number; dead: boolean }[];
  lost: string;
  jamInv: number; jamT: number;
  dx: number; dy: number; trailLen: number;
  stickers: number; spots: number;
}

export interface Zone { cells: [number, number][]; claimed: boolean; }
export interface Hunter { x: number; y: number; wp: [number, number][]; wi: number; hp: number; dead: boolean; }

export interface SimState {
  board: Board;
  px: number; py: number;
  ax: number; ay: number;
  pSym: boolean; aSym: boolean;
  turn: number;
  won: boolean;
  seed: string;
  energy: number; foe: number;
  transcript: string[];
  zoneMode: boolean;
  zones: Zone[];
  signalOn: boolean; signalPeriod: number;
  holdNeed: number;
  hunters: Hunter[];
  lost: string;
  lethal: boolean;
  jamInv: number; jamT: number;
  dx: number; dy: number;
  trail: [number, number][];
  stickers: number; spots: number; spotLimit: number;
  ex: number; ey: number;
}

// Deterministic push-puzzle greybox of Minpentai.
// One player turn = player move (+ folded ally follow) + patrol every 2 turns.
// Rewind = full snapshot restore (boards are tiny: 7x7/9x9), so crush/patrol/RNG restore exactly.
export class Sim {
  st: SimState;
  rng: Rng;
  constructor(board: Board, px: number, py: number, ax: number, ay: number, seed: string) {
    this.st = { board, px, py, ax, ay, pSym: false, aSym: false, turn: 0, won: false, seed, energy: 0, foe: 0, transcript: [], zoneMode: false, zones: [], signalOn: true, signalPeriod: 6, holdNeed: 3, hunters: [], lost: '', lethal: false, jamInv: 0, jamT: 0, dx: -1, dy: -1, trail: [], stickers: 0, spots: 0, spotLimit: 3, ex: -1, ey: -1 };
    this.rng = new Rng(seed);
  }
  /** M-Z4: shrine-zone siege mode. Zones claimed by stepping on them with ●. */
  enableZones(cells: [number, number][][], period: number, holdNeed: number, hunters: { x: number; y: number; wp: [number, number][] }[], hp = 3) {
    const s = this.st;
    s.zoneMode = true; s.signalPeriod = period; s.holdNeed = holdNeed; s.signalOn = true;
    s.zones = cells.map(c => ({ cells: c, claimed: false }));
    for (const z of s.zones) for (const [x, y] of z.cells) {
      if (s.board.in(x, y)) s.board.get(x, y).terrain = 'shrine';
    }
    s.hunters = hunters.map(h => ({ ...h, wi: 0, hp, dead: false }));
    for (const h of s.hunters) {
      const c = s.board.get(h.x, h.y);
      c.piece = 'spaceship'; c.hp = hp; c.dirX = 0; c.dirY = 0;
    }
  }
  /** Full-state snapshot for search/save: restore() returns to it exactly. */
  snapshot(): TurnDelta {
    const d = this.newDelta();
    d.moved = false;
    return d;
  }
  restore(snap: TurnDelta) { this.applyInverse(snap); }
  /** M-Z5: hunter pack without zones (uses waypoint loops + lethal contact). */
  enablePack(hunters: { x: number; y: number; wp: [number, number][]; dormant?: boolean }[], hp = 1) {
    const s = this.st;
    s.hunters = hunters.map(h => ({ x: h.x, y: h.y, wp: h.wp, wi: 0, hp, dead: !!h.dormant }));
    for (let i = 0; i < s.hunters.length; i++) {
      if (hunters[i].dormant) continue;
      const c = s.board.get(s.hunters[i].x, s.hunters[i].y);
      c.piece = 'spaceship'; c.hp = hp; c.dirX = 0; c.dirY = 0;
    }
  }
  /** Wake a dormant hunter (M-G4 sleeper). Snapshot-safe: dead flag + piece restore via history. */
  wakeHunter(i: number) {
    const s = this.st;
    const h = s.hunters[i];
    if (!h || !h.dead) return;
    h.dead = false;
    const c = s.board.get(h.x, h.y);
    if (c.piece === 'none') { c.piece = 'spaceship'; c.hp = 3; }
  }
  claimedCount(): number { return this.st.zones.filter(z => z.claimed).length; }
  /** M-Z5: hunters kill on contact; crush them with rocks. */
  enableLethal() { this.st.lethal = true; }
  /** M-Z5: play-dead jammers. Drop with J: hunters freeze 6 turns. */
  enableJammers(n: number) { this.st.jamInv = n; this.st.jamT = 0; }
  /** M-Z6: Deluin escort + DOG vision + stickers + exit. */
  enableEscort(dx: number, dy: number, stickers: number, spotLimit: number, ex: number, ey: number) {
    const s = this.st;
    s.dx = dx; s.dy = dy; s.stickers = stickers; s.spots = 0; s.spotLimit = spotLimit;
    s.ex = ex; s.ey = ey; s.trail = [];
    if (s.board.in(ex, ey)) s.board.get(ex, ey).terrain = 'shrine'; // exit marker (no ● on map → no auto-win)
  }
  hasEscort(): boolean { return this.st.dx >= 0; }
  /** Escape-map exit marker without escort (Veridia acts). */
  enableExit(ex: number, ey: number) {
    if (this.st.board.in(ex, ey)) this.st.board.get(ex, ey).terrain = 'shrine';
    this.st.ex = ex; this.st.ey = ey;
  }
  aliveHunters(): number { return this.st.hunters.filter(h => !h.dead).length; }
  /** J verb (M-Z5). */
  dropJammer(): TurnDelta {
    const s = this.st;
    const d = this.newDelta();
    if (s.jamInv <= 0) return d;
    s.jamInv--;
    s.jamT = 6;
    const c = s.board.get(s.px, s.py);
    c.stickerT = 2; // jammer mark
    d.moved = true;
    this.note(`you DROP jammer — play dead (${s.jamInv} left)`);
    s.turn++;
    this.tick();
    void this.rng.nextGame();
    return d;
  }
  /** S verb (M-Z6). Paints the FACING cell (proactive cover): whoever stands
   *  on paint is hidden. Paint the lane ahead, walk Deluin over it later. */
  paintSticker(dx: number, dy: number): TurnDelta {
    const s = this.st;
    const d = this.newDelta();
    if (!this.hasEscort() || s.stickers <= 0) return d;
    const nx = s.px + dx, ny = s.py + dy;
    if (!s.board.in(nx, ny)) return d;
    const c = s.board.get(nx, ny);
    if (c.piece !== 'none' || c.symbol || c.stickerT === 1) return d;
    c.stickerT = 1;
    s.stickers--;
    d.moved = true;
    this.note(`you paint (${nx},${ny}) (${s.stickers} left)`);
    s.turn++;
    this.tick();
    void this.rng.nextGame();
    return d;
  }
  private snap(): Cell[] { return this.st.board.cells.map(c => ({ ...c })); }
  private note(t: string) { this.st.transcript.push(`T${this.st.turn} ${t}`); }
  private newDelta(): TurnDelta {
    const s = this.st;
    return {
      turn: s.turn, snap: this.snap(), rngState: this.rng.snapshot(),
      px: s.px, py: s.py, ax: s.ax, ay: s.ay,
      pSym: s.pSym, aSym: s.aSym, won: s.won, moved: false,
      energy: s.energy, foe: s.foe, tlen: s.transcript.length,
      signalOn: s.signalOn, claimed: s.zones.map(z => z.claimed),
      hunters: s.hunters.map(h => ({ x: h.x, y: h.y, wi: h.wi, dead: h.dead })),
      lost: s.lost, jamInv: s.jamInv, jamT: s.jamT,
      dx: s.dx, dy: s.dy, trailLen: s.trail.length,
      stickers: s.stickers, spots: s.spots,
    };
  }
  tryMove(dx: number, dy: number, who: 'p' | 'a'): TurnDelta {
    const s = this.st;
    const d = this.newDelta();
    const ok = this.moveOne(dx, dy, who);
    if (!ok) return d;
    d.moved = true;
    // Folded coop: player move also steps ally same dir if it can move (single turn, single delta).
    if (who === 'p') {
      const followed = this.moveOne(dx, dy, 'a');
      this.note(`you (${dx},${dy})${followed ? ' +B follows' : ''}`);
    }
    s.turn++;
    if (this.hasEscort() && who === 'p') {
      s.trail.push([s.px, s.py]);
      if (s.trail.length > 5000) s.trail.shift(); // far beyond any limit; shift breaks snapshot undo, so keep it unreachable
      this.stepDeluin();
    }
    this.tick();
    if (this.hasEscort()) this.checkSpots();
    void this.rng.nextGame();
    return d;
  }
  private stepDeluin() {
    const s = this.st;
    if (s.dx < 0 || s.won || s.lost) return;
    const t = s.trail[s.trail.length - 3]; // 2-turn-delay shadow
    if (!t) return;
    const dx = Math.sign(t[0] - s.dx), dy = Math.sign(t[1] - s.dy);
    const opts: [number, number][] = dx !== 0 && dy !== 0
      ? (Math.abs(t[0] - s.dx) >= Math.abs(t[1] - s.dy) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]])
      : [[dx, dy]];
    for (const [ox, oy] of opts) {
      if (ox === 0 && oy === 0) return; // arrived
      const nx = s.dx + ox, ny = s.dy + oy;
      if (!s.board.in(nx, ny)) continue;
      const nc = s.board.get(nx, ny);
      if (nc.piece !== 'none') continue;
      if ((nx === s.px && ny === s.py) || (nx === s.ax && ny === s.ay)) continue;
      s.dx = nx; s.dy = ny;
      break;
    }
    // Win: you on exit with Deluin close behind.
    if (s.px === s.ex && s.py === s.ey && Math.abs(s.dx - s.ex) + Math.abs(s.dy - s.ey) <= 3) {
      s.won = true;
      this.note('Deluin reaches the shore — everyone out');
    }
  }
  private nearJammer(hx: number, hy: number): boolean {
    const s = this.st;
    for (let y = 0; y < s.board.h; y++) for (let x = 0; x < s.board.w; x++) {
      if (s.board.get(x, y).stickerT === 2 && Math.max(Math.abs(x - hx), Math.abs(y - hy)) <= 3) return true;
    }
    return false;
  }
  private sees(fx: number, fy: number, tx: number, ty: number): boolean {
    const s = this.st;
    // Vision radius 3: at 4, an open east (M-Z6 exit run) can never hide —
    // every step stays in view and no sticker budget survives it.
    const dist = Math.max(Math.abs(fx - tx), Math.abs(fy - ty));
    if (dist > 3 || dist === 0) return dist === 0;
    if (dist <= 1) return true;
    // Bresenham LOS, blocked by solid pieces.
    let x0 = fx, y0 = fy;
    const x1 = tx, y1 = ty;
    const dxm = Math.abs(x1 - x0), dym = Math.abs(y1 - y0);
    const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    let err = dxm - dym;
    for (let guard = 0; guard < 24; guard++) {
      const e2 = 2 * err;
      if (e2 > -dym) { err -= dym; x0 += sx; }
      if (e2 < dxm) { err += dxm; y0 += sy; }
      if (x0 === x1 && y0 === y1) break;
      const c = s.board.in(x0, y0) ? s.board.get(x0, y0) : null;
      if (!c || c.piece === 'wall' || c.piece === 'factory' || c.piece === 'mirror' || c.piece === 'rock') return false;
    }
    return true;
  }
  private nearPaint(x: number, y: number): boolean {
    const s = this.st;
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
      if (s.board.in(xx, yy) && s.board.get(xx, yy).stickerT === 1) return true;
    }
    return false;
  }
  private checkSpots() {
    const s = this.st;
    if (s.won || s.lost) return;
    for (const h of s.hunters) {
      if (h.dead) continue;
      // Cover is shared and local: paint hides whoever stands on/near it.
      // Paint the lane ahead, walk Deluin over it two turns later.
      const pHidden = this.nearPaint(s.px, s.py);
      const dHidden = s.dx >= 0 && this.nearPaint(s.dx, s.dy);
      if ((!pHidden && this.sees(h.x, h.y, s.px, s.py)) || (!dHidden && this.sees(h.x, h.y, s.dx, s.dy))) {
        s.spots++;
        this.note(`noticed! (${s.spots}/${s.spotLimit})`);
        if (s.spots >= s.spotLimit) s.lost = 'spotted';
        return; // max 1 per turn
      }
    }
  }
  /** Build-wall program verb (M-Z2): costs 2 energy, consumes a turn. */
  buildWall(dx: number, dy: number): TurnDelta {
    const s = this.st;
    const d = this.newDelta();
    if (s.energy < 2) return d;
    const nx = s.px + dx, ny = s.py + dy;
    if (!s.board.in(nx, ny)) return d;
    if (nx === s.ax && ny === s.ay) return d;
    const c = s.board.get(nx, ny);
    if (c.piece !== 'none' || c.symbol || c.terrain === 'shrine') return d;
    c.piece = 'wall';
    s.energy -= 2;
    d.moved = true;
    this.note(`you BUILD wall (${nx},${ny})`);
    s.turn++;
    this.tick();
    void this.rng.nextGame();
    return d;
  }
  /** Signal-flip program verb (M-Z4): costs 2 energy, consumes a turn. */
  flipSignal(): TurnDelta {
    const s = this.st;
    const d = this.newDelta();
    if (!s.zoneMode || s.energy < 2) return d;
    s.energy -= 2;
    s.signalOn = !s.signalOn;
    d.moved = true;
    this.note(`you FLIP signal ${s.signalOn ? 'ON' : 'OFF'}`);
    s.turn++;
    this.tick();
    void this.rng.nextGame();
    return d;
  }
  private moveOne(dx: number, dy: number, who: 'p' | 'a'): boolean {
    const s = this.st;
    const cx = who === 'p' ? s.px : s.ax;
    const cy = who === 'p' ? s.py : s.ay;
    const nx = cx + dx, ny = cy + dy;
    if (!s.board.in(nx, ny)) return false;
    // No stacking vs hunters/objects, but player and ally are ghosts to each
    // other (Second Player): they pass through, never block. This keeps the
    // shared-turn offset from sealing lanes shut.
    const nc = s.board.get(nx, ny);
    if (nc.piece === 'wall' || nc.piece === 'factory' || nc.piece === 'mirror') return false;
    // XOR signal: shrine zones are sealed while signal is OFF.
    if (s.zoneMode && !s.signalOn && nc.terrain === 'shrine') return false;
    if (nc.piece === 'rock') {
      const bx = nx + dx, by = ny + dy;
      if (!s.board.in(bx, by)) return false;
      const bc = s.board.get(bx, by);
      if (bc.piece === 'spaceship') {
        bc.hp -= 1;
        if (bc.hp <= 0) {
          bc.piece = 'none'; bc.hp = 0; bc.dirX = 0; bc.dirY = 0;
          for (const h of s.hunters) if (!h.dead && h.x === bx && h.y === by) h.dead = true;
          if (s.lethal && this.aliveHunters() === 0) { s.won = true; this.note('all drones down — training data denied'); }
        }
        this.commitMove(who, nx, ny);
        return true;
      }
      // Rocks cannot be pushed onto shrines (would softlock win).
      if (bc.piece !== 'none' || bc.terrain === 'shrine') return false;
      bc.piece = 'rock';
      nc.piece = 'none';
      this.commitMove(who, nx, ny);
      return true;
    }
    if (nc.piece === 'spaceship') return false;
    this.commitMove(who, nx, ny);
    return true;
  }
  private commitMove(who: 'p' | 'a', nx: number, ny: number) {
    const s = this.st;
    if (who === 'p') { s.px = nx; s.py = ny; } else { s.ax = nx; s.ay = ny; }
    const c = s.board.get(nx, ny);
    if (c.symbol) {
      c.symbol = false;
      if (who === 'p') s.pSym = true; else s.aSym = true;
    }
    if (c.terrain !== 'shrine') return;
    if (s.zoneMode) {
      if ((who === 'p' && s.pSym) || (who === 'a' && s.aSym)) {
        for (let i = 0; i < s.zones.length; i++) {
          const z = s.zones[i];
          if (!z.claimed && z.cells.some(([x, y]) => x === nx && y === ny)) {
            z.claimed = true;
            this.note(`zone ${i + 1} CLAIMED (${this.claimedCount()}/${s.holdNeed})`);
            if (this.claimedCount() >= s.holdNeed) s.won = true;
          }
        }
      }
      return;
    }
    if ((who === 'p' && s.pSym) || (who === 'a' && s.aSym)) s.won = true;
  }
  private tick() {
    const s = this.st;
    if (s.turn % 2 === 0) {
      this.patrol();
      if (s.jamT > 0) {
        s.jamT--;
        if (s.jamT === 0) this.note('jammers fade — drones wake');
      }
      if (s.hunters.length) this.stepHunters();
    }
    // XOR signal toggle on period boundary.
    if (s.zoneMode && s.turn % s.signalPeriod === 0) {
      s.signalOn = !s.signalOn;
      this.note(`signal ${s.signalOn ? 'ON' : 'OFF'}`);
    }
    // Rival factory pressure (Gun) — skipped in zone mode (hunters are the pressure).
    if (!s.zoneMode && s.turn % 3 === 0) { s.foe++; this.note(`Gun factory pulses (foe ${s.foe})`); }
    // Your factory charges while you hold a symbol: +1 every 4 turns.
    if (s.turn % 4 === 0 && (s.pSym || s.aSym)) { s.energy++; this.note(`your factory charges (energy ${s.energy})`); }
  }
  private stepHunters() {
    const s = this.st;
    for (const h of s.hunters) {
      if (h.dead) continue;
      const cell = s.board.get(h.x, h.y);
      if (cell.piece !== 'spaceship') { h.dead = true; continue; } // crushed by rocks
      if (s.jamT > 0 && this.nearJammer(h.x, h.y)) continue; // play dead: frozen, not buried
      const [tx, ty] = h.wp[h.wi];
      if (h.x === tx && h.y === ty) {
        h.wi = (h.wi + 1) % h.wp.length;
        continue;
      }
      const dx = Math.sign(tx - h.x), dy = Math.sign(ty - h.y);
      // Axis-first greedy step toward waypoint (x first), deterministic.
      const opts = dx !== 0 ? [[dx, 0] as [number, number], [0, dy] as [number, number]] : [[0, dy] as [number, number], [dx, 0] as [number, number]];
      for (const [ox, oy] of opts) {
        if (ox === 0 && oy === 0) continue;
        const nx = h.x + ox, ny = h.y + oy;
        if (!s.board.in(nx, ny)) continue;
        const nc = s.board.get(nx, ny);
        if (nc.piece !== 'none') continue;
        if (s.zoneMode && !s.signalOn && nc.terrain === 'shrine') continue;
        if ((nx === s.px && ny === s.py) || (nx === s.ax && ny === s.ay) || (nx === s.dx && ny === s.dy)) {
          if (s.lethal && !s.won) {
            // Hunter takes the actor: move in, run over.
            nc.piece = 'spaceship'; nc.hp = cell.hp;
            cell.piece = 'none'; cell.hp = 0;
            h.x = nx; h.y = ny;
            s.lost = 'caught';
            this.note('CAUGHT by a drone');
          }
          continue; // wait, don't kill (non-lethal)
        }
        nc.piece = 'spaceship'; nc.hp = cell.hp;
        cell.piece = 'none'; cell.hp = 0;
        h.x = nx; h.y = ny;
        break;
      }
    }
  }
  private patrol() {
    const s = this.st;
    const moves: { x: number; y: number; nx: number; ny: number }[] = [];
    const flips: { x: number; y: number }[] = [];
    for (let y = 0; y < s.board.h; y++) for (let x = 0; x < s.board.w; x++) {
      const c = s.board.get(x, y);
      if (c.piece !== 'spaceship') continue;
      const nx = x + c.dirX, ny = y + c.dirY;
      const blocked = !s.board.in(nx, ny) || s.board.get(nx, ny).piece !== 'none' || s.board.get(nx, ny).terrain === 'shrine';
      if (blocked) flips.push({ x, y });
      else {
        // Don't step onto actors.
        if ((nx === s.px && ny === s.py) || (nx === s.ax && ny === s.ay)) flips.push({ x, y });
        else moves.push({ x, y, nx, ny });
      }
    }
    for (const f of flips) { const c = s.board.get(f.x, f.y); c.dirX = -c.dirX; c.dirY = -c.dirY; }
    for (const m of moves) {
      const src = s.board.get(m.x, m.y), dst = s.board.get(m.nx, m.ny);
      dst.piece = 'spaceship'; dst.hp = src.hp; dst.dirX = src.dirX; dst.dirY = src.dirY;
      src.piece = 'none'; src.hp = 0; src.dirX = 0; src.dirY = 0;
    }
  }
  applyInverse(d: TurnDelta) {
    const s = this.st;
    s.board.cells = d.snap.map(c => ({ ...c }));
    this.rng.restore(d.rngState);
    s.px = d.px; s.py = d.py; s.ax = d.ax; s.ay = d.ay;
    s.pSym = d.pSym; s.aSym = d.aSym; s.won = d.won; s.turn = d.turn;
    s.energy = d.energy; s.foe = d.foe;
    s.signalOn = d.signalOn;
    d.claimed.forEach((c, i) => { if (s.zones[i]) s.zones[i].claimed = c; });
    d.hunters.forEach((h, i) => { if (s.hunters[i]) Object.assign(s.hunters[i], h); });
    s.lost = d.lost; s.jamInv = d.jamInv; s.jamT = d.jamT;
    s.dx = d.dx; s.dy = d.dy; s.trail.length = d.trailLen;
    s.stickers = d.stickers; s.spots = d.spots;
    s.transcript.length = d.tlen;
  }
}
