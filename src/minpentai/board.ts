// Grid model: integer coords, no floats. One piece + one symbol per cell max.
export type Terrain = 'empty' | 'shrine';
export type PieceKind = 'none' | 'wall' | 'factory' | 'glider' | 'ally' | 'spaceship' | 'rock' | 'mirror';
export interface Cell {
  terrain: Terrain;
  piece: PieceKind;
  symbol: boolean; // collectible key
  hp: number; // spaceship 2HP
  dirX: number; dirY: number; // spaceship / mirror loop
  jammed: boolean;
  stickerT: number;
}
export class Board {
  w: number; h: number; cells: Cell[];
  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.cells = Array.from({ length: w * h }, () => ({
      terrain: 'empty' as Terrain, piece: 'none' as PieceKind,
      symbol: false, hp: 0, dirX: 0, dirY: 0, jammed: false, stickerT: 0,
    }));
  }
  idx(x: number, y: number) { return y * this.w + x; }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x: number, y: number): Cell { return this.cells[this.idx(x, y)]; }
  clone(): Board {
    const b = new Board(this.w, this.h);
    b.cells = this.cells.map(c => ({ ...c }));
    return b;
  }
}
export interface Actor { x: number; y: number; kind: PieceKind; hasSymbol: boolean; }
