// Silent-coop poll: big buttons, 20s, keyboard 1/2, badge hint (no label mutation), aria-live.
export interface PollOpt { id: string; label: string; }
export function runPoll(el: HTMLElement, opts: PollOpt[], ghost: string, secs = 20): Promise<string> {
  return new Promise(resolve => {
    el.innerHTML = '';
    const t = document.createElement('div');
    t.setAttribute('role', 'radiogroup');
    t.setAttribute('aria-label', 'Silent vote');
    t.innerHTML = `<b>Silent vote</b> — no chat, 20s. Timeout defaults to Decoy robe run. Press 1/2. <span id="pcount" aria-live="polite">${secs}</span>s`;
    el.appendChild(t);
    const bar = document.createElement('div');
    bar.style.cssText = 'height:6px;background:#2a3446;margin:6px 0';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:6px;background:#63e6be;width:100%';
    bar.appendChild(fill); el.appendChild(bar);
    let done = false;
    const finish = (id: string) => { if (done) return; done = true; window.clearInterval(iv); document.removeEventListener('keydown', onK); resolve(id); };
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.innerHTML = `${o.label} <small style="opacity:.6">[${i + 1}]</small> <span class="ghostbadge" data-ghost="${o.id}" style="display:none;color:#ecc94b">★ second-player leans here</span>`;
      b.style.marginRight = '8px';
      b.onclick = () => finish(o.id);
      (b as HTMLButtonElement).dataset.pid = o.id;
      el.appendChild(b);
    });
    const onK = (e: KeyboardEvent) => {
      if (e.key === '1') finish(opts[0]?.id ?? ghost);
      else if (e.key === '2' && opts[1]) finish(opts[1].id);
      else if (e.key === '3' && opts[2]) finish(opts[2].id);
    };
    document.addEventListener('keydown', onK);
    let left = secs;
    const iv = window.setInterval(() => {
      left--;
      const c = el.querySelector('#pcount'); if (c) c.textContent = String(left);
      fill.style.width = `${Math.max(0, (left / secs)) * 100}%`;
      if (left === secs - 4) {
        const g = el.querySelector(`[data-ghost="${ghost}"]`) as HTMLElement | null;
        if (g) g.style.display = 'inline';
      }
      if (left <= 0) finish(ghost);
    }, 1000);
  });
}
