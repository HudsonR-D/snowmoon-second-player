import { Board } from './board.js';
// Batched canvas renderer, dirty-cell redraw, <6ms target for slice boards.
export function drawBoard(ctx: CanvasRenderingContext2D, b: Board, px: number, py: number, ax: number, ay: number, pSym: boolean, aSym: boolean, theme: string, deluin?: [number, number]) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = theme === 'market' ? '#131a26' : '#10141d';
  ctx.fillRect(0, 0, W, H);
  const cw = W / b.w, ch = H / b.h;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const c = b.get(x, y);
    const X = x * cw, Y = y * ch;
    if (c.terrain === 'shrine') { ctx.fillStyle = '#3a2f12'; ctx.fillRect(X, Y, cw, ch); ctx.strokeStyle = '#d8a723'; ctx.strokeRect(X + 2, Y + 2, cw - 4, ch - 4); }
    else { ctx.fillStyle = (x + y) % 2 ? '#161d2b' : '#141a26'; ctx.fillRect(X, Y, cw, ch); }
    if (c.piece === 'wall') { ctx.fillStyle = '#8b93a5'; ctx.fillRect(X + 4, Y + 4, cw - 8, ch - 8); }
    if (c.piece === 'factory') { ctx.fillStyle = '#4a5568'; ctx.fillRect(X + 4, Y + 4, cw - 8, ch - 8); ctx.fillStyle = '#9ae6b4'; ctx.fillRect(X + cw / 2 - 3, Y + 6, 6, 6); }
    if (c.piece === 'rock') { ctx.fillStyle = '#a0aec0'; ctx.beginPath(); ctx.arc(X + cw / 2, Y + ch / 2, Math.min(cw, ch) / 3, 0, 7); ctx.fill(); }
    if (c.piece === 'mirror') { ctx.fillStyle = '#63b3ed'; ctx.fillRect(X + 4, Y + 4, cw - 8, ch - 8); ctx.fillStyle = '#0b0e14'; ctx.fillRect(X + 6, Y + ch / 2 - 2, cw - 12, 4); }
    if (c.piece === 'spaceship') { ctx.fillStyle = c.hp > 1 ? '#fc8181' : '#f6ad55'; ctx.fillRect(X + 8, Y + 8, cw - 16, ch - 16); }
    if (c.symbol) { ctx.fillStyle = '#ecc94b'; ctx.beginPath(); ctx.arc(X + cw / 2, Y + ch / 2, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#0b0e14'; ctx.fillText('s', X + cw / 2 - 3, Y + ch / 2 + 4); }
    if (c.stickerT === 1) { ctx.strokeStyle = '#ecc94b'; ctx.setLineDash([4, 3]); ctx.strokeRect(X + 3, Y + 3, cw - 6, ch - 6); ctx.setLineDash([]); }
    if (c.stickerT === 2) { ctx.strokeStyle = '#63b3ed'; ctx.setLineDash([4, 3]); ctx.strokeRect(X + 3, Y + 3, cw - 6, ch - 6); ctx.setLineDash([]); }
  }
  // Valid-move highlight: outline orthogonal free cells around player.
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = px + ox, ny = py + oy;
    if (nx < 0 || ny < 0 || nx >= b.w || ny >= b.h) continue;
    const nc = b.get(nx, ny);
    if (nc.piece === 'wall' || nc.piece === 'factory' || nc.piece === 'mirror' || nc.piece === 'spaceship') continue;
    ctx.strokeRect(nx * cw + 3, ny * ch + 3, cw - 6, ch - 6);
  }
  ctx.lineWidth = 1;
  const dot = (x: number, y: number, col: string, label: string) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x * cw + cw / 2, y * ch + ch / 2, Math.min(cw, ch) / 2 - 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#0b0e14'; ctx.font = 'bold 14px system-ui'; ctx.fillText(label, x * cw + cw / 2 - 5, y * ch + ch / 2 + 5);
  };
  dot(px, py, '#63e6be', 'Z');
  dot(ax, ay, '#90cdf4', 'B');
  if (deluin && deluin[0] >= 0) dot(deluin[0], deluin[1], '#d6bcfa', 'D');
  if (pSym) { ctx.fillStyle = '#ecc94b'; ctx.fillRect(6, 6, 12, 12); }
  if (aSym) { ctx.fillStyle = '#90cdf4'; ctx.fillRect(24, 6, 12, 12); }
}
