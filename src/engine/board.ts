import type { Cell, Color, Point } from './types';

export type Board = {
  size: number;
  cells: Cell[];
};

export const createBoard = (size: number): Board => ({
  size,
  cells: new Array(size * size).fill(null),
});

export const cloneBoard = (board: Board): Board => ({
  size: board.size,
  cells: board.cells.slice(),
});

export const inBounds = (board: Board, p: Point): boolean =>
  p.x >= 0 && p.y >= 0 && p.x < board.size && p.y < board.size;

const idx = (board: Board, p: Point): number => p.y * board.size + p.x;

export const get = (board: Board, p: Point): Cell => board.cells[idx(board, p)];

export const set = (board: Board, p: Point, v: Cell): void => {
  board.cells[idx(board, p)] = v;
};

export const neighbors = (board: Board, p: Point): Point[] => {
  const out: Point[] = [];
  if (p.x > 0) out.push({ x: p.x - 1, y: p.y });
  if (p.x < board.size - 1) out.push({ x: p.x + 1, y: p.y });
  if (p.y > 0) out.push({ x: p.x, y: p.y - 1 });
  if (p.y < board.size - 1) out.push({ x: p.x, y: p.y + 1 });
  return out;
};

export type Group = {
  color: Color;
  stones: Point[];
  liberties: Point[];
};

export const groupAt = (board: Board, start: Point): Group | null => {
  const color = get(board, start);
  if (color === null) return null;
  const visited = new Set<number>();
  const libSet = new Set<number>();
  const stones: Point[] = [];
  const stack: Point[] = [start];
  while (stack.length) {
    const p = stack.pop()!;
    const i = idx(board, p);
    if (visited.has(i)) continue;
    visited.add(i);
    stones.push(p);
    for (const n of neighbors(board, p)) {
      const ni = idx(board, n);
      const c = board.cells[ni];
      if (c === null) {
        libSet.add(ni);
      } else if (c === color && !visited.has(ni)) {
        stack.push(n);
      }
    }
  }
  const liberties: Point[] = [];
  for (const li of libSet) {
    liberties.push({ x: li % board.size, y: Math.floor(li / board.size) });
  }
  return { color, stones, liberties };
};

export const boardsEqual = (a: Board, b: Board): boolean => {
  if (a.size !== b.size) return false;
  for (let i = 0; i < a.cells.length; i++) {
    if (a.cells[i] !== b.cells[i]) return false;
  }
  return true;
};
