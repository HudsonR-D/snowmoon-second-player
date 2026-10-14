/* Greedy-dive tracer: best lookahead action every turn, no backtracking. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Board } from '../.testbuild/minpentai/board.js';
import { Sim } from '../.testbuild/minpentai/sim.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'content', process.argv[2] || 'm-z2.json'), 'utf8'));
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const b = new Board(j.w, j.h);
for (const [x, y] of j.walls || []) b.get(x, y).piece = 'wall';
for (const [x, y] of j.rocks || []) b.get(x, y).piece = 'rock';
for (const [x, y] of j.symbols || []) b.get(x, y).symbol = true;
if (j.shrine) b.get(j.shrine[0], j.shrine[1]).terrain = 'shrine';
const sim = new Sim(b, j.player[0], j.player[1], j.ally[0], j.ally[1], j.seed);
const man = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
const H = () => {
  const st = sim.st, P = [st.px, st.py];
  if (!st.pSym && !st.aSym) {
    let m = 1e9;
    for (const [sx, sy] of j.symbols) m = Math.min(m, man(...P, sx, sy));
    return m;
  }
  return man(...P, ...j.shrine);
};
for (let t = 0; t < 24 && !sim.st.won; t++) {
  const scored = [];
  for (const [dx, dy] of DIRS) {
    const d = sim.tryMove(dx, dy, 'p');
    if (!d || !d.moved) continue;
    scored.push({ dx, dy, d, h: H() });
    sim.applyInverse(d);
  }
  scored.sort((x, y) => x.h - y.h);
  if (!scored.length) { console.log('STUCK, no legal moves'); break; }
  const best = scored[0];
  const d2 = sim.tryMove(best.dx, best.dy, 'p');
  console.log(`t=${sim.st.turn} P=(${sim.st.px},${sim.st.py}) A=(${sim.st.ax},${sim.st.ay}) sym=${sim.st.pSym} chose=(${best.dx},${best.dy}) H=${best.h} opts=${scored.map(s => `(${s.dx},${s.dy}):${s.h}`).join(' ')}`);
  void d2;
}
console.log(`won=${sim.st.won} turn=${sim.st.turn}`);
