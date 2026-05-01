import { writeFileSync } from 'node:fs';
import { createBoard, get, groupAt, type Board } from '../engine/board';
import {
  applyMove,
  initialState,
  legalMoves,
  tryPlace,
  type GameState,
} from '../engine/rules';
import { opposite, type Color, type Point } from '../engine/types';
import { chooseBotMove } from '../game/bot';
import type { Puzzle, PuzzleCategory } from './types';

type Candidate = {
  category: PuzzleCategory;
  toPlay: Color;
  setup: string;
  user: Point;
  size: number;
  score: number;
  key: string;
};

const N_GAMES = 200;
const RANDOM_RATE = 0.25;
const BOARD_SIZE = 9;
const MAX_PLIES = 80;
const TARGET_PER_CATEGORY = 12;

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

const distinctGroups = (board: Board, color: Color): Point[] => {
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

const groupsInAtari = (board: Board, color: Color) => {
  const out: { rep: Point; size: number; lib: Point }[] = [];
  for (const rep of distinctGroups(board, color)) {
    const grp = groupAt(board, rep);
    if (grp && grp.liberties.length === 1) {
      out.push({ rep, size: grp.stones.length, lib: grp.liberties[0]! });
    }
  }
  return out;
};

const onEdge = (board: Board, p: Point): boolean =>
  p.x === 0 || p.y === 0 || p.x === board.size - 1 || p.y === board.size - 1;

const examineCapture = (state: GameState): Candidate | null => {
  const opp = opposite(state.toPlay);
  const ataris = groupsInAtari(state.board, opp);
  // Require exactly one opposing group in atari — solution is unambiguous.
  if (ataris.length !== 1) return null;
  const target = ataris[0]!;
  const move = target.lib;
  const r = tryPlace(state, move, state.toPlay);
  if (!r.ok) return null;
  if (r.result.captured.length === 0) return null;
  // Quality filters: prefer multi-stone captures or captures that aren't trivial
  // (a 1-stone group with the capture point on the edge alone is uninteresting).
  const stoneScore = target.size >= 2 ? 8 : onEdge(state.board, move) ? 3 : 4;
  // Also dock if the position has very few stones overall — looks artificial.
  const stoneCount = state.board.cells.filter((c) => c !== null).length;
  const filledScore = Math.min(stoneCount, 12);
  return {
    category: 'capture-1',
    toPlay: state.toPlay,
    setup: boardToAscii(state.board),
    user: move,
    size: state.board.size,
    score: stoneScore + filledScore,
    key: `cap|${state.toPlay}|${cellsKey(state.board)}|${move.x},${move.y}`,
  };
};

const examineSave = (state: GameState): Candidate | null => {
  const ownAtaris = groupsInAtari(state.board, state.toPlay);
  if (ownAtaris.length !== 1) return null;
  const target = ownAtaris[0]!;
  // Try every legal move for the side-to-move; count how many save the target.
  const candidates: Point[] = [];
  for (const m of legalMoves(state, state.toPlay)) {
    const r = tryPlace(state, m, state.toPlay);
    if (!r.ok) continue;
    // The target group representative may have moved if the saving move
    // captured surrounding stones. Use a stone of the target group that's
    // still on the board (the rep is always still present, since we played
    // our own colour).
    const grp = groupAt(r.result.board, target.rep);
    if (grp && grp.liberties.length >= 2) candidates.push(m);
  }
  if (candidates.length !== 1) return null;
  const move = candidates[0]!;
  const stoneScore = target.size >= 2 ? 8 : 3;
  const stoneCount = state.board.cells.filter((c) => c !== null).length;
  const filledScore = Math.min(stoneCount, 12);
  return {
    category: 'save-1',
    toPlay: state.toPlay,
    setup: boardToAscii(state.board),
    user: move,
    size: state.board.size,
    score: stoneScore + filledScore,
    key: `sav|${state.toPlay}|${cellsKey(state.board)}|${move.x},${move.y}`,
  };
};

const playGame = (
  rand: () => number,
  found: Map<string, Candidate>,
): void => {
  let state = initialState(createBoard(BOARD_SIZE), 'B');
  for (let ply = 0; ply < MAX_PLIES; ply++) {
    const cap = examineCapture(state);
    if (cap && !found.has(cap.key)) found.set(cap.key, cap);
    const sav = examineSave(state);
    if (sav && !found.has(sav.key)) found.set(sav.key, sav);

    let move: Point | null = null;
    if (rand() < RANDOM_RATE) {
      const legal = legalMoves(state, state.toPlay).filter((m) => {
        const r = tryPlace(state, m, state.toPlay);
        if (!r.ok) return false;
        const placed = groupAt(r.result.board, m);
        return !!placed && placed.liberties.length >= 2;
      });
      if (legal.length === 0) break;
      move = legal[Math.floor(rand() * legal.length)]!;
    } else {
      move = chooseBotMove(state, state.toPlay);
    }
    if (!move) break;
    const r = applyMove(state, move);
    if (!r) break;
    state = r.state;
    if (r.captured.length > 0) break;
  }
};

const renderTS = (puzzles: Puzzle[]): string => {
  const out: string[] = [];
  out.push(`// Auto-generated by src/puzzles/generate.ts. Do not edit by hand.`);
  out.push(`import type { Puzzle } from '../types';`);
  out.push(``);
  out.push(`export const GENERATED_PUZZLES: Puzzle[] = [`);
  for (const p of puzzles) {
    out.push(`  {`);
    out.push(`    id: ${JSON.stringify(p.id)},`);
    out.push(`    category: ${JSON.stringify(p.category)},`);
    out.push(`    difficulty: ${p.difficulty},`);
    out.push(`    size: ${p.size},`);
    out.push(`    toPlay: ${JSON.stringify(p.toPlay)},`);
    out.push(`    setup: [`);
    for (const row of p.setup.split('\n')) {
      out.push(`      ${JSON.stringify(row)},`);
    }
    out.push(`    ].join('\\n'),`);
    out.push(
      `    lines: [{ steps: [{ user: { x: ${p.lines[0]!.steps[0]!.user.x}, y: ${p.lines[0]!.steps[0]!.user.y} } }] }],`,
    );
    if (p.hint) out.push(`    hint: ${JSON.stringify(p.hint)},`);
    if (p.description) out.push(`    description: ${JSON.stringify(p.description)},`);
    out.push(`  },`);
  }
  out.push(`];`);
  return out.join('\n') + '\n';
};

const main = () => {
  const rand = seedRandom(424242);
  const found = new Map<string, Candidate>();
  for (let g = 0; g < N_GAMES; g++) playGame(rand, found);

  const all = [...found.values()];
  const captures = all
    .filter((c) => c.category === 'capture-1')
    .sort((a, b) => b.score - a.score);
  const saves = all
    .filter((c) => c.category === 'save-1')
    .sort((a, b) => b.score - a.score);

  // Dedupe by setup string within each category (cross-color dedupe).
  const dedupeBySetup = (xs: Candidate[]): Candidate[] => {
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const x of xs) {
      if (seen.has(x.setup)) continue;
      seen.add(x.setup);
      out.push(x);
    }
    return out;
  };

  const pickedCaps = dedupeBySetup(captures).slice(0, TARGET_PER_CATEGORY);
  const pickedSaves = dedupeBySetup(saves).slice(0, TARGET_PER_CATEGORY);

  const puzzles: Puzzle[] = [];
  pickedCaps.forEach((c, i) => {
    puzzles.push({
      id: `gen-cap-${String(i + 1).padStart(2, '0')}`,
      category: 'capture-1',
      difficulty: 1,
      size: c.size,
      toPlay: c.toPlay,
      setup: c.setup,
      lines: [{ steps: [{ user: c.user }] }],
      hint: 'One move captures the group with a single liberty.',
      description: 'Generated from self-play: find the capture.',
    });
  });
  pickedSaves.forEach((c, i) => {
    puzzles.push({
      id: `gen-sav-${String(i + 1).padStart(2, '0')}`,
      category: 'save-1',
      difficulty: 1,
      size: c.size,
      toPlay: c.toPlay,
      setup: c.setup,
      lines: [{ steps: [{ user: c.user }] }],
      hint: 'Find the only move that gives your group breathing room.',
      description: 'Generated from self-play: save your group in atari.',
    });
  });

  const outPath = 'src/puzzles/data/generated.ts';
  writeFileSync(outPath, renderTS(puzzles));
  console.log(
    `Wrote ${puzzles.length} puzzles (${pickedCaps.length} capture-1, ${pickedSaves.length} save-1) to ${outPath}`,
  );
  console.log(`Total candidates examined: ${found.size}`);
};

main();
// Silence unused warnings for re-exports.
void get;
