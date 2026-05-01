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
  const size = board.size;
  const startIdx = start.y * size + start.x;
  const color = board.cells[startIdx];
  if (color === null || color === undefined) return null;
  const total = size * size;
  const visited = new Uint8Array(total);
  const libMask = new Uint8Array(total);
  const stoneIdxs: number[] = [];
  const stack: number[] = [startIdx];
  visited[startIdx] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    stoneIdxs.push(i);
    const x = i % size;
    const y = (i / size) | 0;
    // up
    if (y > 0) {
      const ni = i - size;
      if (!visited[ni]) {
        const c = board.cells[ni];
        if (c === null) libMask[ni] = 1;
        else if (c === color) { visited[ni] = 1; stack.push(ni); }
      }
    }
    // down
    if (y < size - 1) {
      const ni = i + size;
      if (!visited[ni]) {
        const c = board.cells[ni];
        if (c === null) libMask[ni] = 1;
        else if (c === color) { visited[ni] = 1; stack.push(ni); }
      }
    }
    // left
    if (x > 0) {
      const ni = i - 1;
      if (!visited[ni]) {
        const c = board.cells[ni];
        if (c === null) libMask[ni] = 1;
        else if (c === color) { visited[ni] = 1; stack.push(ni); }
      }
    }
    // right
    if (x < size - 1) {
      const ni = i + 1;
      if (!visited[ni]) {
        const c = board.cells[ni];
        if (c === null) libMask[ni] = 1;
        else if (c === color) { visited[ni] = 1; stack.push(ni); }
      }
    }
  }
  const stones: Point[] = new Array(stoneIdxs.length);
  for (let k = 0; k < stoneIdxs.length; k++) {
    const i = stoneIdxs[k]!;
    stones[k] = { x: i % size, y: (i / size) | 0 };
  }
  const liberties: Point[] = [];
  for (let i = 0; i < total; i++) {
    if (libMask[i]) liberties.push({ x: i % size, y: (i / size) | 0 });
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
