import { createBoard, set, type Board } from '../engine/board';
import type { Color } from '../engine/types';

export const parseSetup = (text: string, expectedSize?: number): Board => {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('Empty setup');

  const rows = lines.map((line) =>
    line
      .split(/\s+/)
      .filter((tok) => tok.length > 0)
      .map((tok) => tok[0]!),
  );

  const size = rows[0]!.length;
  if (expectedSize !== undefined && size !== expectedSize) {
    throw new Error(`Expected size ${expectedSize}, got ${size}`);
  }
  if (rows.length !== size) {
    throw new Error(`Setup must be square: got ${rows.length} rows × ${size} cols`);
  }

  const board = createBoard(size);
  for (let y = 0; y < size; y++) {
    const row = rows[y]!;
    if (row.length !== size) {
      throw new Error(`Row ${y} has ${row.length} cells, expected ${size}`);
    }
    for (let x = 0; x < size; x++) {
      const ch = row[x]!;
      let cell: Color | null = null;
      if (ch === 'X' || ch === 'B' || ch === '#') cell = 'B';
      else if (ch === 'O' || ch === 'W' || ch === '@') cell = 'W';
      else if (ch === '.' || ch === '-' || ch === '+') cell = null;
      else throw new Error(`Unknown cell '${ch}' at (${x},${y})`);
      if (cell) set(board, { x, y }, cell);
    }
  }
  return board;
};

export const pt = (x: number, y: number): { x: number; y: number } => ({ x, y });
