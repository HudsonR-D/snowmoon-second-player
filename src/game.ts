import { Board } from './minpentai/board.js';
import { Sim } from './minpentai/sim.js';
import { History } from './minpentai/history.js';
import { drawBoard } from './minpentai/render.js';
import { Flags, condOk, type DlgNode } from './narrative/dialogue.js';
import { Deduction } from './narrative/deduction.js';
import { runPoll } from './narrative/poll.js';
import { setHud, showDlg } from './ui/hud.js';
import { blip, sMove, sClick, sBuild, sRewind, sWin, sLose, sNotice } from './audio.js';
import { saveFlags, loadFlags } from './save.js';
import mz1 from './content/m-z1.json';
import mg1 from './content/m-g1.json';
import mz2 from './content/m-z2.json';
import mz3 from './content/m-z3.json';
import mz4 from './content/m-z4.json';
import mz5 from './content/m-z5.json';
import mz6 from './content/m-z6.json';
import g2 from './content/g2.json';
import g3 from './content/g3.json';
import g4 from './content/g4.json';
import g5 from './content/g5.json';
import g6 from './content/g6.json';
import { HexBoard, HexSim, HEX_DIRS, hexCenter, drawHexBoard, type HexDelta } from './minpentai/hex.js';

type Scene = 'hub' | 'mz1' | 'mg1' | 'mz2' | 'mz3' | 'mz4' | 'mz5' | 'mz6' | 'mg2' | 'mg3' | 'mg4' | 'mg5' | 'mg6';
const OBJ = 'Z=you B=ally ●=symbol ◆=shrine ■=rock ▭=mirror R=patrol';
function setObj(s: string) {
  const el = document.getElementById('obj');
  if (el) el.textContent = s;
}

export class Game {
  ctx: CanvasRenderingContext2D;
  dlg = document.getElementById('dlg')!;
  scene: Scene = 'hub';
  sim!: Sim; hist = new History();
  flags = new Flags();
  ded = new Deduction(((mg1 as unknown) as { requireLink: [string, string] }).requireLink);
  mapLive = false;
  lastDir = { dx: 0, dy: -1 };
  hsim!: HexSim; hhist: HexDelta[] = []; charges = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    loadFlags(this.flags);
    this.toHub();
    window.addEventListener('keydown', e => this.onKey(e));
    this.enableTouch();
  }
  buildBoard(j: { w: number; h: number; walls?: number[][]; rocks?: number[][]; mirrors?: number[][]; factories?: number[][]; symbols: number[][]; shrine?: number[]; player: number[]; ally: number[]; seed: string; spaceships?: { x: number; y: number; hp: number; dx: number; dy: number }[] }): Sim {
    const b = new Board(j.w, j.h);
    const put = (x: number, y: number, fn: (c: ReturnType<Board['get']>) => void) => {
      if (!b.in(x, y)) throw new Error(`content OOB: ${x},${y} on ${j.w}x${j.h}`);
      fn(b.get(x, y));
    };
    for (const [x, y] of j.walls ?? []) put(x, y, c => { c.piece = 'wall'; });
    for (const [x, y] of j.rocks ?? []) put(x, y, c => { c.piece = 'rock'; });
    for (const [x, y] of j.mirrors ?? []) put(x, y, c => { c.piece = 'mirror'; });
    for (const [x, y] of j.factories ?? []) put(x, y, c => { c.piece = 'factory'; });
    for (const [x, y] of j.symbols) put(x, y, c => { c.symbol = true; });
    if (j.shrine) put(j.shrine[0], j.shrine[1], c => { c.terrain = 'shrine'; });
    for (const s of j.spaceships ?? []) put(s.x, s.y, c => { c.piece = 'spaceship'; c.hp = s.hp; c.dirX = s.dx; c.dirY = s.dy; });
    if (!b.in(j.player[0], j.player[1]) || !b.in(j.ally[0], j.ally[1])) throw new Error('content actor OOB');
    return new Sim(b, j.player[0], j.player[1], j.ally[0], j.ally[1], j.seed);
  }
  savedLine(): string {
    const f = this.flags.dump();
    const z = f['MZ1_DONE'] ? 'M-Z1 ✓' : 'M-Z1 —';
    const g = f['MG1_DONE'] ? 'M-G1 ✓' : 'M-G1 —';
    const z2 = f['MZ2_DONE'] ? 'M-Z2 ✓' : 'M-Z2 —';
    const z3 = f['MZ3_DONE'] ? 'M-Z3 ✓' : 'M-Z3 —';
    const z4 = f['MZ4_DONE'] ? 'M-Z4 ✓' : 'M-Z4 —';
    const z5 = f['MZ5_DONE'] ? 'M-Z5 ✓' : 'M-Z5 —';
    const z6 = f['MZ6_DONE'] ? 'M-Z6 ✓' : 'M-Z6 —';
    const v = ['MG1_DONE', 'MG2_DONE', 'MG3_DONE', 'MG4_DONE', 'MG5_DONE', 'MG6_DONE'].map(k => (f[k] ? '✓' : '—')).join('');
    const end = f['ENDING'] ? ` END:${f['ENDING']}` : '';
    return `Saved: Z ${z} / ${z2} / ${z3} / ${z4} / ${z5} / ${z6} · V ${v}${end}.`;
  }
  toHub() {
    this.scene = 'hub';
    this.mapLive = false;
    const t = document.getElementById('transcript'); if (t) t.innerHTML = '';
    const f = this.flags.dump();
    const tick = (k: string) => (f[k] ? '✓' : '·');
    // Suggested path interleaves story + ramps ★1→4.
    setHud('Hub — suggested: Z1 → G1 → G2 → Z2 → G3 → Z3 → G4 → Z4 → G5 → Z5 → Z6 → G6.');
    setObj(`Full campaign: Zei tactics + Veridia acts. Ghost-ally B never blocks you. ${OBJ}`);
    showDlg(`<b>SNOWMOON: Second Player</b> — campaign board (suggested order)<br/>` +
      `Z1 silent-coop ★☆☆☆ ${tick('MZ1_DONE')} · G1 dreadknot ★☆☆☆ ${tick('MG1_DONE')} · G2 pitch ★☆☆☆ ${tick('MG2_DONE')}<br/>` +
      `Z2 factories ★★☆☆ ${tick('MZ2_DONE')} · G3 debates ★★☆☆ ${tick('MG3_DONE')} · Z3 hex ★★★☆ ${tick('MZ3_DONE')}<br/>` +
      `G4 ghost-net ★★☆☆ ${tick('MG4_DONE')} · Z4 siege ★★★☆ ${tick('MZ4_DONE')} · G5 houses ★☆☆☆ ${tick('MG5_DONE')}<br/>` +
      `Z5 lure ★★★★ ${tick('MZ5_DONE')} · Z6 escort ★★★★ ${tick('MZ6_DONE')} · G6 coup ★★★★ ${tick('MG6_DONE')}<br/>` +
      `${this.epilogue()}${this.savedLine()}`);
    this.render();
  }
  epilogue(): string {
    if (!this.flags.get('MG6_DONE')) return '';
    const end = this.flags.get('ENDING');
    const lily = this.flags.get('LILY_HIGH');
    const thaldur = end === 'WATER'
      ? 'Thaldur opens. GPH ferries run at dawn; Zei\'s pilots fly cover and Gladias cooks Dzego food for the whole atrium.'
      : 'Thaldur holds. The Keepers keep their culture behind clean lines; Zei fights on while Gladias talks.';
    const lil = lily
      ? 'Lily speaks at the reunion — fast, angry, forgiven.'
      : 'Lily is missing from the reunion photo. The chair stays empty.';
    return `<b>Ending (${end}):</b> ${thaldur} ${lil}<br/>`;
  }
  playMZ1() {
    this.scene = 'mz1'; this.hist.clear(); this.mapLive = true;
    this.sim = this.buildBoard(mz1 as unknown as Parameters<Game['buildBoard']>[0]);
    setHud(`M-Z1 Silent Quarter — WASD/arrows move. Symbol then shrine. Par ${(mz1 as { par: number }).par}. U rewind 1 step, R restart.`);
    setObj(`M-Z1 objective: 1) take ● 2) end on ◆ with ●. Shared turn with B (ally follows your step). ${OBJ}`);
    showDlg(`<b>Mu:</b> Talk is banned. Your ally steps with you — one shared turn. Bumps cost nothing and don't count.`);
    this.render();
  }
  playMZ2() {
    this.scene = 'mz2'; this.hist.clear(); this.mapLive = true;
    this.sim = this.buildBoard(mz2 as unknown as Parameters<Game['buildBoard']>[0]);
    const j = mz2 as { par: number; foeLimit: number };
    setHud(`M-Z2 Transparent Final — factory charges while you hold ● (+1/4t), B builds wall (2 energy), Gun +1/3t. Shrine-out in ${j.par} before foe ${j.foeLimit}. U rewind, R restart.`);
    setObj(`M-Z2 objective: 1) take ● 2) B builds walls to slow patrol 3) end on ◆ before foe ${j.foeLimit}. Transcript below — click entry to rewind. ${OBJ}`);
    showDlg(`<b>Zei:</b> They read us. So we write faster. <b>Fin:</b> Factories are votes — out-vote Gun.`);
    this.renderTranscript();
    this.render();
  }
  playMZ3() {
    const j = mz3 as { seed: string; radius: number; walls: number[][]; rocks: number[][]; symbols: number[][]; shrine: number[]; player: number[]; bo: number[]; holdNeed: number; turnLimit: number; charges: number };
    const b = new HexBoard(j.radius);
    for (const [q, r] of j.walls) if (b.has(q, r)) b.get(q, r).piece = 'wall';
    for (const [q, r] of j.rocks) if (b.has(q, r)) b.get(q, r).piece = 'rock';
    for (const [q, r] of j.symbols) if (b.has(q, r)) b.get(q, r).symbol = true;
    b.get(j.shrine[0], j.shrine[1]).terrain = 'shrine';
    this.scene = 'mz3'; this.hhist = []; this.charges = j.charges; this.mapLive = true;
    this.hsim = new HexSim(b, j.player[0], j.player[1], j.bo[0], j.bo[1], j.seed, j.holdNeed, j.turnLimit);
    setHud(`M-Z3 Bo Qualifier — hex grid. Keys Q/E/A/D/Z/C or tap adjacent hex. Hold middle 8 turns with ●. 3 rewind charges.`);
    setObj(`M-Z3 objective: 1) take ● 2) hold middle ${j.holdNeed} turns 3) dodge Bo (rock stuns). U or transcript entry = 1 charge. ${OBJ}`);
    showDlg(`<b>Bo:</b> I ran you 10k times. <b>Zei:</b> Run this one.`);
    this.renderHexTranscript();
    this.render();
  }
  playMZ4() {
    const j = (mz4 as unknown) as { seed: string; zones: [number, number][][]; signalPeriod: number; holdNeed: number; turnLimit: number; charges: number; hunters: { x: number; y: number; wp: [number, number][] }[] };
    this.scene = 'mz4'; this.hist.clear(); this.charges = j.charges; this.mapLive = true;
    this.sim = this.buildBoard(mz4 as unknown as Parameters<Game['buildBoard']>[0]);
    this.sim.enableZones(j.zones, j.signalPeriod, j.holdNeed, j.hunters);
    const defer = this.flags.get('G3_DEFER');
    const over = defer === true
      ? `<br/><b>Verdow (via Seila):</b> Deferred vote bought us coverage — Veridia overwatch is up. Cache: +2 energy.`
      : defer === false
        ? `<br/><b>Verdow (via Seila):</b> Forced vote jammed the request. No overwatch — you're on your own.`
        : '';
    if (defer === true) this.sim.st.energy = 2;
    setHud(`M-Z4 XOR Siege — claim ${j.holdNeed} of ${j.zones.length} shrine zones with ● in ${j.turnLimit}t. Signal toggles /${j.signalPeriod}t, F flips (2 energy). 3 charges.`);
    setObj(`M-Z4 objective: 1) take ● 2) step on zones while ON 3) F flips signal. U or transcript = 1 charge. ${OBJ}`);
    showDlg(`<b>Mu:</b> Shrines invert. Don't fight it — gate it. <b>Gun</b> walks his loops; take your windows.${over}`);
    this.renderMz4Transcript();
    this.render();
  }
  playMZ5() {
    const j = (mz5 as unknown) as { hunters: { x: number; y: number; wp: [number, number][] }[]; jammers: number; turnLimit: number; charges: number };
    this.scene = 'mz5'; this.hist.clear(); this.charges = j.charges; this.mapLive = true;
    this.sim = this.buildBoard(mz5 as unknown as Parameters<Game['buildBoard']>[0]);
    this.sim.enablePack(j.hunters, 1);
    this.sim.enableLethal();
    this.sim.enableJammers(j.jammers);
    const mov = this.flags.get('MOV_HIDDEN');
    const backdoor = mov === false
      ? `<br/><b>Fin:</b> Mov burned at GPH — we're dark. Seila's hack will have to do.`
      : `<br/><b>Fin:</b> Mov's backdoor held. Freetown feeds are warm.`;
    setHud(`M-Z5 Redshire Lure — crush ${j.hunters.length} hunter drones with rocks in ${j.turnLimit}t. Touch = death. J drops jammer (freezes ≤3 for 6t). 3 charges.`);
    setObj(`M-Z5 objective: crush all hunters with rocks. J = jammer, U/transcript = 1 charge. ${OBJ}`);
    showDlg(`<b>Fin:</b> Play dead. Drones bury what doesn't move — then drop rock on them.${backdoor}`);
    this.renderTourTranscript('M-Z5');
    this.render();
  }
  playMZ6() {
    const j = (mz6 as unknown) as { hunters: { x: number; y: number; wp: [number, number][] }[]; deluin: number[]; stickers: number; spotLimit: number; exit: number[]; turnLimit: number; charges: number };
    this.scene = 'mz6'; this.hist.clear(); this.charges = j.charges; this.mapLive = true;
    this.sim = this.buildBoard(mz6 as unknown as Parameters<Game['buildBoard']>[0]);
    this.sim.enablePack(j.hunters, 3);
    this.sim.enableEscort(j.deluin[0], j.deluin[1], j.stickers, j.spotLimit, j.exit[0], j.exit[1]);
    setHud(`M-Z6 DOG Escort — walk Deluin (D) to the gold exit in ${j.turnLimit}t. Seen ${j.spotLimit}x = blown. S paints cover (invisible on it). B is a ghost — DOGs can't see him. 3 charges.`);
    setObj(`M-Z6 objective: reach ◆ exit with D close. S = sticker, U/transcript = 1 charge. ${OBJ}`);
    showDlg(`<b>Deluin:</b> Write where only friends look. I'll trail two steps behind — don't sprint blind.`);
    this.renderTourTranscript('M-Z6');
    this.render();
  }
  playMG1() {
    this.scene = 'mg1'; this.hist.clear(); this.mapLive = false;
    this.ded = new Deduction(((mg1 as unknown) as { requireLink: [string, string] }).requireLink);
    this.sim = this.buildBoard(mg1 as unknown as Parameters<Game['buildBoard']>[0]);
    setHud('M-G1 Dreadknot — talk through 2 screens, vote, link 2 clues, then move: rock into patrol, take symbol to shrine.');
    setObj(`M-G1 objective: 1) finish talk 2) vote 3) link 2 clues 4) rock → patrol 5) ● → ◆. ${OBJ}`);
    this.showNode('start');
    this.render();
  }
  onKey(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (k.startsWith('arrow')) e.preventDefault();
    if (k === 'u') return this.scene === 'mz3' ? this.hexRewind() : this.rewind();
    if (k === 'r') {
      const R: Record<string, () => void> = {
        mz1: () => this.playMZ1(), mz2: () => this.playMZ2(), mz3: () => this.playMZ3(),
        mz4: () => this.playMZ4(), mz5: () => this.playMZ5(), mz6: () => this.playMZ6(),
        mg1: () => this.playMG1(), mg2: () => this.playMG2(), mg3: () => this.playMG3(),
        mg4: () => this.playMG4(), mg5: () => this.playMG5(), mg6: () => this.playMG6(),
      };
      return R[this.scene]?.();
    }
    if (k === 'f' && this.scene === 'mz4') return this.flip();
    if (k === 'j' && (this.scene === 'mz5' || (this.scene === 'mg4' && this.mapLive))) return this.jam();
    if (k === 'v' && this.scene === 'mz6') return this.sticker();
    if (this.scene === 'mz3') {
      const hi = k === 'd' ? 0 : k === 'e' ? 1 : k === 'q' ? 2 : k === 'a' ? 3 : k === 'z' ? 4 : k === 'c' ? 5 : -1;
      if (hi >= 0) return this.hexStep(hi);
      return;
    }
    if (k === 'b' && (this.scene === 'mz2' || this.scene === 'mz1')) return this.build(this.lastDir.dx, this.lastDir.dy);
    const dir = k === 'w' || k === 'arrowup' ? [0, -1] : k === 's' || k === 'arrowdown' ? [0, 1] : k === 'a' || k === 'arrowleft' ? [-1, 0] : k === 'd' || k === 'arrowright' ? [1, 0] : null;
    if (dir) {
      this.lastDir = { dx: dir[0], dy: dir[1] };
      const mapOK = this.scene === 'mz1' || this.scene === 'mz2' || this.scene === 'mz4' || this.scene === 'mz5' || this.scene === 'mz6' ||
        ((this.scene === 'mg1' || this.scene === 'mg4' || this.scene === 'mg6') && this.mapLive);
      if (mapOK) this.step(dir[0], dir[1]);
    }
  }
  enableTouch() {
    const cv = this.ctx.canvas;
    let sx = 0, sy = 0, pid = -1;
    cv.addEventListener('pointerdown', e => { if (pid !== -1) return; pid = e.pointerId; sx = e.clientX; sy = e.clientY; });
    cv.addEventListener('pointercancel', () => { pid = -1; });
    cv.addEventListener('pointerup', e => {
      if (e.pointerId !== pid) return; pid = -1;
      if (this.scene === 'hub' || (this.scene !== 'mz3' && !this.sim)) return;
      if ((this.scene === 'mg1' || this.scene === 'mg4' || this.scene === 'mg6') && !this.mapLive) return;
      if (this.scene === 'mg2' || this.scene === 'mg3' || this.scene === 'mg5') return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { this.tapMove(e); return; }
      if (this.scene === 'mz3') return this.hexSwipe(dx, dy);
      const d = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      this.step(d[0], d[1]);
    });
  }
  tapMove(e: PointerEvent) {
    if (this.scene === 'hub' || (!this.sim && this.scene !== 'mz3')) return;
    if ((this.scene === 'mg1' || this.scene === 'mg4' || this.scene === 'mg6') && !this.mapLive) return;
    if (this.scene === 'mg2' || this.scene === 'mg3' || this.scene === 'mg5') return;
    if (this.scene === 'mz3') return this.hexTap(e);
    const r = this.ctx.canvas.getBoundingClientRect();
    const gx = Math.floor(((e.clientX - r.left) / r.width) * this.sim.st.board.w);
    const gy = Math.floor(((e.clientY - r.top) / r.height) * this.sim.st.board.h);
    const dx = Math.sign(gx - this.sim.st.px), dy = Math.sign(gy - this.sim.st.py);
    if (Math.abs(gx - this.sim.st.px) + Math.abs(gy - this.sim.st.py) === 1) this.step(dx, dy);
  }
  step(dx: number, dy: number) {
    if ((this.scene === 'mz4') && (this.sim.st.won || this.sim.st.turn >= (mz4 as { turnLimit: number }).turnLimit)) return;
    if ((this.scene === 'mz5' || this.scene === 'mz6') && (this.sim.st.won || this.sim.st.lost)) return;
    if (this.scene === 'mz5' && this.sim.st.turn >= (mz5 as { turnLimit: number }).turnLimit) return;
    if (this.scene === 'mz6' && this.sim.st.turn >= (mz6 as { turnLimit: number }).turnLimit) return;
    if (this.scene === 'mg4' && (this.sim.st.won || this.sim.st.turn >= (g4 as { turnLimit: number }).turnLimit)) return;
    if (this.scene === 'mg6' && (this.sim.st.won || this.sim.st.lost || this.sim.st.turn >= (g6 as { turnLimit: number }).turnLimit)) return;
    const before = this.sim.st.turn;
    const d = this.sim.tryMove(dx, dy, 'p');
    if (!d.moved || this.sim.st.turn === before) return; // blocked: no history, no spam
    this.hist.push(d);
    if (this.sim.st.won) sWin(); else sMove();
    if (this.scene === 'mg1') this.mg1AfterMove();
    else if (this.scene === 'mz2') this.mz2AfterMove();
    else if (this.scene === 'mz4') this.mz4AfterMove();
    else if (this.scene === 'mz5') this.mz5AfterMove();
    else if (this.scene === 'mz6') this.mz6AfterMove();
    else if (this.scene === 'mg4') this.mg4AfterMove();
    else if (this.scene === 'mg6') this.mg6AfterMove();
    else if (this.sim.st.won) {
      this.flags.set('MZ1_DONE', true); saveFlags(this.flags);
      showDlg(`<b>Mu:</b> Clean. ${this.sim.st.turn} turns (par ${(mz1 as { par: number }).par}). Silent works. <button onclick="document.getElementById('btnHub').click()">Hub</button><br/>${this.savedLine()}`);
      setHud(`M-Z1 WON in ${this.sim.st.turn} turns. U rewinds 1 step. Saved.`);
      setObj(`M-Z1 done in ${this.sim.st.turn} turns. ${this.savedLine()} ${OBJ}`);
    } else {
      setHud(`M-Z1 turn ${this.sim.st.turn} — symbol ${this.sim.st.pSym ? 'yes' : 'no'} — U rewinds`);
    }
    this.render();
  }
  build(dx: number, dy: number) {
    if (this.scene !== 'mz2' && this.scene !== 'mz1' && this.scene !== 'mz4') return;
    if (this.scene === 'mz4') { setHud('M-Z4 has no factory walls — F flips the signal (2 energy).'); return; }
    if (this.scene === 'mz1') { setHud('M-Z1 has no factory — finish it, then spend energy in M-Z2.'); return; }
    const before = this.sim.st.turn;
    const d = this.sim.buildWall(dx, dy);
    if (!d.moved || this.sim.st.turn === before) { setHud(`Can't build there (need 2 energy, free adjacent cell, not shrine/symbol). Energy ${this.sim.st.energy}.`); return; }
    this.hist.push(d);
    sBuild();
    this.mz2AfterMove();
    this.render();
  }
  mz2AfterMove() {
    const j = mz2 as { par: number; foeLimit: number };
    this.renderTranscript();
    if (this.sim.st.won) {
      this.flags.set('MZ2_DONE', true); saveFlags(this.flags);
      showDlg(`<b>Fin:</b> Out-voted Gun ${this.sim.st.turn}t to ${this.sim.st.foe}. Factories are votes. <button onclick="document.getElementById('btnHub').click()">Hub</button><br/>${this.savedLine()}`);
      setHud(`M-Z2 WON turn ${this.sim.st.turn} — foe ${this.sim.st.foe}. Saved.`);
      setObj(`M-Z2 done. ${this.savedLine()} ${OBJ}`);
    } else if (this.sim.st.foe >= j.foeLimit) {
      showDlg(`<b>Mu:</b> Gun hit ${this.sim.st.foe}. Out-produced — U rewinds, B walls the lane, shrine-out faster. <button onclick="document.getElementById('btnHub').click()">Hub</button>`);
      setHud(`M-Z2 LOST — foe ${this.sim.st.foe}/${j.foeLimit} at turn ${this.sim.st.turn}. U rewind or R restart.`);
      sLose();
    } else {
      setHud(`M-Z2 turn ${this.sim.st.turn}/${j.par} — energy ${this.sim.st.energy} foe ${this.sim.st.foe}/${j.foeLimit} — B builds (2). U rewinds.`);
    }
  }
  renderTranscript() {
    let t = document.getElementById('transcript');
    if (!t) return;
    const lines = this.sim.st.transcript;
    const last = lines.slice(-12);
    t.innerHTML = `<b>Transcript (mutual, click to rewind):</b><br/>` + (last.length ? '' : '<span style="opacity:.6">no moves yet</span>') +
      last.map((l, i) => {
        const k = lines.length - last.length + i;
        return `<button data-tk="${k}" style="min-height:32px;padding:4px 8px;font-size:13px;margin:2px 4px 2px 0">${l}</button>`;
      }).join('');
    t.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => this.jumpToEntry(Number((b as HTMLElement).dataset.tk)));
    });
  }
  jumpToEntry(k: number) {
    // Entry k logged during move to turn k+1 → restore that state.
    let n = 0;
    while (this.sim.st.turn > k + 1 && this.hist.length && n < 200) { const d = this.hist.pop(); if (d) this.sim.applyInverse(d); n++; }
    sRewind();
    if (this.scene === 'mz2') { this.mz2AfterMove(); }
    else setHud(`Rewound to turn ${this.sim.st.turn}`);
    this.render();
  }
  // ---- M-Z3 hex ----
  hexStep(di: number) {
    if (this.scene !== 'mz3' || this.hsim.won) return;
    const before = this.hsim.turn;
    const d = this.hsim.tryPlayerMove(di);
    if (!d.moved || this.hsim.turn === before) return;
    this.hhist.push(d);
    if (this.hsim.won) sWin(); else if (this.hsim.lost) sLose(); else sMove();
    this.mz3AfterMove();
    this.render();
  }
  hexRewind(): void {
    if (this.scene !== 'mz3') return this.rewind();
    if (this.charges <= 0) { setHud('M-Z3 no charges left — R restarts.'); return; }
    const d = this.hhist.pop();
    if (!d) return;
    this.hsim.applyInverse(d);
    this.charges--;
    sRewind();
    this.mz3AfterMove();
    this.render();
  }
  mz3AfterMove() {
    this.renderHexTranscript();
    const j = mz3 as { holdNeed: number; turnLimit: number };
    if (this.hsim.won) {
      this.flags.set('MZ3_DONE', true); saveFlags(this.flags);
      this.mapLive = false;
      showDlg(`<b>Zei:</b> Debugged. Bo, you ran the wrong me. <button onclick="document.getElementById('btnHub').click()">Hub</button><br/>${this.savedLine()}`);
      setHud(`M-Z3 WON turn ${this.hsim.turn}. Saved.`);
      setObj(`M-Z3 done. ${this.savedLine()} ${OBJ}`);
    } else if (this.hsim.lost === 'caught') {
      showDlg(`<b>Bo:</b> Got you. U spends a charge (${this.charges} left) or R restarts.`);
      setHud(`M-Z3 CAUGHT turn ${this.hsim.turn} — charges ${this.charges}. U rewinds (1 charge).`);
      sLose();
    } else if (this.hsim.lost === 'time') {
      setHud(`M-Z3 TIME turn ${this.hsim.turn}/${j.turnLimit} — R restarts, charges reset.`);
    } else {
      setHud(`M-Z3 turn ${this.hsim.turn}/${j.turnLimit} — hold ${this.hsim.hold}/${j.holdNeed}${this.hsim.pSym ? ' ●' : ' (need ●)'} — Bo ${this.hsim.stun > 0 ? `stunned ${this.hsim.stun}` : 'hunting'} — charges ${this.charges}. Q/E/A/D/Z/C or tap.`);
    }
  }
  renderHexTranscript() {
    const t = document.getElementById('transcript');
    if (!t) return;
    const lines = this.hsim.transcript;
    const last = lines.slice(-12);
    t.innerHTML = `<b>Transcript (click entry = rewind 1 charge):</b><br/>` + (last.length ? '' : '<span style="opacity:.6">no moves yet</span>') +
      last.map((l, i) => {
        const k = lines.length - last.length + i;
        return `<button data-tk="${k}" style="min-height:32px;padding:4px 8px;font-size:13px;margin:2px 4px 2px 0">${l}</button>`;
      }).join('');
    t.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => this.hexJump(Number((b as HTMLElement).dataset.tk)));
    });
  }
  hexJump(k: number) {
    if (this.scene !== 'mz3' || this.hsim.won) return;
    const target = k + 1;
    if (this.hsim.turn <= target) return; // nothing to rewind
    if (this.charges <= 0) { setHud('M-Z3 no charges left — R restarts.'); return; }
    let n = 0;
    while (this.hsim.turn > target && this.hhist.length && n < 200) { const d = this.hhist.pop(); if (d) this.hsim.applyInverse(d); n++; }
    this.charges--;
    sRewind();
    this.mz3AfterMove();
    this.render();
  }
  hexTap(e: PointerEvent) {
    const cv = this.ctx.canvas;
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width * cv.width;
    const my = (e.clientY - r.top) / r.height * cv.height;
    const size = Math.min(cv.width, cv.height) / (this.hsim.board.radius * 3.4);
    const ox = cv.width / 2, oy = cv.height / 2;
    let best = -1, bestD = size * 0.9;
    for (let i = 0; i < HEX_DIRS.length; i++) {
      const [cx, cy] = hexCenter(this.hsim.pq + HEX_DIRS[i].dq, this.hsim.pr + HEX_DIRS[i].dr, size, ox, oy);
      const dd = Math.hypot(mx - cx, my - cy);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    if (best >= 0) this.hexStep(best);
  }
  hexSwipe(dx: number, dy: number) {
    // Map swipe vector to nearest of 6 hex dirs (screen space, flat-top).
    const ang = Math.atan2(dy, dx);
    const dirs = [0, Math.PI / 3, -Math.PI / 3, Math.PI, (-2 * Math.PI) / 3, (2 * Math.PI) / 3]; // E NE NW W SW SE
    let best = 0, bd = 1e9;
    dirs.forEach((a, i) => { let dd = Math.abs(ang - a); if (dd > Math.PI) dd = 2 * Math.PI - dd; if (dd < bd) { bd = dd; best = i; } });
    this.hexStep(best);
  }
  // ---- M-Z4 siege ----
  flip() {
    if (this.scene !== 'mz4' || this.sim.st.won) return;
    const before = this.sim.st.turn;
    const d = this.sim.flipSignal();
    if (!d.moved || this.sim.st.turn === before) { setHud(`Can't flip (need 2 energy — have ${this.sim.st.energy}). Hold ● to charge.`); return; }
    this.hist.push(d);
    sBuild();
    this.mz4AfterMove();
    this.render();
  }
  mz4AfterMove() {
    const j = mz4 as { holdNeed: number; turnLimit: number; signalPeriod: number };
    this.renderMz4Transcript();
    const claimed = this.sim.claimedCount();
    const toToggle = j.signalPeriod - (this.sim.st.turn % j.signalPeriod);
    if (this.sim.st.won) {
      this.flags.set('MZ4_DONE', true); saveFlags(this.flags);
      this.mapLive = false;
      showDlg(`<b>Zei:</b> Gated, not fought. Three zones, one truth. <button onclick="document.getElementById('btnHub').click()">Hub</button><br/>${this.savedLine()}`);
      setHud(`M-Z4 WON turn ${this.sim.st.turn}. Saved.`);
      setObj(`M-Z4 done. ${this.savedLine()} ${OBJ}`);
    } else if (this.sim.st.turn >= j.turnLimit) {
      showDlg(`<b>Mu:</b> Out of time at ${claimed}/${j.holdNeed}. U spends a charge (${this.charges} left) or R restarts.`);
      setHud(`M-Z4 TIME ${this.sim.st.turn}/${j.turnLimit} — claimed ${claimed}/${j.holdNeed}. U rewinds (1 charge).`);
    } else {
      setHud(`M-Z4 turn ${this.sim.st.turn}/${j.turnLimit} — signal ${this.sim.st.signalOn ? 'ON' : 'OFF'} flips in ${toToggle} — claimed ${claimed}/${j.holdNeed} — energy ${this.sim.st.energy} — charges ${this.charges}. F flips (2).`);
    }
  }
  mz4Rewind(): void {
    if (this.scene !== 'mz4') return this.rewind();
    if (this.sim.st.won) return;
    if (this.charges <= 0) { setHud('M-Z4 no charges left — R restarts.'); return; }
    const d = this.hist.pop();
    if (!d) return;
    this.sim.applyInverse(d);
    this.charges--;
    sRewind();
    this.mz4AfterMove();
    this.render();
  }
  renderMz4Transcript() {
    const t = document.getElementById('transcript');
    if (!t) return;
    const lines = this.sim.st.transcript;
    const last = lines.slice(-12);
    t.innerHTML = `<b>Transcript (click entry = rewind 1 charge):</b><br/>` + (last.length ? '' : '<span style="opacity:.6">no moves yet</span>') +
      last.map((l, i) => {
        const k = lines.length - last.length + i;
        return `<button data-tk="${k}" style="min-height:32px;padding:4px 8px;font-size:13px;margin:2px 4px 2px 0">${l}</button>`;
      }).join('');
    t.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => this.mz4Jump(Number((b as HTMLElement).dataset.tk)));
    });
  }
  mz4Jump(k: number) {
    if (this.scene !== 'mz4' || this.sim.st.won) return;
    const target = k + 1;
    if (this.sim.st.turn <= target) return;
    if (this.charges <= 0) { setHud('M-Z4 no charges left — R restarts.'); return; }
    let n = 0;
    while (this.sim.st.turn > target && this.hist.length && n < 200) { const d = this.hist.pop(); if (d) this.sim.applyInverse(d); n++; }
    this.charges--;
    sRewind();
    this.mz4AfterMove();
    this.render();
  }
  // ---- shared tour tools (mz5/mz6/mg4/mg6: hist + charges + transcript) ----
  afterMove() {
    if (this.scene === 'mz5') this.mz5AfterMove();
    else if (this.scene === 'mz6') this.mz6AfterMove();
    else if (this.scene === 'mg4') this.mg4AfterMove();
    else if (this.scene === 'mg6') this.mg6AfterMove();
  }
  tourTag(): string {
    return this.scene === 'mz5' ? 'M-Z5' : this.scene === 'mz6' ? 'M-Z6' : this.scene === 'mg4' ? 'M-G4' : 'M-G6';
  }
  jam() {
    if ((this.scene !== 'mz5' && !(this.scene === 'mg4' && this.mapLive)) || this.sim.st.won || this.sim.st.lost) return;
    const before = this.sim.st.turn;
    const d = this.sim.dropJammer();
    if (!d.moved || this.sim.st.turn === before) {
      setHud(this.scene === 'mg4' ? `Robe spent (${this.sim.st.jamInv} charges left). Walk quiet.` : `No jammer left (${this.sim.st.jamInv}). Line up rocks instead.`);
      return;
    }
    this.hist.push(d);
    sBuild();
    this.afterMove();
    this.render();
  }
  sticker() {
    if (this.scene !== 'mz6' || this.sim.st.won || this.sim.st.lost) return;
    const before = this.sim.st.turn;
    const d = this.sim.paintSticker();
    if (!d.moved || this.sim.st.turn === before) { setHud(`Can't paint here (${this.sim.st.stickers} left). Stand on a free cell.`); return; }
    this.hist.push(d);
    sBuild();
    this.mz6AfterMove();
    this.render();
  }
  mz5AfterMove() {
    const j = mz5 as { turnLimit: number };
    this.renderTourTranscript('M-Z5');
    const left = this.sim.aliveHunters();
    if (this.sim.st.won) {
      this.flags.set('MZ5_DONE', true); saveFlags(this.flags);
      this.mapLive = false;
      showDlg(`<b>Zei:</b> Two hits, no — three. Nothing salvageable. <button onclick="document.getElementById('btnHub').click()">Hub</button><br/>${this.savedLine()}`);
      setHud(`M-Z5 WON turn ${this.sim.st.turn}. Saved.`);
      setObj(`M-Z5 done. ${this.savedLine()} ${OBJ}`);
    } else if (this.sim.st.lost === 'caught') {
      showDlg(`<b>Mu:</b> It walked you down. U spends a charge (${this.charges} left) or R restarts.`);
      setHud(`M-Z5 CAUGHT turn ${this.sim.st.turn} — charges ${this.charges}.`);
      sLose();
    } else if (this.sim.st.turn >= j.turnLimit) {
      setHud(`M-Z5 TIME ${this.sim.st.turn}/${j.turnLimit} — ${left} drones left. U rewinds (1 charge) or R restarts.`);
    } else {
      setHud(`M-Z5 turn ${this.sim.st.turn}/${j.turnLimit} — drones ${left} — jammers ${this.sim.st.jamInv}${this.sim.st.jamT > 0 ? ` (frozen ${this.sim.st.jamT}t)` : ''} — charges ${this.charges}. J drops.`);
    }
  }
  mz6AfterMove() {
    const j = mz6 as { turnLimit: number; spotLimit: number };
    this.renderTourTranscript('M-Z6');
    if (this.sim.st.won) {
      this.flags.set('MZ6_DONE', true); saveFlags(this.flags);
      this.mapLive = false;
      showDlg(`<b>Deluin:</b> Salt air. You write a mean path, Zei. <button onclick="document.getElementById('btnHub').click()">Hub</button><br/>${this.savedLine()}`);
      setHud(`M-Z6 WON turn ${this.sim.st.turn} — noticed ${this.sim.st.spots}x. Saved.`);
      setObj(`M-Z6 done. ${this.savedLine()} ${OBJ}`);
    } else if (this.sim.st.lost === 'spotted') {
      showDlg(`<b>Mu:</b> Three notices — the pack learns your shape. U spends a charge (${this.charges} left) or R restarts.`);
      setHud(`M-Z6 SPOTTED ${this.sim.st.spots}/${j.spotLimit} — charges ${this.charges}.`);
      sLose();
    } else if (this.sim.st.turn >= j.turnLimit) {
      setHud(`M-Z6 TIME ${this.sim.st.turn}/${j.turnLimit} — noticed ${this.sim.st.spots}x. U rewinds (1 charge) or R restarts.`);
    } else {
      setHud(`M-Z6 turn ${this.sim.st.turn}/${j.turnLimit} — noticed ${this.sim.st.spots}/${j.spotLimit} — stickers ${this.sim.st.stickers} — charges ${this.charges}. V paints.`);
    }
  }
  tourRewind(tag: string): void {
    if ((this.scene !== 'mz5' && this.scene !== 'mz6' && this.scene !== 'mg4' && this.scene !== 'mg6') || this.sim.st.won) return;
    if (this.charges <= 0) { setHud(`${tag} no charges left — R restarts.`); return; }
    const d = this.hist.pop();
    if (!d) return;
    this.sim.applyInverse(d);
    this.charges--;
    sRewind();
    this.afterMove();
    this.render();
  }
  renderTourTranscript(tag: string) {
    const t = document.getElementById('transcript');
    if (!t) return;
    const lines = this.sim.st.transcript;
    const last = lines.slice(-12);
    t.innerHTML = `<b>Transcript (click entry = rewind 1 charge):</b><br/>` + (last.length ? '' : '<span style="opacity:.6">no moves yet</span>') +
      last.map((l, i) => {
        const k = lines.length - last.length + i;
        return `<button data-tk="${k}" style="min-height:32px;padding:4px 8px;font-size:13px;margin:2px 4px 2px 0">${l}</button>`;
      }).join('');
    t.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => this.tourJump(Number((b as HTMLElement).dataset.tk), tag));
    });
  }
  tourJump(k: number, tag: string) {
    if ((this.scene !== 'mz5' && this.scene !== 'mz6' && this.scene !== 'mg4' && this.scene !== 'mg6') || this.sim.st.won) return;
    const target = k + 1;
    if (this.sim.st.turn <= target) return;
    if (this.charges <= 0) { setHud(`${tag} no charges left — R restarts.`); return; }
    let n = 0;
    while (this.sim.st.turn > target && this.hist.length && n < 200) { const d = this.hist.pop(); if (d) this.sim.applyInverse(d); n++; }
    this.charges--;
    sRewind();
    this.afterMove();
    this.render();
  }
  rewind(): void {
    if (this.scene === 'mz3') return this.hexRewind();
    if (this.scene === 'mz4') return this.mz4Rewind();
    if (this.scene === 'mz5' || this.scene === 'mz6' || this.scene === 'mg4' || this.scene === 'mg6') return this.tourRewind(this.tourTag());
    const d = this.hist.pop();
    if (!d || (this.scene !== 'mz1' && this.scene !== 'mg1' && this.scene !== 'mz2')) return;
    this.sim.applyInverse(d); sRewind();
    if (this.scene === 'mz2') this.mz2AfterMove();
    else setHud(`Rewound to turn ${this.sim.st.turn} (${this.hist.length} left)`);
    this.render();
  }
  showNode(id: string) {
    const nodes = (mg1 as unknown as { nodes: DlgNode[] }).nodes;
    if (id === 'END_MAP') return void this.mg1MapPhase();
    if (id === 'END') { setHud('M-G1 done. Saved.'); setObj(`M-G1 done. ${this.savedLine()} ${OBJ}`); return; }
    const n = nodes.find(q => q.id === id);
    if (!n) return;
    const btns = n.choices.filter(c => condOk(c.cond, this.flags))
      .map((c, i) => `<button data-ci="${i}">${c.label}</button>`).join(' ');
    showDlg(`<b>${n.speaker}:</b> ${n.text}<br/><br/>${btns}`);
    this.dlg.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const c = n.choices.filter(q => condOk(q.cond, this.flags))[Number((b as HTMLElement).dataset.ci)];
        Object.entries(c.set ?? {}).forEach(([k, v]) => this.flags.set(k, v));
        saveFlags(this.flags); sClick();
        this.showNode(c.next);
      });
    });
  }
  async mg1MapPhase() {
    const hasLoan = Number(this.flags.get('repLoan') ?? 0) >= 30;
    const pick = await runPoll(this.dlg, [
      { id: 'bribe', label: hasLoan ? 'Bribe sniffer (spend Rep loan 30)' : 'Bribe sniffer (needs Rep loan — you filed true)' },
      { id: 'run', label: 'Decoy robe run' },
    ], 'run', 20);
    this.flags.set('MG1_POLL', pick); saveFlags(this.flags);
    if (pick === 'bribe' && hasLoan) {
      // Choice matters: patrol stands down (removed), run keeps it.
      for (let y = 0; y < this.sim.st.board.h; y++) for (let x = 0; x < this.sim.st.board.w; x++) {
        const c = this.sim.st.board.get(x, y);
        if (c.piece === 'spaceship') { c.piece = 'none'; c.hp = 0; c.dirX = 0; c.dirY = 0; }
      }
      this.flags.set('repLoan', 0);
      saveFlags(this.flags);
    }
    for (const c of (mg1 as unknown as { clues: { id: string; title: string; summary: string }[] }).clues) this.ded.add(c);
    this.mapLive = true;
    this.renderBoardWithLinks();
    setHud('M-G1 map live — WASD/arrows or tap. Push rock into red patrol lane, take ●, end on ◆.');
    setObj(`M-G1 objective: 1) linked ${this.ded.solved ? '✓' : '…'} 2) rock → patrol 3) ● → ◆. Poll=${pick}${pick === 'bribe' && hasLoan ? ' (patrol bribed away)' : ''}. ${OBJ}`);
  }
  renderBoardWithLinks() {
    const sums = this.ded.clues.map(c => `<li><b>${c.title}</b> — ${c.summary}</li>`).join('');
    showDlg(`<b>Seila board:</b> which pair proves bounty+sniffer? Evidence:<ul>${sums}</ul>
      <button id="linkBtn">Link kiosk + sniffer</button> <button id="linkBtn2">Link robe + kiosk</button> <button id="linkBtn3">Link robe + sniffer</button>
      <br/><small>Then: push rock into patrol lane, grab ●, end on ◆ gold shrine.</small>`);
    const wire = (id: string, a: string, b: string) => {
      document.getElementById(id)!.onclick = () => {
        const r = this.ded.tryLink(a, b);
        if (r === 'correct') sNotice(); else blip(180);
        this.flags.set('MG1_DED', r); saveFlags(this.flags);
        if (r === 'correct') {
          showDlg(`<b>Seila:</b> Correct — kiosk bounty matches the sniffer by stall 4. Now: rock → patrol, ● → ◆.`);
          setObj(`M-G1 objective: 1) linked ✓ 2) rock → patrol 3) ● → ◆. ${OBJ}`);
          if (this.sim.st.won) this.mg1AfterMove(); // re-check: arrived early before solving
        } else {
          showDlg(`<b>Seila:</b> Kiosk log shows bounty +1, robe fiber shows east decoy — those don't connect. Check summaries above — the links are back in a moment.`);
          // Keep mapLive true; retry re-opens links without wiping map:
          setTimeout(() => { if (!this.ded.solved) this.renderBoardWithLinks(); }, 2500);
        }
        this.render();
      };
    };
    wire('linkBtn', 'kiosk', 'sniffer');
    wire('linkBtn2', 'robe', 'kiosk');
    wire('linkBtn3', 'robe', 'sniffer');
  }
  // ---- Veridia acts (M-G2..M-G6) ----
  predLine(): string {
    const p = this.flags.get('PRED');
    return typeof p === 'number' ? ` Prediction ${p}.` : '';
  }
  runNodes(tag: string, nodes: DlgNode[], hooks: { onMap?: () => void; onPoll?: () => void; onEnd?: () => void; showPred?: boolean }, startId = 'start') {
    const go = (id: string) => {
      if (id === 'END_MAP' && hooks.onMap) return hooks.onMap();
      if (id === 'END_POLL' && hooks.onPoll) return hooks.onPoll();
      if (id === 'END') {
        if (hooks.onEnd) hooks.onEnd();
        return;
      }
      const n = nodes.find(q => q.id === id);
      if (!n) return;
      const btns = n.choices.filter(c => condOk(c.cond, this.flags))
        .map((c, i) => `<button data-ci="${i}">${c.label}</button>`).join(' ');
      showDlg(`<b>${n.speaker}:</b> ${n.text}<br/><br/>${btns}${hooks.showPred ? `<br/><small>${this.predLine()} Hecklers below 30.</small>` : ''}`);
      this.dlg.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          const c = n.choices.filter(q => condOk(q.cond, this.flags))[Number((b as HTMLElement).dataset.ci)];
          Object.entries(c.set ?? {}).forEach(([k, v]) => this.flags.set(k, v));
          saveFlags(this.flags); sClick();
          go(c.next);
        });
      });
    };
    void tag;
    go(startId);
  }
  playMG2() {
    this.scene = 'mg2'; this.mapLive = false;
    const t = document.getElementById('transcript'); if (t) t.innerHTML = '';
    setHud('M-G2 GPH Pitch — three Keepers, three objections. Choices persist (MOV cover helps Zei).');
    setObj(`M-G2 objective: win all three Keepers, then take the robe. ${OBJ}`);
    this.runNodes('M-G2', (g2 as unknown as { nodes: DlgNode[] }).nodes, { showPred: true, onEnd: () => this.toHub() });
    this.render();
  }
  playMG3() {
    this.scene = 'mg3'; this.mapLive = false;
    if (typeof this.flags.get('PRED') !== 'number') this.flags.set('PRED', (g3 as unknown as { predStart: number }).predStart);
    const t = document.getElementById('transcript'); if (t) t.innerHTML = '';
    setHud('M-G3 Keeper Debates — Predict bots score every line. Idealistic close needs 55+.');
    setObj(`M-G3 objective: survive both debates, choose DEFER or FORCE. ${OBJ}`);
    this.runNodes('M-G3', (g3 as unknown as { nodes: DlgNode[] }).nodes, { showPred: true, onEnd: () => this.toHub() });
    this.render();
  }
  playMG4() {
    const j = (g4 as unknown) as { seed: string; w: number; h: number; walls: number[][]; hunters: { x: number; y: number; wp: [number, number][]; dormant?: boolean }[]; robe: number; exit: number[]; turnLimit: number; charges: number; player: number[]; ally: number[] };
    this.scene = 'mg4'; this.hist.clear(); this.mapLive = false;
    const burned = this.flags.get('MOV_HIDDEN') === false;
    this.flags.set('TRACE', burned ? 20 : 0); saveFlags(this.flags);
    this.sim = this.buildBoard({ w: j.w, h: j.h, walls: j.walls, rocks: [], mirrors: [], symbols: [], player: j.player, ally: j.ally, seed: j.seed });
    this.sim.enablePack(j.hunters, 3);
    this.sim.enableJammers(j.robe);
    this.sim.enableExit(j.exit[0], j.exit[1]);
    this.charges = j.charges;
    setHud('M-G4 Ghost Network — couriers first, then the atrium.');
    setObj(`M-G4 objective: 1) hear Mov 2) cross to ◆ exit 3) Trace under 60 (adjacency +20), robe J freezes ≤3. U/transcript = 1 charge. ${OBJ}`);
    this.runNodes('M-G4', (g4 as unknown as { nodes: DlgNode[] }).nodes, {
      onMap: () => {
        this.mapLive = true;
        this.renderTourTranscript('M-G4');
        const tr0 = Number(this.flags.get('TRACE') ?? 0);
        setHud(`M-G4 map live — reach ◆ exit in ${j.turnLimit}t. Trace ${tr0}${tr0 > 0 ? ' (Mov burned — they watch for you)' : ''}. Robe J ×${j.robe}.`);
        this.render();
      },
      onEnd: () => this.toHub(),
    });
    this.render();
  }
  playMG5() {
    this.scene = 'mg5'; this.mapLive = false;
    const clues = (g5 as unknown as { clues: { id: string; title: string; summary: string }[] }).clues;
    const t = document.getElementById('transcript');
    if (t) t.innerHTML = `<b>Seila's evidence board:</b><ul>` + clues.map(c => `<li><b>${c.title}</b> — ${c.summary}</li>`).join('') + `</ul>`;
    setHud('M-G5 Three Houses — Seila runs the board. Pairs, not vibes. Lily\'s weight is yours to set.');
    setObj(`M-G5 objective: close all three houses, then weigh Lily. ${OBJ}`);
    this.runNodes('M-G5', (g5 as unknown as { nodes: DlgNode[] }).nodes, { onEnd: () => this.toHub() });
    this.render();
  }
  playMG6() {
    this.scene = 'mg6'; this.hist.clear(); this.mapLive = false;
    const t = document.getElementById('transcript'); if (t) t.innerHTML = '';
    setHud('M-G6 Poll + Coup — three pulses to 1M, then walk Lektor out.');
    setObj(`M-G6 objective: 1) raise 1M 2) escape lockdown to ◆ 3) choose Thaldur. ${OBJ}`);
    this.runNodes('M-G6', (g6 as unknown as { nodes: DlgNode[] }).nodes, {
      onPoll: () => void this.mg6Pulses(),
      onMap: () => this.mg6EscapeMap(),
      onEnd: () => this.toHub(),
    });
    this.render();
  }
  async mg6Pulses() {
    const j = g6 as unknown as { pulses: { id: string; opts: { id: string; label: string }[]; ghost: string; value: Record<string, number> }[]; target: number };
    let raised = 0;
    for (const p of j.pulses) {
      const pick = await runPoll(this.dlg, p.opts, p.ghost, 20);
      raised += p.value[pick] ?? 0;
      setHud(`M-G6 pulse ${p.id}: raised ${raised}/${j.target}.`);
      sClick();
    }
    this.flags.set('POLL_RAISED', raised); saveFlags(this.flags);
    if (raised < j.target) {
      showDlg(`<b>Seila:</b> ${raised}/${j.target}. The street shrugs — once more, louder. <button id="repoll">Run it back</button>`);
      document.getElementById('repoll')!.onclick = () => void this.mg6Pulses();
      return;
    }
    this.runNodes('M-G6', (g6 as unknown as { nodes: DlgNode[] }).nodes, {
      onMap: () => this.mg6EscapeMap(),
      onEnd: () => this.toHub(),
    }, 'escape');
  }
  mg6EscapeMap() {
    const j = (g6 as unknown) as { seed: string; w: number; h: number; walls: number[][]; rocks: number[][]; hunters: { x: number; y: number; wp: [number, number][] }[]; exit: number[]; turnLimit: number; charges: number; player: number[]; ally: number[] };
    this.hist.clear();
    this.sim = this.buildBoard({ w: j.w, h: j.h, walls: j.walls, rocks: j.rocks, mirrors: [], symbols: [], player: j.player, ally: j.ally, seed: j.seed });
    this.sim.enablePack(j.hunters, 1);
    this.sim.enableLethal();
    this.sim.enableExit(j.exit[0], j.exit[1]);
    this.charges = j.charges;
    this.mapLive = true;
    this.renderTourTranscript('M-G6');
    setHud(`M-G6 lockdown live — reach ◆ exit in ${j.turnLimit}t. Lethal patrols. One rock. 3 charges.`);
    setObj(`M-G6 objective: reach ◆ with Lektor. U/transcript = 1 charge. ${OBJ}`);
    this.render();
  }
  mg6AfterMove() {
    const j = g6 as { turnLimit: number };
    this.renderTourTranscript('M-G6');
    if (this.sim.st.px === this.sim.st.ex && this.sim.st.py === this.sim.st.ey) {
      this.sim.st.won = true;
      this.mapLive = false;
      setHud(`M-G6 out of lockdown turn ${this.sim.st.turn}.`);
      setObj(`M-G6 objective: choose Thaldur. ${OBJ}`);
      this.runNodes('M-G6', (g6 as unknown as { nodes: DlgNode[] }).nodes, { onEnd: () => this.toHub() }, 'win');
      return;
    }
    if (this.sim.st.lost === 'caught') {
      showDlg(`<b>Evelor:</b> Lockdown took you. U spends a charge (${this.charges} left) or R restarts the whole mission.`);
      setHud(`M-G6 CAUGHT turn ${this.sim.st.turn}.`);
      sLose();
    } else if (this.sim.st.turn >= j.turnLimit) {
      setHud(`M-G6 TIME ${this.sim.st.turn}/${j.turnLimit}. U rewinds (1 charge) or R restarts.`);
    } else {
      setHud(`M-G6 turn ${this.sim.st.turn}/${j.turnLimit} — charges ${this.charges}. Reach ◆.`);
    }
  }
  mg4AfterMove() {
    const j = g4 as { turnLimit: number };
    this.renderTourTranscript('M-G4');
    // Trace: adjacency to a live hunter +20.
    let tr = Number(this.flags.get('TRACE') ?? 0);
    for (const h of this.sim.st.hunters) {
      if (h.dead) continue;
      const near = Math.max(Math.abs(h.x - this.sim.st.px), Math.abs(h.y - this.sim.st.py)) <= 1 ||
        Math.max(Math.abs(h.x - this.sim.st.ax), Math.abs(h.y - this.sim.st.ay)) <= 1;
      if (near) {
        tr += 20;
        this.sim.st.transcript.push(`T${this.sim.st.turn} Trace +20 (${tr})`);
        if (tr >= 60 && this.sim.st.hunters[2] && this.sim.st.hunters[2].dead) {
          this.sim.wakeHunter(2);
          this.sim.st.transcript.push(`T${this.sim.st.turn} sleeper wakes in the walls`);
        }
        break;
      }
    }
    this.flags.set('TRACE', tr); saveFlags(this.flags);
    if (this.sim.st.px === this.sim.st.ex && this.sim.st.py === this.sim.st.ey) {
      this.sim.st.won = true;
      this.flags.set('MG4_DONE', true); saveFlags(this.flags);
      this.mapLive = false;
      setHud(`M-G4 WON turn ${this.sim.st.turn} — Trace ${tr}. Saved.`);
      setObj(`M-G4 done. ${this.savedLine()} ${OBJ}`);
      this.runNodes('M-G4', (g4 as unknown as { nodes: DlgNode[] }).nodes, { onEnd: () => this.toHub() }, 'win');
      return;
    }
    if (this.sim.st.turn >= j.turnLimit) {
      setHud(`M-G4 TIME ${this.sim.st.turn}/${j.turnLimit} — Trace ${tr}. U rewinds (1 charge) or R restarts.`);
    } else {
      setHud(`M-G4 turn ${this.sim.st.turn}/${j.turnLimit} — Trace ${tr}/60 — robe ${this.sim.st.jamInv} — charges ${this.charges}. J cloaks.`);
    }
  }
  mg1AfterMove() {
    if (this.sim.st.won && this.ded.solved) {
      this.flags.set('MG1_DONE', true); saveFlags(this.flags);
      this.mapLive = false;
      this.showNode('win');
      setHud(`M-G1 WON turn ${this.sim.st.turn}. Poll=${this.flags.get('MG1_POLL')} Ded=correct. Saved.`);
      setObj(`M-G1 done. ${this.savedLine()} ${OBJ}`);
    } else if (this.sim.st.won) {
      setHud(`M-G1 at shrine with ● — finish Seila board links above to complete. U rewinds.`);
    } else {
      setHud(`M-G1 turn ${this.sim.st.turn} — ded ${this.ded.solved ? 'solved' : 'unsolved'} — U rewinds 1 step`);
    }
  }
  render() {
    if (this.scene === 'hub') {
      this.ctx.clearRect(0, 0, 720, 720);
      this.ctx.fillStyle = '#10141d'; this.ctx.fillRect(0, 0, 720, 720);
      this.ctx.fillStyle = '#e8eef7'; this.ctx.font = '28px system-ui';
      this.ctx.fillText('SNOWMOON: Second Player', 120, 340);
      this.ctx.font = '16px system-ui'; this.ctx.fillStyle = '#93a3bb';
      this.ctx.fillText('Pick M-Z1 / M-Z2 / M-Z3 / M-G1 above. Second player wins.', 150, 380);
      return;
    }
    if (this.scene === 'mz3') {
      drawHexBoard(this.ctx, this.hsim.board, this.hsim.pq, this.hsim.pr, this.hsim.bq, this.hsim.br, this.hsim.pSym);
      return;
    }
    const del = this.scene === 'mz6' && this.sim.hasEscort() ? [this.sim.st.dx, this.sim.st.dy] as [number, number] : undefined;
    drawBoard(this.ctx, this.sim.st.board, this.sim.st.px, this.sim.st.py, this.sim.st.ax, this.sim.st.ay, this.sim.st.pSym, this.sim.st.aSym, this.scene === 'mg1' ? 'market' : 'dojo', del);
  }
}
