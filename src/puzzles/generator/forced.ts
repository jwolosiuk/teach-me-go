import { groupAt } from '../../engine/board';
import { applyMove, legalMoves, tryPlace, type GameState } from '../../engine/rules';
import { opposite, type Color, type Point } from '../../engine/types';

export type ForcedStep = { user: Point; bot?: Point };

const distinctGroupsOf = (state: GameState, color: Color) => {
  const result: { rep: Point; libs: Point[] }[] = [];
  const seen = new Set<string>();
  const size = state.board.size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (state.board.cells[y * size + x] !== color) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      const grp = groupAt(state.board, { x, y });
      if (!grp) continue;
      for (const s of grp.stones) seen.add(`${s.x},${s.y}`);
      result.push({ rep: { x, y }, libs: grp.liberties });
    }
  }
  return result;
};

// Returns the unique move that brings every atari'd group of `defender` back
// to ≥2 liberties, or null if none / multiple such moves exist. The move may
// either extend a friendly group or capture surrounding attackers.
export const findOnlySavingMove = (state: GameState, defender: Color): Point | null => {
  const ataris = distinctGroupsOf(state, defender).filter((g) => g.libs.length === 1);
  if (ataris.length === 0) return null;
  // Multiple groups in atari simultaneously → ambiguous puzzle.
  if (ataris.length > 1) return null;

  const target = ataris[0]!;
  const saves: Point[] = [];
  for (const m of legalMoves(state, defender)) {
    const r = tryPlace(state, m, defender);
    if (!r.ok) continue;
    const grpAfter = groupAt(r.result.board, target.rep);
    if (grpAfter && grpAfter.liberties.length >= 2) saves.push(m);
  }
  if (saves.length !== 1) return null;
  return saves[0]!;
};

// Returns true if playing `m` for `attacker` puts at least one opp group
// (that wasn't already in atari) into atari.
const moveCreatesAtari = (state: GameState, m: Point, attacker: Color): boolean => {
  const r = tryPlace(state, m, attacker);
  if (!r.ok) return false;
  const opp = opposite(attacker);
  const before = state.board;
  for (let y = 0; y < r.result.board.size; y++) {
    for (let x = 0; x < r.result.board.size; x++) {
      if (r.result.board.cells[y * r.result.board.size + x] !== opp) continue;
      const grpAfter = groupAt(r.result.board, { x, y });
      if (!grpAfter || grpAfter.liberties.length !== 1) continue;
      const stone = grpAfter.stones[0]!;
      if (before.cells[stone.y * before.size + stone.x] !== opp) continue;
      const grpBefore = groupAt(before, stone);
      if (grpBefore && grpBefore.liberties.length >= 2) return true;
    }
  }
  return false;
};

const orderForcing = (state: GameState, attacker: Color): { m: Point; captures: boolean }[] => {
  const out: { m: Point; captures: boolean; score: number }[] = [];
  for (const m of legalMoves(state, attacker)) {
    const r = tryPlace(state, m, attacker);
    if (!r.ok) continue;
    if (r.result.captured.length > 0) {
      out.push({ m, captures: true, score: 1000 });
      continue;
    }
    if (moveCreatesAtari(state, m, attacker)) {
      out.push({ m, captures: false, score: 100 });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.map(({ m, captures }) => ({ m, captures }));
};

// Search for a sequence in which `attacker` forces a capture within
// `maxSteps` of their own moves. At each step, the defender's response must
// be uniquely forced (only one legal move that saves the attacked group).
export const findForcedCapture = (
  state: GameState,
  attacker: Color,
  maxSteps: number,
): ForcedStep[] | null => {
  if (maxSteps < 1) return null;
  if (state.toPlay !== attacker) return null;

  for (const { m, captures } of orderForcing(state, attacker)) {
    if (captures) return [{ user: m }];
    if (maxSteps < 2) continue;

    const r1 = applyMove(state, m);
    if (!r1) continue;

    const save = findOnlySavingMove(r1.state, opposite(attacker));
    if (!save) continue;

    const r2 = applyMove(r1.state, save);
    if (!r2) continue;

    const rest = findForcedCapture(r2.state, attacker, maxSteps - 1);
    if (rest) return [{ user: m, bot: save }, ...rest];
  }
  return null;
};

// Counts how many distinct first moves lead to a forced capture in ≤ steps.
// Used to gauge puzzle uniqueness — a one-solution puzzle returns 1.
export const countForcedFirstMoves = (
  state: GameState,
  attacker: Color,
  maxSteps: number,
): number => {
  if (state.toPlay !== attacker) return 0;
  let count = 0;
  for (const { m, captures } of orderForcing(state, attacker)) {
    if (captures) {
      count += 1;
      continue;
    }
    if (maxSteps < 2) continue;
    const r1 = applyMove(state, m);
    if (!r1) continue;
    const save = findOnlySavingMove(r1.state, opposite(attacker));
    if (!save) continue;
    const r2 = applyMove(r1.state, save);
    if (!r2) continue;
    if (findForcedCapture(r2.state, attacker, maxSteps - 1)) count += 1;
  }
  return count;
};
