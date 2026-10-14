export class Board {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.cells = Array.from({ length: w * h }, () => ({
            terrain: 'empty', piece: 'none',
            symbol: false, hp: 0, dirX: 0, dirY: 0, jammed: false, stickerT: 0,
        }));
    }
    idx(x, y) { return y * this.w + x; }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    get(x, y) { return this.cells[this.idx(x, y)]; }
    clone() {
        const b = new Board(this.w, this.h);
        b.cells = this.cells.map(c => ({ ...c }));
        return b;
    }
}
