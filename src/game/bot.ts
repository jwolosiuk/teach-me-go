import { groupAt, neighbors, type Board } from '../engine/board';
import { applyMove, tryPlace, type GameState } from '../engine/rules';
import { opposite, type Color, type Point } from '../engine/types';

const allEmpty = (board: Board): Point[] => {
  const out: Point[] = [];
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      if (board.cells[y * board.size + x] === null) out.push({ x, y });
    }
  }
  return out;
};

const distinctOppGroups = (board: Board, color: Color): Point[] => {
  const opp = opposite(color);
  const seen = new Set<string>();
  const reps: Point[] = [];
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      if (board.cells[y * board.size + x] !== opp) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      const grp = groupAt(board, { x, y });
      if (!grp) continue;
      reps.push({ x, y });
      for (const s of grp.stones) seen.add(`${s.x},${s.y}`);
    }
  }
  return reps;
};

const distinctOwnGroups = (board: Board, color: Color): Point[] => {
  const seen = new Set<string>();
  const reps: Point[] = [];
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      if (board.cells[y * board.size + x] !== color) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      const grp = groupAt(board, { x, y });
      if (!grp) continue;
      reps.push({ x, y });
      for (const s of grp.stones) seen.add(`${s.x},${s.y}`);
    }
  }
  return reps;
};

const newLibCount = (state: GameState, point: Point, color: Color): number => {
  const r = tryPlace(state, point, color);
  if (!r.ok) return -1;
  const grp = groupAt(r.result.board, point);
  return grp ? grp.liberties.length : 0;
};

export const chooseBotMove = (state: GameState, color: Color): Point | null => {
  const board = state.board;

  // 1. Capture if any opponent group is in atari.
  for (const rep of distinctOppGroups(board, color)) {
    const grp = groupAt(board, rep);
    if (grp && grp.liberties.length === 1) {
      const lib = grp.liberties[0]!;
      const r = tryPlace(state, lib, color);
      if (r.ok && r.result.captured.length > 0) return lib;
    }
  }

  // 2. Defend any of own groups in atari — pick the move that yields the most liberties.
  let defendBest: { p: Point; libs: number } | null = null;
  for (const rep of distinctOwnGroups(board, color)) {
    const grp = groupAt(board, rep);
    if (!grp || grp.liberties.length !== 1) continue;
    const escape = grp.liberties[0]!;
    const libs = newLibCount(state, escape, color);
    if (libs > 1 && (!defendBest || libs > defendBest.libs)) {
      defendBest = { p: escape, libs };
    }
  }
  if (defendBest) return defendBest.p;

  // 3. Atari opponent groups with 2 liberties (greedy threat).
  for (const rep of distinctOppGroups(board, color)) {
    const grp = groupAt(board, rep);
    if (!grp || grp.liberties.length !== 2) continue;
    for (const lib of grp.liberties) {
      const r = tryPlace(state, lib, color);
      if (!r.ok) continue;
      const placed = groupAt(r.result.board, lib);
      if (placed && placed.liberties.length >= 2) return lib;
    }
  }

  // 4. Play next to opponent's most recent stone (centre-of-mass biased).
  const empties = allEmpty(board);
  if (empties.length === 0) return null;

  const opp = opposite(color);
  let target: Point | null = null;
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      if (board.cells[y * board.size + x] === opp) {
        target = { x, y };
      }
    }
  }
  if (target) {
    let best: { p: Point; score: number } | null = null;
    for (const n of neighbors(board, target)) {
      const r = tryPlace(state, n, color);
      if (!r.ok) continue;
      const placed = groupAt(r.result.board, n);
      const libs = placed ? placed.liberties.length : 0;
      if (libs < 2) continue;
      const c = (board.size - 1) / 2;
      const dist = Math.abs(n.x - c) + Math.abs(n.y - c);
      const score = libs * 10 - dist;
      if (!best || score > best.score) best = { p: n, score };
    }
    if (best) return best.p;
  }

  // 5. Fallback: any safe move (≥2 liberties), centre preference.
  let fallback: { p: Point; score: number } | null = null;
  const c = (board.size - 1) / 2;
  for (const e of empties) {
    const r = tryPlace(state, e, color);
    if (!r.ok) continue;
    const placed = groupAt(r.result.board, e);
    const libs = placed ? placed.liberties.length : 0;
    if (libs < 2) continue;
    const dist = Math.abs(e.x - c) + Math.abs(e.y - c);
    const score = libs * 10 - dist;
    if (!fallback || score > fallback.score) fallback = { p: e, score };
  }
  return fallback ? fallback.p : null;
};

export const playBot = (state: GameState): { state: GameState; move: Point } | null => {
  const move = chooseBotMove(state, state.toPlay);
  if (!move) return null;
  const r = applyMove(state, move);
  if (!r) return null;
  return { state: r.state, move };
};
