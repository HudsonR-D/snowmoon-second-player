export interface Clue { id: string; title: string; summary: string; }
export class Deduction {
  clues: Clue[] = [];
  requiredLink: [string, string];
  solved = false;
  constructor(requiredLink: [string, string]) { this.requiredLink = requiredLink; }
  add(c: Clue) { if (!this.clues.find(k => k.id === c.id)) this.clues.push(c); }
  tryLink(a: string, b: string): 'correct' | 'wrong' {
    const [x, y] = this.requiredLink;
    const ok = (a === x && b === y) || (a === y && b === x);
    if (ok) this.solved = true;
    return ok ? 'correct' : 'wrong';
  }
}
