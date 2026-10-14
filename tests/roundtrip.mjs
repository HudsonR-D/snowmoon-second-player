import { Board } from '../.testbuild/minpentai/board.js';
import { Sim } from '../.testbuild/minpentai/sim.js';
const b = new Board(7, 7);
for (const [x, y] of [[2, 2], [2, 3], [2, 4], [4, 2], [4, 4]]) b.get(x, y).piece = 'wall';
b.get(3, 3).piece = 'rock';
b.get(5, 5).symbol = true;
b.get(5, 1).terrain = 'shrine';
const keyOf = s => JSON.stringify([s.turn, s.px, s.py, s.ax, s.ay, s.pSym, s.aSym, s.energy, s.foe, s.won, s.lost, s.board.cells]);
const sim = new Sim(b, 1, 5, 1, 1, 'k');
const k0 = keyOf(sim.st);
for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
  const d = sim.tryMove(dx, dy, 'p');
  if (d.moved) sim.applyInverse(d);
  const k1 = keyOf(sim.st);
  console.log(`move (${dx},${dy}) moved=${d.moved} roundtrip=${k0 === k1}`);
}
