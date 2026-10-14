/* Mechanics micro-tests: crush / jam-freeze / shared stickers / deluin trail.
 * Run: node tests/mech.mjs (after tsc -p tsconfig.sim.json)
 */
import { Board } from '../.testbuild/minpentai/board.js';
import { Sim } from '../.testbuild/minpentai/sim.js';

let failures = 0;
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x}`); if (!c) failures++; };
const blank = (w, h) => new Board(w, h);

// 1. crush: player(0,0) rock(1,0), hunter waiting at (2,0) hp1 lethal → E crushes, won
{
  const b = blank(5, 5);
  b.get(1, 0).piece = 'rock';
  const s = new Sim(b, 0, 0, 0, 4, 'mech1');
  s.enablePack([{ x: 2, y: 0, wp: [[2, 0], [2, 0]] }], 1);
  s.enableLethal();
  const d = s.tryMove(1, 0, 'p');
  ok('crush kills hp1 hunter', s.st.hunters[0].dead && d.moved);
  ok('crush-all wins (lethal)', s.st.won);
}
// 2. jam freeze: hunter loops, jammer dropped near → frozen 6 turns
{
  const b = blank(9, 9);
  const s = new Sim(b, 4, 4, 0, 0, 'mech2');
  s.enablePack([{ x: 1, y: 1, wp: [[1, 1], [5, 1], [5, 5], [1, 5]] }], 3);
  s.enableJammers(2);
  const dj = s.dropJammer(); // at (4,4)
  ok('jammer drops', dj.moved && s.st.jamT === 6);
  // walk hunter-adjacent: hunter at (1,1), player far — teleport hunter near via loop? instead: fresh hunter next to jam
  const b2 = blank(9, 9);
  const s2 = new Sim(b2, 4, 4, 0, 0, 'mech2b');
  s2.enablePack([{ x: 4, y: 2, wp: [[4, 2], [4, 0], [6, 0], [6, 2]] }], 3);
  s2.enableJammers(1);
  s2.dropJammer(); // (4,4), hunter (4,2) dist 2 ≤3 → frozen
  const hx = s2.st.hunters[0].x, hy = s2.st.hunters[0].y;
  for (let i = 0; i < 4; i++) s2.tryMove(0, 1, 'p');
  ok('frozen hunter holds 4 turns', s2.st.hunters[0].x === hx && s2.st.hunters[0].y === hy, ` (${hx},${hy})`);
}
// 3. shared stickers: corridor, DOG sees both; paint hides walker
{
  const b = blank(9, 9);
  const s = new Sim(b, 1, 4, 0, 0, 'mech3');
  s.enablePack([{ x: 5, y: 4, wp: [[5, 4], [5, 4]] }], 3);
  s.enableEscort(1, 5, 3, 3, 8, 4);
  s.tryMove(1, 0, 'p'); // (2,4): DOG dist 3 sees → spot 1
  const s1 = s.st.spots;
  s.paintSticker(); // paint (2,4)
  s.tryMove(1, 0, 'p'); // (3,4) bare, seen → spot 2
  ok('unpainted crossing noticed', s1 === 1 && s.st.spots === 2, ` spots=${s.st.spots}`);
  // deluin trails onto painted (2,4): hidden there (paint turn adds no trail step)
  for (let i = 0; i < 3; i++) s.tryMove(-1, 0, 'p');
  ok('deluin follows trail', s.st.dx === 2 && s.st.dy === 5, ` D=(${s.st.dx},${s.st.dy})`);
}
// 4. deluin win: player on exit with D close
{
  const b = blank(5, 5);
  const s = new Sim(b, 0, 2, 0, 0, 'mech4');
  s.enablePack([], 3);
  s.enableEscort(0, 3, 0, 3, 3, 2);
  s.tryMove(1, 0, 'p'); s.tryMove(1, 0, 'p'); s.tryMove(1, 0, 'p'); // (3,2) exit; D trails
  ok('escort win on exit with D≤3', s.st.won, ` D=(${s.st.dx},${s.st.dy})`);
}
console.log(failures ? `\n${failures} FAILURES` : '\nMECH ALL PASS');
process.exit(failures ? 1 : 0);
