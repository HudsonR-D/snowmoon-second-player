/* Solver trace diagnostics for Z5/Z6: greedy rollout probe.
 * Run: node tests/probe.mjs [Z5|Z6]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Board } from '../.testbuild/minpentai/board.js';
import { Sim } from '../.testbuild/minpentai/sim.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const load = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'content', f), 'utf8'));
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const man = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
const id = process.argv[2] || 'Z5';

function buildSquare(j) {
  const b = new Board(j.w, j.h);
  const put = (x, y, fn) => fn(b.get(x, y));
  for (const [x, y] of j.walls || []) put(x, y, c => { c.piece = 'wall'; });
  for (const [x, y] of j.rocks || []) put(x, y, c => { c.piece = 'rock'; });
  for (const [x, y] of j.symbols || []) put(x, y, c => { c.symbol = true; });
  return new Sim(b, j.player[0], j.player[1], j.ally[0], j.ally[1], j.seed);
}
let sim;
if (id === 'Z5') {
  const j = load('m-z5.json');
  sim = buildSquare(j);
  sim.enablePack(j.hunters, 1); sim.enableLethal(); sim.enableJammers(j.jammers);
} else {
  const j = load('m-z6.json');
  sim = buildSquare(j);
  sim.enablePack(j.hunters, 3);
  sim.enableEscort(j.deluin[0], j.deluin[1], j.stickers, j.spotLimit, j.exit[0], j.exit[1]);
}
// Greedy probe with per-mission objective; print every 5 turns + terminal state.
const j = load(id === 'Z5' ? 'm-z5.json' : 'm-z6.json');
for (let t = 0; t < (j.turnLimit || 60); t++) {
  const st = sim.st;
  if (st.won || st.lost) break;
  // candidate moves scored
  let best = null, bestS = 1e18;
  for (const [dx, dy] of DIRS) {
    const nx = st.px + dx, ny = st.py + dy;
    if (!st.board.in(nx, ny)) continue;
    let s;
    if (id === 'Z5') {
      const alive = st.hunters.filter(h => !h.dead);
      s = alive.length ? Math.min(...alive.map(h => man(nx, ny, h.x, h.y))) : -100;
    } else {
      s = man(nx, ny, ...j.exit);
    }
    if (s < bestS) { bestS = s; best = [dx, dy]; }
  }
  if (id === 'Z5' && sim.st.jamInv > 0 && t === 2) { sim.dropJammer(); }
  else if (best) sim.tryMove(best[0], best[1], 'p');
  else break;
  if (t % 5 === 0 || sim.st.won || sim.st.lost) {
    const s2 = sim.st;
    console.log(`t=${s2.turn} P=(${s2.px},${s2.py}) A=(${s2.ax},${s2.ay})` +
      (id === 'Z5' ? ` alive=${s2.hunters.filter(h => !h.dead).length} jam=${s2.jamT}` :
        ` D=(${s2.dx},${s2.dy}) spots=${s2.spots}`) +
      ` H=${s2.hunters.map(h => `(${h.x},${h.y})${h.dead ? 'x' : ''}`).join('')}` +
      (s2.won ? ' WON' : '') + (s2.lost ? ` LOST:${s2.lost}` : ''));
  }
}
console.log(`final: won=${sim.st.won} lost=${sim.st.lost} turn=${sim.st.turn}`);
