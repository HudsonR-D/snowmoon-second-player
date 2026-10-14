import { Game } from './game.js';
import { toggleMute, isMuted } from './audio.js';

const cv = document.getElementById('cv') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const g = new Game(ctx);

document.getElementById('btnHub')!.onclick = () => g.toHub();
document.getElementById('btnMZ1')!.onclick = () => g.playMZ1();
document.getElementById('btnMZ2')!.onclick = () => g.playMZ2();
document.getElementById('btnMZ3')!.onclick = () => g.playMZ3();
document.getElementById('btnMZ4')!.onclick = () => g.playMZ4();
document.getElementById('btnMZ5')!.onclick = () => g.playMZ5();
document.getElementById('btnMZ6')!.onclick = () => g.playMZ6();
document.getElementById('btnJam')!.onclick = () => g.jam();
document.getElementById('btnSticker')!.onclick = () => g.sticker();
document.getElementById('btnFlip')!.onclick = () => g.flip();
document.getElementById('btnBuild')!.onclick = () => g.build(g.lastDir.dx, g.lastDir.dy);
document.getElementById('btnMG1')!.onclick = () => g.playMG1();
document.getElementById('btnMG2')!.onclick = () => g.playMG2();
document.getElementById('btnMG3')!.onclick = () => g.playMG3();
document.getElementById('btnMG4')!.onclick = () => g.playMG4();
document.getElementById('btnMG5')!.onclick = () => g.playMG5();
document.getElementById('btnMG6')!.onclick = () => g.playMG6();
document.getElementById('btnRewind')!.onclick = () => g.rewind();
const muteBtn = document.getElementById('btnMute')!;
const syncMute = () => {
  const m = isMuted();
  muteBtn.textContent = m ? 'Unmute (sound off)' : 'Mute (sound on)';
  muteBtn.setAttribute('aria-pressed', String(m));
};
syncMute();
muteBtn.addEventListener('click', () => {
  toggleMute();
  syncMute();
});
