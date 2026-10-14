export function setHud(msg: string) {
  const el = document.getElementById('hud');
  if (el) el.textContent = msg;
}
export function showDlg(html: string) {
  const el = document.getElementById('dlg');
  if (el) el.innerHTML = html;
}
