export class Deduction {
    constructor(requiredLink) {
        this.clues = [];
        this.solved = false;
        this.requiredLink = requiredLink;
    }
    add(c) { if (!this.clues.find(k => k.id === c.id))
        this.clues.push(c); }
    tryLink(a, b) {
        const [x, y] = this.requiredLink;
        const ok = (a === x && b === y) || (a === y && b === x);
        if (ok)
            this.solved = true;
        return ok ? 'correct' : 'wrong';
    }
}
