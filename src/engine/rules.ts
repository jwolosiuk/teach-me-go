import {
  cloneBoard,
  get,
  groupAt,
  inBounds,
  neighbors,
  set,
  type Board,
} from './board';
import { opposite, type Color, type Point } from './types';

export type PlaceResult = {
  board: Board;
  captured: Point[];
};

export type PlaceError =
  | 'occupied'
  | 'out-of-bounds'
  | 'suicide'
  | 'ko';

export type PlaceOutcome =
  | { ok: true; result: PlaceResult }
  | { ok: false; error: PlaceError };

const cellsKey = (board: Board): string => board.cells.map((c) => c ?? '.').join('');

export type GameState = {
  board: Board;
  toPlay: Color;
  // Hash of the position before the previous move; used for simple-ko.
  previousPositionKey: string | null;
};

export const initialState = (board: Board, toPlay: Color): GameState => ({
  board,
  toPlay,
  previousPositionKey: null,
});

export const tryPlace = (
  state: GameState,
  point: Point,
  color: Color,
): PlaceOutcome => {
  if (!inBounds(state.board, point)) return { ok: false, error: 'out-of-bounds' };
  if (get(state.board, point) !== null) return { ok: false, error: 'occupied' };

  const next = cloneBoard(state.board);
  set(next, point, color);
  const opp = opposite(color);

  const captured: Point[] = [];
  const seen = new Set<number>();
  for (const n of neighbors(next, point)) {
    const i = n.y * next.size + n.x;
    if (seen.has(i)) continue;
    if (get(next, n) !== opp) continue;
    const grp = groupAt(next, n);
    if (!grp) continue;
    for (const s of grp.stones) seen.add(s.y * next.size + s.x);
    if (grp.liberties.length === 0) {
      for (const s of grp.stones) {
        set(next, s, null);
        captured.push(s);
      }
    }
  }

  const placedGroup = groupAt(next, point);
  if (!placedGroup || placedGroup.liberties.length === 0) {
    return { ok: false, error: 'suicide' };
  }

  if (
    state.previousPositionKey !== null &&
    cellsKey(next) === state.previousPositionKey
  ) {
    return { ok: false, error: 'ko' };
  }

  return { ok: true, result: { board: next, captured } };
};

export const applyMove = (state: GameState, point: Point): {
  state: GameState;
  captured: Point[];
} | null => {
  const outcome = tryPlace(state, point, state.toPlay);
  if (!outcome.ok) return null;
  const prevKey = cellsKey(state.board);
  return {
    state: {
      board: outcome.result.board,
      toPlay: opposite(state.toPlay),
      previousPositionKey: prevKey,
    },
    captured: outcome.result.captured,
  };
};

export const legalMoves = (state: GameState, color: Color): Point[] => {
  const out: Point[] = [];
  for (let y = 0; y < state.board.size; y++) {
    for (let x = 0; x < state.board.size; x++) {
      const p = { x, y };
      if (get(state.board, p) !== null) continue;
      const r = tryPlace(state, p, color);
      if (r.ok) out.push(p);
    }
  }
  return out;
};

export const inAtari = (board: Board, point: Point): boolean => {
  const grp = groupAt(board, point);
  return grp !== null && grp.liberties.length === 1;
};
