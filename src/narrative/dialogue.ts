export interface Choice { label: string; cond?: string; set?: Record<string, number | string | boolean>; next: string; }
export interface DlgNode { id: string; speaker: string; text: string; choices: Choice[]; next?: string; }
export class Flags {
  m: Record<string, number | string | boolean> = {};
  get(k: string) { return this.m[k]; }
  set(k: string, v: number | string | boolean) { this.m[k] = v; }
  load(o: Record<string, number | string | boolean>) { this.m = { ...o }; }
  dump() { return { ...this.m }; }
}
export function condOk(cond: string | undefined, f: Flags): boolean {
  if (!cond) return true;
  // tiny grammar: FLAG, !FLAG, FLAG> N, FLAG==V
  const m = cond.match(/^(!?)(\w+)(?:\s*(>=|>|==)\s*(\w+))?$/);
  if (!m) return true;
  const [, neg, k, op, v] = m;
  let ok: boolean;
  const cur = f.get(k);
  if (!op) ok = !!cur;
  else if (op === '==') ok = String(cur) === v;
  else if (op === '>=') ok = Number(cur ?? 0) >= Number(v);
  else ok = Number(cur ?? 0) > Number(v);
  return neg ? !ok : ok;
}
