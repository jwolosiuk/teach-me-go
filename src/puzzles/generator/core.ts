import { createBoard, groupAt, type Board } from '../../engine/board';
import { applyMove, initialState, legalMoves, tryPlace, type GameState } from '../../engine/rules';
import type { Color, Point } from '../../engine/types';
import { chooseBotMove } from '../../game/bot';
import type { Puzzle, PuzzleCategory } from '../types';
import { countForcedFirstMoves, findForcedCapture, findOnlySavingMove, type ForcedStep } from './forced';

export type GenerateOptions = {
  count: number;
  // Maximum line length to consider. Generator returns puzzles of mixed lengths,
  // capped at this depth.
  maxSteps: number;
  seed?: number;
  size?: number;
  // How many self-play games to run before stopping. Defaults to ~6× count.
  maxGames?: number;
};

type Candidate = {
  category: PuzzleCategory;
  toPlay: Color;
  setup: string;
  steps: ForcedStep[];
  size: number;
  score: number;
  key: string;
};

const seedRandom = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

const cellsKey = (board: Board): string =>
  board.cells.map((c) => (c === null ? '.' : c)).join('');

const boardToAscii = (board: Board): string => {
  const lines: string[] = [];
  for (let y = 0; y < board.size; y++) {
    const row: string[] = [];
    for (let x = 0; x < board.size; x++) {
      const c = board.cells[y * board.size + x];
      row.push(c === 'B' ? 'X' : c === 'W' ? 'O' : '.');
    }
    lines.push(row.join(' '));
  }
  return lines.join('\n');
};

const onEdge = (board: Board, p: Point): boolean =>
  p.x === 0 || p.y === 0 || p.x === board.size - 1 || p.y === board.size - 1;

const examineCapture = (state: GameState, maxSteps: number): Candidate | null => {
  const attacker = state.toPlay;
  const line = findForcedCapture(state, attacker, maxSteps);
  if (!line || line.length === 0) return null;
  // Reject highly ambiguous puzzles (too many alternative first moves).
  const alternativeCount = countForcedFirstMoves(state, attacker, line.length);
  if (alternativeCount > 2) return null;
  const stoneCount = state.board.cells.filter((c) => c !== null).length;
  if (stoneCount < 4) return null;
  const cat: PuzzleCategory = line.length === 1 ? 'capture-1' : 'ladder';
  const lengthBonus = line.length * 12;
  const onEdgeFirst = onEdge(state.board, line[0]!.user) ? 1 : 3;
  const score = lengthBonus + Math.min(stoneCount, 14) + onEdgeFirst;
  return {
    category: cat,
    toPlay: attacker,
    setup: boardToAscii(state.board),
    steps: line,
    size: state.board.size,
    score,
    key: `cap${line.length}|${attacker}|${cellsKey(state.board)}`,
  };
};

const examineSave = (state: GameState): Candidate | null => {
  const defender = state.toPlay;
  const save = findOnlySavingMove(state, defender);
  if (!save) return null;
  // Verify the save genuinely brings the group out of atari without immediate refutation.
  const r = tryPlace(state, save, defender);
  if (!r.ok) return null;
  const stoneCount = state.board.cells.filter((c) => c !== null).length;
  if (stoneCount < 4) return null;
  // Quality: prefer multi-stone targets and non-edge.
  let targetSize = 1;
  for (let y = 0; y < state.board.size; y++) {
    for (let x = 0; x < state.board.size; x++) {
      if (state.board.cells[y * state.board.size + x] !== defender) continue;
      const grp = groupAt(state.board, { x, y });
      if (grp && grp.liberties.length === 1) {
        targetSize = Math.max(targetSize, grp.stones.length);
      }
    }
  }
  const score = 4 + targetSize * 5 + Math.min(stoneCount, 14);
  return {
    category: 'save-1',
    toPlay: defender,
    setup: boardToAscii(state.board),
    steps: [{ user: save }],
    size: state.board.size,
    score,
    key: `sav|${defender}|${cellsKey(state.board)}|${save.x},${save.y}`,
  };
};

const playRandomLegalSafe = (state: GameState, rand: () => number): Point | null => {
  const legal = legalMoves(state, state.toPlay).filter((m) => {
    const r = tryPlace(state, m, state.toPlay);
    if (!r.ok) return false;
    const placed = groupAt(r.result.board, m);
    return !!placed && placed.liberties.length >= 2;
  });
  if (legal.length === 0) return null;
  return legal[Math.floor(rand() * legal.length)] ?? null;
};

const playGame = (
  rand: () => number,
  size: number,
  maxSteps: number,
  found: Map<string, Candidate>,
): void => {
  let state = initialState(createBoard(size), 'B');
  const RANDOM_RATE = 0.3;
  const MAX_PLIES = 90;
  for (let ply = 0; ply < MAX_PLIES; ply++) {
    const cap = examineCapture(state, maxSteps);
    if (cap && !found.has(cap.key)) found.set(cap.key, cap);
    const sav = examineSave(state);
    if (sav && !found.has(sav.key)) found.set(sav.key, sav);

    let move: Point | null;
    if (rand() < RANDOM_RATE) {
      move = playRandomLegalSafe(state, rand);
    } else {
      move = chooseBotMove(state, state.toPlay, { level: 1 }, 200);
    }
    if (!move) break;
    const r = applyMove(state, move);
    if (!r) break;
    state = r.state;
    if (r.captured.length > 0) break;
  }
};

export const generatePuzzles = (opts: GenerateOptions): Puzzle[] => {
  const count = Math.max(1, opts.count | 0);
  const maxSteps = Math.max(1, Math.min(6, opts.maxSteps | 0));
  const size = opts.size ?? 9;
  const maxGames = opts.maxGames ?? Math.max(40, count * 6);
  const seed = opts.seed ?? Date.now();
  const rand = seedRandom(seed);
  const found = new Map<string, Candidate>();

  for (let g = 0; g < maxGames; g++) {
    if (found.size >= count * 5) break;
    playGame(rand, size, maxSteps, found);
  }

  const cands = [...found.values()].sort((a, b) => b.score - a.score);
  // Dedupe by setup (cross-step), favouring higher score.
  const seenSetup = new Set<string>();
  const picked: Candidate[] = [];
  for (const c of cands) {
    if (seenSetup.has(c.setup)) continue;
    seenSetup.add(c.setup);
    picked.push(c);
    if (picked.length >= count) break;
  }

  return picked.map((c, i) => {
    const stepsLabel =
      c.category === 'save-1'
        ? 'save'
        : c.steps.length === 1
        ? 'capture'
        : `${c.steps.length}-step capture`;
    return {
      id: `gen-${seed.toString(36).slice(-4)}-${String(i + 1).padStart(2, '0')}`,
      category: c.category,
      difficulty: c.steps.length >= 3 ? 3 : c.steps.length === 2 ? 2 : 1,
      size: c.size,
      toPlay: c.toPlay,
      setup: c.setup,
      lines: [{ steps: c.steps }],
      hint:
        c.category === 'save-1'
          ? 'Find the only move that brings the group back to ≥2 liberties.'
          : c.steps.length === 1
          ? 'One move captures.'
          : 'Force the capture: each of your moves leaves only one legal reply.',
      description: `Generated (${stepsLabel}).`,
    };
  });
};
