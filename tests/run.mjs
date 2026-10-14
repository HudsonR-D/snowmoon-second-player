/* Bot-run playtesting for SNOWMOON: Second Player.
 * Drives the REAL compiled sims (no mocks): winnability search per mission,
 * determinism, rewind fuzz, dialogue-graph static checks.
 * Run: npm test (tsc -p tsconfig.sim.json && node tests/run.cjs)
 */
'use strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Board } from '../.testbuild/minpentai/board.js';
import { Sim } from '../.testbuild/minpentai/sim.js';
import { HexBoard, HexSim, HEX_DIRS, hexDist } from '../.testbuild/minpentai/hex.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONTENT = path.join(__dirname, '..', 'src', 'content');
const load = f => JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8'));
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const man = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
let failures = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra}`);
  if (!cond) failures++;
};

/* ---------- world builders (mirror game.ts) ---------- */
function buildSquare(j) {
  const b = new Board(j.w, j.h);
  const put = (x, y, fn) => {
    if (x < 0 || y < 0 || x >= j.w || y >= j.h) throw new Error(`content OOB ${x},${y}`);
    fn(b.get(x, y));
  };
  for (const [x, y] of j.walls || []) put(x, y, c => { c.piece = 'wall'; });
  for (const [x, y] of j.rocks || []) put(x, y, c => { c.piece = 'rock'; });
  for (const [x, y] of j.mirrors || []) put(x, y, c => { c.piece = 'mirror'; });
  for (const [x, y] of j.factories || []) put(x, y, c => { c.piece = 'factory'; });
  for (const [x, y] of j.factories || []) put(x, y, c => { c.piece = 'factory'; });
  for (const [x, y] of j.symbols || []) put(x, y, c => { c.symbol = true; });
  if (j.shrine) put(j.shrine[0], j.shrine[1], c => { c.terrain = 'shrine'; });
  for (const s of j.spaceships || []) put(s.x, s.y, c => { c.piece = 'spaceship'; c.hp = s.hp; c.dirX = s.dx; c.dirY = s.dy; });
  return new Sim(b, j.player[0], j.player[1], j.ally[0], j.ally[1], j.seed);
}
function stateKey(s) {
  const cells = s.board.cells.map(c => `${c.terrain[0]}${c.piece[0]}${c.symbol ? 's' : ''}${c.hp}${c.stickerT}`).join('');
  // turn % 12 (not full turn): hunters/patrols/foe/signal run on periods
  // dividing 12, so same-phase states prune while staying ~sound. Path-
  // dependent resources (energy, spots, claims, deluin+trail tail) stay exact.
  const trail = s.trail.slice(-6).map(t => t.join(':')).join(';');
  return [s.turn % 12, s.px, s.py, s.ax, s.ay, s.pSym, s.aSym, s.energy, s.foe,
    s.signalOn, s.zones.map(z => (z.claimed ? 1 : 0)).join(''),
    s.hunters.map(h => `${h.x},${h.y},${h.wi},${h.dead ? 1 : 0}`).join(';'),
    s.lost, s.won, s.jamInv, s.jamT, s.dx, s.dy, trail,
    s.stickers, s.spots, cells].join('|');
}

/* ---------- generic DFS helpers ---------- */
function applyAct(sim, a) {
  if (a.k === 'm') return sim.tryMove(a.dx, a.dy, 'p');
  if (a.k === 'b') return sim.buildWall(a.dx, a.dy);
  if (a.k === 'f') return sim.flipSignal();
  if (a.k === 'j') return sim.dropJammer();
  if (a.k === 's') return sim.paintSticker(a.dx, a.dy);
  return null;
}
const moves = () => DIRS.map(([dx, dy]) => ({ k: 'm', dx, dy }));
const directed = k => DIRS.map(([dx, dy]) => ({ k, dx, dy }));

/* ---------- mission setups ---------- */
function setup(id) {
  if (id === 'Z1') { const j = load('m-z1.json'); return { sim: buildSquare(j), j, verbs: [], depth: 14, budget: 60000 }; }
  if (id === 'Z2') { const j = load('m-z2.json'); return { sim: buildSquare(j), j, verbs: directed('b'), depth: 45, budget: 150000 }; }
  if (id === 'G1') { const j = load('m-g1.json'); return { sim: buildSquare(j), j, verbs: [], depth: 30, budget: 80000 }; }
  if (id === 'Z4') {
    const j = load('m-z4.json'); const sim = buildSquare(j);
    sim.enableZones(j.zones, j.signalPeriod, j.holdNeed, j.hunters);
    return { sim, j, verbs: [{ k: 'f' }], depth: 50, budget: 250000 };
  }
  if (id === 'Z5') {
    const j = load('m-z5.json'); const sim = buildSquare(j);
    sim.enablePack(j.hunters, 1); sim.enableLethal(); sim.enableJammers(j.jammers);
    return { sim, j, verbs: [{ k: 'j' }], depth: 65, budget: 400000 };
  }
  if (id === 'Z6') {
    const j = load('m-z6.json'); const sim = buildSquare(j);
    sim.enablePack(j.hunters, 3);
    sim.enableEscort(j.deluin[0], j.deluin[1], j.stickers, j.spotLimit, j.exit[0], j.exit[1]);
    return { sim, j, verbs: directed('s'), depth: 65, budget: 400000 };
  }
  if (id === 'G4') {
    const j = load('g4.json'); const sim = buildSquare({ ...j, symbols: [], spaceships: [] });
    sim.enablePack(j.hunters, 3); sim.enableJammers(j.robe); sim.enableExit(j.exit[0], j.exit[1]);
    return { sim, j, verbs: [{ k: 'j' }], depth: 45, budget: 200000, trace: 0 };
  }
  if (id === 'G6E') {
    const j = load('g6.json'); const sim = buildSquare({ w: j.w, h: j.h, walls: j.walls, rocks: j.rocks, symbols: [], player: j.player, ally: j.ally, seed: j.seed });
    sim.enablePack(j.hunters, 1); sim.enableLethal(); sim.enableExit(j.exit[0], j.exit[1]);
    return { sim, j, verbs: [], depth: 45, budget: 200000 };
  }
  throw new Error('unknown ' + id);
}
function nearest(symbols, x, y) {
  let b = 1e9;
  for (const [sx, sy] of symbols) b = Math.min(b, man(x, y, sx, sy));
  return b;
}
function heuristics(id, S) {
  const st = S.sim.st, j = S.j;
  const P = [st.px, st.py];
  // Fetch-form (no pickup cliff): cost via symbol even before holding it,
  // so grabbing never increases H. Post-grab states score the tail only.
  if (id === 'Z4') {
    if (st.pSym || st.aSym) {
      let b = 1e9;
      for (const z of st.zones.filter(z => !z.claimed)) for (const c of z.cells) b = Math.min(b, man(...P, ...c));
      return b === 1e9 ? 0 : b;
    }
    let b = 1e9;
    for (const s of j.symbols) {
      let z = 1e9;
      for (const zn of st.zones.filter(zn => !zn.claimed)) for (const c of zn.cells) z = Math.min(z, man(s[0], s[1], ...c));
      b = Math.min(b, man(...P, ...s) + (z === 1e9 ? 0 : z));
    }
    return b;
  }
  if (id === 'Z5') {
    const alive = st.hunters.filter(h => !h.dead);
    if (!alive.length) return -1000;
    let b = 1e9;
    for (const h of alive) b = Math.min(b, man(...P, h.x, h.y));
    return alive.length * 60 + b;
  }
  if (id === 'Z6') {
    const d = man(...P, ...j.exit);
    const dd = Math.abs(st.dx - j.exit[0]) + Math.abs(st.dy - j.exit[1]);
    return d * 2 + Math.min(dd, 12) + st.spots * 100;
  }
  if (id === 'G4' || id === 'G6E') return man(...P, ...j.exit);
  // Z1 Z2 G1 fetch-form: via-symbol cost, so the grab never spikes H.
  const sh = j.shrine || j.exit;
  if (st.pSym || st.aSym) return man(...P, ...sh);
  let bb = 1e9;
  for (const s of j.symbols) bb = Math.min(bb, man(...P, ...s) + man(s[0], s[1], ...sh));
  return bb;
}
// Verb shaping: lookahead H alone can't value setup verbs, so bias them.
function verbBias(id, S, a) {
  const st = S.sim.st;
  if (a.k === 'f') return st.signalOn ? 60 : -25; // flip when OFF first
  if (a.k === 'j') {
    if (st.jamInv <= 0 || st.jamT > 0) return 900;
    const close = st.hunters.some(h => !h.dead && Math.max(Math.abs(h.x - st.px), Math.abs(h.y - st.py)) <= 2);
    return close ? -25 : 120; // freeze only with a setup imminent
  }
  if (a.k === 's') {
    // Paint ahead when exposed; lookahead scores the true post-state.
    if (st.stickers <= 0) return 900;
    const exposed = st.hunters.some(h => !h.dead && Math.max(Math.abs(h.x - st.px), Math.abs(h.y - st.py)) <= 4);
    return exposed ? -25 : 150;
  }
  if (a.k === 'b') return 120;
  return 0;
}
/* ---------- run winnability ---------- */
const PLAN = [
  ['Z1', () => true], ['Z2', () => true], ['G1', () => true],
  ['Z4', () => true], ['Z5', () => true], ['Z6', () => true],
  ['G4', () => true], ['G6E', () => true],
];
for (const [id] of PLAN) {
  const actsOf = S => [...moves(), ...S.verbs];
  const isG4 = id === 'G4';
  const goalOf = S => {
    if (S.sim.st.won) return true;
    if (id === 'G4' || id === 'G6E') return S.sim.st.px === S.j.exit[0] && S.sim.st.py === S.j.exit[1];
    return false;
  };
  // Per-stage DFS lives inline in the stage loop below (it must run on the
  // carried sim, not a fresh one, so it can't be a closed-over helper).
  // Iterative deepening: first win within the game limit, then tighten.
  // Z5 solves staged on ONE carried sim (one drone per stage — human play).
  const start = Date.now();
  const S0 = setup(id);
  const limitOf = () => (id === 'Z2' ? 30 : S0.j.turnLimit || S0.depth);
  const goalFull = S => goalOf(S);
  const stageGoals = id === 'Z5'
    ? [S => S.sim.st.hunters.filter(h => !h.dead).length <= 2,
       S => S.sim.st.hunters.filter(h => !h.dead).length <= 1,
       S => goalFull(S)]
    : [goalFull];
  let answer = null, totalNodes = 0, diag = '';
  const S = setup(id);
  const acts = actsOf(S);
  let stagedOk = true, z6best = 1e9, z6bestSpots = 1e9;
  for (const sg of stageGoals) {
    let bound = limitOf() - S.sim.st.turn, stageAns = null;
    const stageRoot = S.sim.snapshot(); // rounds + commit replay start here
    for (let round = 0; round < 6; round++) {
      S.sim.restore(stageRoot);
      const visited = new Set([stateKey(S.sim.st)]);
      let nodes = 0, trace = 0;
      const dfs2 = depth => {
        if (sg(S)) return [];
        if (depth <= 0 || nodes >= 150000) return null;
        if (S.sim.st.lost) return null;
        if (id === 'Z6') {
          const dd = man(S.sim.st.px, S.sim.st.py, ...S.j.exit);
          if (dd < z6best) { z6best = dd; z6bestSpots = S.sim.st.spots; }
        }
        const scored = [];
        for (const a of acts) {
          const d = applyAct(S.sim, a);
          if (!d || !d.moved) continue;
          scored.push({ a, d, h: heuristics(id, S) + verbBias(id, S, a) });
          S.sim.applyInverse(d);
        }
      scored.sort((x, y) => x.h - y.h);
      for (const { a } of scored) {
        const d = applyAct(S.sim, a);
        if (!d || !d.moved) continue;
          let added = 0;
          if (isG4) {
            for (const h of S.sim.st.hunters) {
              if (h.dead) continue;
              const near = Math.max(Math.abs(h.x - S.sim.st.px), Math.abs(h.y - S.sim.st.py)) <= 1 ||
                Math.max(Math.abs(h.x - S.sim.st.ax), Math.abs(h.y - S.sim.st.ay)) <= 1;
              if (near) {
                added = 20; trace += 20;
                if (trace >= 60 && S.sim.st.hunters[2] && S.sim.st.hunters[2].dead) S.sim.wakeHunter(2);
                break;
              }
            }
          }
          nodes++;
          const k = stateKey(S.sim.st) + (isG4 ? `t${trace}` : '');
          if (!visited.has(k)) {
            visited.add(k);
            const r = dfs2(depth - 1);
            if (r) return [a, ...r];
          }
          S.sim.applyInverse(d);
          trace -= added;
        }
        return null;
      };
      const ans = dfs2(bound);
      totalNodes += nodes;
      if (ans && (!stageAns || ans.length < stageAns.length)) { stageAns = ans; bound = ans.length - 1; }
      else break;
      if (totalNodes > 1200000) break;
    }
    if (!stageAns) { stagedOk = false; break; }
    // commit the stage: replay prefix from the stage root (with G4 trace)
    S.sim.restore(stageRoot);
    let traceC = 0;
    for (const a of stageAns) {
      const d = applyAct(S.sim, a);
      if (!d || !d.moved) { stagedOk = false; break; }
      if (isG4) {
        for (const h of S.sim.st.hunters) {
          if (h.dead) continue;
          const near = Math.max(Math.abs(h.x - S.sim.st.px), Math.abs(h.y - S.sim.st.py)) <= 1 ||
            Math.max(Math.abs(h.x - S.sim.st.ax), Math.abs(h.y - S.sim.st.ay)) <= 1;
          if (near) {
            traceC += 20;
            if (traceC >= 60 && S.sim.st.hunters[2] && S.sim.st.hunters[2].dead) S.sim.wakeHunter(2);
            break;
          }
        }
      }
      answer = [...(answer || []), a];
    }
    if (!stagedOk) break;
  }
  const ms = Date.now() - start;
  const lim = S0.j.turnLimit;
  const valid = answer && (!lim || answer.length <= lim);
  ok(`${id} winnable by bot${lim ? ` (≤${lim})` : ''}`, !!valid, answer ? ` (${answer.length} turns, ${totalNodes} nodes, ${ms}ms)` : ` (${totalNodes} nodes, ${ms}ms)` + (id === 'Z6' ? ` closest=${z6best} spotsThere=${z6bestSpots}` : ''));
  if (answer && (id === 'Z5' || id === 'Z6')) console.log(`    ${id} line: ${answer.map(a => a.k === 'm' ? ({ '0,-1': 'N', '0,1': 'S', '-1,0': 'W', '1,0': 'E' })[`${a.dx},${a.dy}`] : a.k.toUpperCase()).join('')}`);
}

/* ---------- M-Z3 hex solver ---------- */
{
  const j = load('m-z3.json');
  const b = new HexBoard(j.radius);
  for (const [q, r] of j.walls) b.get(q, r).piece = 'wall';
  for (const [q, r] of j.rocks) b.get(q, r).piece = 'rock';
  for (const [q, r] of j.symbols) b.get(q, r).symbol = true;
  b.get(j.shrine[0], j.shrine[1]).terrain = 'shrine';
  const sim = new HexSim(b, j.player[0], j.player[1], j.bo[0], j.bo[1], j.seed, j.holdNeed, j.turnLimit);
  const key = () => [sim.turn, sim.pq, sim.pr, sim.bq, sim.br, sim.pSym, sim.hold, sim.stun,
    [...sim.board.map.entries()].map(([k, c]) => k + c.piece[0] + (c.symbol ? 's' : '')).join('')].join('|');
  const visited = new Set([key()]);
  let nodes = 0; const BUDGET = 250000;
  const hOf = () => {
    if (!sim.pSym) {
      let m = 1e9;
      for (const [q, r] of j.symbols) m = Math.min(m, hexDist(sim.pq, sim.pr, q, r) + hexDist(q, r, 0, 0));
      return m;
    }
    return hexDist(0, 0, sim.pq, sim.pr) <= 1 ? -sim.hold : hexDist(0, 0, sim.pq, sim.pr);
  };
  const dfs = depth => {
    if (sim.won) return [];
    if (depth <= 0 || nodes >= BUDGET || sim.lost) return null;
    const order = HEX_DIRS.map((dd, i) => {
      const nq = sim.pq + dd.dq, nr = sim.pr + dd.dr;
      let s;
      if (!sim.pSym) { let m = 1e9; for (const [q, r] of j.symbols) m = Math.min(m, hexDist(nq, nr, q, r)); s = m * 3; }
      else s = hexDist(0, 0, nq, nr) <= 1 ? -10 : hexDist(0, 0, nq, nr);
      if (Math.abs(nq - sim.bq) + Math.abs(nr - sim.br) <= 1) s += 20; // keep off Bo
      return { i, s };
    }).sort((a, b) => a.s - b.s);
    for (const { i } of order) {
      const d = sim.tryPlayerMove(i);
      if (!d.moved) continue;
      nodes++;
      const k = key();
      if (!visited.has(k)) {
        visited.add(k);
        const r = dfs(depth - 1);
        if (r) return [HEX_DIRS[i].key, ...r];
      }
      sim.applyInverse(d);
    }
    return null;
  };
  const t0 = Date.now();
  const ans = dfs(j.turnLimit);
  ok('Z3 winnable by bot', !!ans, ans ? ` (${ans.length} turns: ${ans.slice(0, 20).join('')}${ans.length > 20 ? '…' : ''}, ${nodes} nodes, ${Date.now() - t0}ms)` : ` (${nodes} nodes)`);
}

/* ---------- determinism ---------- */
{
  const mk = () => { const j = load('m-z4.json'); const s = buildSquare(j); s.enableZones(j.zones, j.signalPeriod, j.holdNeed, j.hunters); return s; };
  const seq = [[1, 0], [0, 1], [1, 0], [0, -1], [-1, 0], [0, 1], [1, 1]];
  const run = () => { const s = mk(); for (const [a, b] of seq) { s.tryMove(a, b, 'p'); } s.flipSignal(); for (const [a, b] of seq) s.tryMove(a, b, 'p'); return s.st.transcript.join('\n') + '|' + stateKey(s.st); };
  ok('deterministic sim (same inputs → same state)', run() === run());
}

/* ---------- rewind fuzz ---------- */
{
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (const [id, en] of [['Z4', false], ['Z6', true]]) {
    const S = setup(id);
    const stack = [];
    let bad = '';
    for (let i = 0; i < 600 && !bad; i++) {
      const r = rnd();
      if (r < 0.18 && stack.length) { S.sim.applyInverse(stack.pop()); continue; }
      const a = r < 0.5 ? { k: 'm', dx: [0, 0, -1, 1][Math.floor(rnd() * 4)], dy: 0 } : null;
      let d;
      if (a) { if (a.dx === 0) a.dy = [-1, 1][Math.floor(rnd() * 2)]; d = S.sim.tryMove(a.dx, a.dy, 'p'); }
      else if (id === 'Z4') d = S.sim.flipSignal();
      else d = S.sim.paintSticker();
      if (d && d.moved) stack.push(d);
      const st = S.sim.st;
      if (st.turn < 0) bad = 'turn<0';
      for (const [x, y] of [[st.px, st.py], [st.ax, st.ay]]) {
        if (!st.board.in(x, y)) bad = `actor OOB ${x},${y}`;
      }
      if (st.energy < 0 || st.jamT < 0 || st.spots < 0) bad = 'counter<0';
    }
    ok(`${id} rewind fuzz (600 ops, no-throw + invariants)`, !bad, bad ? ` ${bad}` : '');
  }
}

/* ---------- dialogue graph static checks ---------- */
{
  const files = ['m-g1.json', 'g2.json', 'g3.json', 'g5.json', 'g6.json'];
  for (const f of files) {
    const j = load(f);
    if (!j.nodes) continue;
    const ids = new Set(j.nodes.map(n => n.id));
    let linksOk = true, conds = [];
    for (const n of j.nodes) for (const c of n.choices || []) {
      if (!ids.has(c.next) && !['END', 'END_MAP', 'END_POLL'].includes(c.next)) linksOk = false;
      if (c.cond) conds.push(c.cond);
    }
    // reachability from start ('win' nodes are reached via maps, not links).
    // NOTE: pop into a variable first — find() calls its predicate per
    // element, so popping inside the predicate drains the queue.
    const seen = new Set();
    const qq = ['start'];
    while (qq.length) {
      const cur = qq.pop();
      if (seen.has(cur) || !ids.has(cur)) continue;
      seen.add(cur);
      const n = j.nodes.find(x => x.id === cur);
      for (const c of (n && n.choices) || []) {
        if (ids.has(c.next) && !seen.has(c.next)) qq.push(c.next);
      }
    }
    // cond satisfiability: collect all set values per flag
    const vals = {};
    for (const n of j.nodes) for (const c of n.choices || []) {
      for (const [k, v] of Object.entries(c.set || {})) { (vals[k] = vals[k] || new Set()).add(String(v)); }
    }
    const condOk = conds.every(cd => {
      const m = cd.match(/^(!?)(\w+)(?:\s*(>=|>|==)\s*(\w+))?$/);
      if (!m) return false;
      const [, , k, op, v] = m;
      if (!op) return true;
      const have = [...(vals[k] || [])].map(Number);
      if (op === '==') return have.map(String).includes(v);
      if (op === '>=') return have.some(x => x >= Number(v));
      return have.some(x => x > Number(v));
    });
    const missing = [...ids].filter(x => !seen.has(x));
    // 'win' (map victories) and g6's hook-driven nodes aren't link-reached
    const HOOKED = { 'm-g1.json': ['win'], 'g4.json': ['win'], 'g6.json': ['escape', 'thaldur', 'win'] };
    const allowed = HOOKED[f] || [];
    ok(`${f} dialogue: links+reachability+conds`, linksOk && missing.every(x => x === 'win' || allowed.includes(x)) && condOk,
      ` (${seen.size}/${ids.size} nodes, ${conds.length} conds${missing.length ? `, map-reached: ${missing}` : ''})`);
  }
  // G6 pulses can reach 1M
  const g6 = load('g6.json');
  const max = g6.pulses.reduce((s, p) => s + Math.max(...p.opts.map(o => p.value[o.id])), 0);
  ok('G6 pulses can reach 1M', max >= g6.target, ` (max ${max} vs ${g6.target})`);
}

console.log(failures ? `\n${failures} FAILURES` : '\nALL BOT CHECKS PASSED');
process.exit(failures ? 1 : 0);
