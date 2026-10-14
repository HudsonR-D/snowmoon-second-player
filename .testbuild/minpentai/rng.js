// Seedable RNG with snapshot/restore for deterministic rewind.
export function hashSeed(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
export class Rng {
    constructor(seedStr) {
        this.gameCalls = 0;
        const h = hashSeed(seedStr);
        this.mapA = h >>> 0;
        this.gameA = (h ^ 0x9e3779b9) >>> 0;
    }
    static step(a) {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return { v: ((t ^ (t >>> 14)) >>> 0) / 4294967296, a };
    }
    nextMap() { const r = Rng.step(this.mapA); this.mapA = r.a; return r.v; }
    nextGame() { const r = Rng.step(this.gameA); this.gameA = r.a; this.gameCalls++; return r.v; }
    snapshot() { return { mapA: this.mapA, gameA: this.gameA, gameCalls: this.gameCalls }; }
    restore(s) { this.mapA = s.mapA; this.gameA = s.gameA; this.gameCalls = s.gameCalls; }
}
