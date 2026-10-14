export class Flags {
    constructor() {
        this.m = {};
    }
    get(k) { return this.m[k]; }
    set(k, v) { this.m[k] = v; }
    load(o) { this.m = { ...o }; }
    dump() { return { ...this.m }; }
}
export function condOk(cond, f) {
    if (!cond)
        return true;
    // tiny grammar: FLAG, !FLAG, FLAG> N, FLAG==V
    const m = cond.match(/^(!?)(\w+)(?:\s*(>=|>|==)\s*(\w+))?$/);
    if (!m)
        return true;
    const [, neg, k, op, v] = m;
    let ok;
    const cur = f.get(k);
    if (!op)
        ok = !!cur;
    else if (op === '==')
        ok = String(cur) === v;
    else if (op === '>=')
        ok = Number(cur ?? 0) >= Number(v);
    else
        ok = Number(cur ?? 0) > Number(v);
    return neg ? !ok : ok;
}
