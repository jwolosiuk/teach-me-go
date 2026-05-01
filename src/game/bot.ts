import { groupAt, neighbors, type Board } from '../engine/board';
import { applyMove, legalMoves, tryPlace, type GameState } from '../engine/rules';
import { opposite, type Color, type Point } from '../engine/types';

export type BotLevel = 0 | 1 | 2 | 3;

export type BotConfig =
  | { level: 0 }
  | { level: 1 }
  | { level: 2; depth: number }
  | { level: 3; depth: number };

export type BotPreset = {
  id: string;
  label: string;
  description: string;
  config: BotConfig;
};

export const BOT_PRESETS: BotPreset[] = [
  {
    id: '0',
    label: 'Level 0',
    description: 'Beginner — greedy: captures, defends atari, plays contact moves.',
    config: { level: 0 },
  },
  {
    id: '1',
    label: 'Level 1',
    description: 'Intermediate — Level 0 + 1-ply filter against immediate capture.',
    config: { level: 1 },
  },
  {
    id: '2.2',
    label: 'Level 2.2',
    description: 'Advanced — alpha-beta minimax, depth 2.',
    config: { level: 2, depth: 2 },
  },
  {
    id: '2.3',
    label: 'Level 2.3',
    description: 'Advanced — alpha-beta minimax, depth 3.',
    config: { level: 2, depth: 3 },
  },
  {
    id: '2.4',
    label: 'Level 2.4',
    description: 'Advanced — alpha-beta minimax, depth 4.',
    config: { level: 2, depth: 4 },
  },
  {
    id: '2.5',
    label: 'Level 2.5',
    description: 'Advanced — alpha-beta minimax, depth 5 (slower).',
    config: { level: 2, depth: 5 },
  },
  {
    id: '3.2',
    label: 'Level 3.2',
    description: 'Expert — depth 2 + ladder extension on forcing moves.',
    config: { level: 3, depth: 2 },
  },
  {
    id: '3.3',
    label: 'Level 3.3',
    description: 'Expert — depth 3 + ladder extension.',
    config: { level: 3, depth: 3 },
  },
  {
    id: '3.4',
    label: 'Level 3.4',
    description: 'Expert — depth 4 + ladder extension (slower).',
    config: { level: 3, depth: 4 },
  },
  {
    id: '3.5',
    label: 'Level 3.5',
    description: 'Expert — depth 5 + ladder extension (slowest, strongest).',
    config: { level: 3, depth: 5 },
  },
];

export const DEFAULT_PRESET_ID = '0';
export const PUZZLE_REFUTER_PRESET_ID = '3.3';

export const findPreset = (id: string): BotPreset =>
  BOT_PRESETS.find((p) => p.id === id) ?? BOT_PRESETS[0]!;

const allEmpty = (board: Board): Point[] => {
  const out: Point[] = [];
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      if (board.cells[y * board.size + x] === null) out.push({ x, y });
    }
  }
  return out;
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

const newLibCount = (state: GameState, point: Point, color: Color): number => {
  const r = tryPlace(state, point, color);
  if (!r.ok) return -1;
  const grp = groupAt(r.result.board, point);
  return grp ? grp.liberties.length : 0;
};

const anyGroupInAtari = (board: Board, color: Color): boolean => {
  for (const rep of distinctGroups(board, color)) {
    const grp = groupAt(board, rep);
    if (grp && grp.liberties.length === 1) return true;
  }
  return false;
};

// ---------------------------------------------------------------------------
// Level 0: greedy cascade.
// ---------------------------------------------------------------------------
const chooseGreedy = (state: GameState, color: Color): Point | null => {
  const board = state.board;
  const opp = opposite(color);

  for (const rep of distinctGroups(board, opp)) {
    const grp = groupAt(board, rep);
    if (grp && grp.liberties.length === 1) {
      const lib = grp.liberties[0]!;
      const r = tryPlace(state, lib, color);
      if (r.ok && r.result.captured.length > 0) return lib;
    }
  }

  let defendBest: { p: Point; libs: number } | null = null;
  for (const rep of distinctGroups(board, color)) {
    const grp = groupAt(board, rep);
    if (!grp || grp.liberties.length !== 1) continue;
    const escape = grp.liberties[0]!;
    const libs = newLibCount(state, escape, color);
    if (libs > 1 && (!defendBest || libs > defendBest.libs)) {
      defendBest = { p: escape, libs };
    }
  }
  if (defendBest) return defendBest.p;

  for (const rep of distinctGroups(board, opp)) {
    const grp = groupAt(board, rep);
    if (!grp || grp.liberties.length !== 2) continue;
    for (const lib of grp.liberties) {
      const r = tryPlace(state, lib, color);
      if (!r.ok) continue;
      const placed = groupAt(r.result.board, lib);
      if (placed && placed.liberties.length >= 2) return lib;
    }
  }

  let target: Point | null = null;
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      if (board.cells[y * board.size + x] === opp) target = { x, y };
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

  let fallback: { p: Point; score: number } | null = null;
  const c = (board.size - 1) / 2;
  for (const e of allEmpty(board)) {
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

// ---------------------------------------------------------------------------
// Level 1: greedy + reject moves that walk into immediate capture.
// ---------------------------------------------------------------------------
const opponentCanCaptureAfter = (
  state: GameState,
  move: Point,
  color: Color,
): boolean => {
  const r = applyMove(state, move);
  if (!r) return true;
  const opp = opposite(color);
  for (const oppMove of legalMoves(r.state, opp)) {
    const r2 = tryPlace(r.state, oppMove, opp);
    if (!r2.ok) continue;
    if (r2.result.captured.length > 0) return true;
  }
  return false;
};

const chooseSafeGreedy = (state: GameState, color: Color): Point | null => {
  const greedy = chooseGreedy(state, color);
  if (greedy && !opponentCanCaptureAfter(state, greedy, color)) return greedy;

  let bestSafe: { p: Point; libs: number } | null = null;
  let bestUnsafe: { p: Point; libs: number } | null = null;
  for (const m of legalMoves(state, color)) {
    const r = tryPlace(state, m, color);
    if (!r.ok) continue;
    const placed = groupAt(r.result.board, m);
    const libs = placed ? placed.liberties.length : 0;
    if (libs < 2) continue;
    const safe = !opponentCanCaptureAfter(state, m, color);
    if (safe) {
      if (!bestSafe || libs > bestSafe.libs) bestSafe = { p: m, libs };
    } else {
      if (!bestUnsafe || libs > bestUnsafe.libs) bestUnsafe = { p: m, libs };
    }
  }
  if (bestSafe) return bestSafe.p;
  if (bestUnsafe) return bestUnsafe.p;
  return greedy;
};

// ---------------------------------------------------------------------------
// Level 2 / 3: alpha-beta minimax.
// ---------------------------------------------------------------------------
const evaluate = (board: Board, color: Color): number => {
  const opp = opposite(color);
  let ownLibs = 0;
  let oppLibs = 0;
  let ownAtariStones = 0;
  let oppAtariStones = 0;
  const seen = new Set<string>();
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      const cell = board.cells[y * board.size + x];
      if (!cell) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      const grp = groupAt(board, { x, y });
      if (!grp) continue;
      for (const s of grp.stones) seen.add(`${s.x},${s.y}`);
      if (cell === color) {
        ownLibs += grp.liberties.length;
        if (grp.liberties.length === 1) ownAtariStones += grp.stones.length;
      } else {
        oppLibs += grp.liberties.length;
        if (grp.liberties.length === 1) oppAtariStones += grp.stones.length;
      }
    }
    void opp;
  }
  return ownLibs - oppLibs - ownAtariStones * 25 + oppAtariStones * 25;
};

const orderMoves = (state: GameState, color: Color): Point[] => {
  const scored: { m: Point; score: number }[] = [];
  for (const m of legalMoves(state, color)) {
    const r = tryPlace(state, m, color);
    if (!r.ok) continue;
    let score = 0;
    if (r.result.captured.length > 0) score += 10000 + r.result.captured.length;
    const placed = groupAt(r.result.board, m);
    score += placed ? placed.liberties.length : 0;
    for (const n of neighbors(r.result.board, m)) {
      if (r.result.board.cells[n.y * r.result.board.size + n.x] === opposite(color)) {
        const oppGrp = groupAt(r.result.board, n);
        if (oppGrp && oppGrp.liberties.length === 1) score += 50;
      }
    }
    scored.push({ m, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.m);
};

const TERMINAL = 100000;
const MAX_PLIES = 60;

// Alpha-beta minimax. If `extendLadders` is true, a move that leaves the next
// player to move in atari (i.e., a forcing move) does not consume search depth,
// capped by an absolute recursion limit.
const search = (
  state: GameState,
  rootColor: Color,
  depth: number,
  alpha: number,
  beta: number,
  extendLadders: boolean,
  plies: number,
): number => {
  const isMax = state.toPlay === rootColor;
  if (plies >= MAX_PLIES) return evaluate(state.board, rootColor);
  if (depth <= 0) return evaluate(state.board, rootColor);

  const moves = orderMoves(state, state.toPlay);
  if (moves.length === 0) return evaluate(state.board, rootColor);

  let best = isMax ? -Infinity : Infinity;
  for (const m of moves) {
    const r = applyMove(state, m);
    if (!r) continue;

    let score: number;
    if (r.captured.length > 0) {
      const moverIsRoot = state.toPlay === rootColor;
      score = moverIsRoot ? TERMINAL - plies : -TERMINAL + plies;
    } else {
      let nextDepth = depth - 1;
      if (extendLadders && anyGroupInAtari(r.state.board, r.state.toPlay)) {
        // Move puts opponent in atari; their reply is forced or they lose.
        // Don't decrement depth on this branch.
        nextDepth = depth;
      }
      score = search(r.state, rootColor, nextDepth, alpha, beta, extendLadders, plies + 1);
    }

    if (isMax) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
};

const chooseMinimax = (
  state: GameState,
  color: Color,
  depth: number,
  extendLadders: boolean,
): Point | null => {
  for (const m of orderMoves(state, color)) {
    const r = tryPlace(state, m, color);
    if (r.ok && r.result.captured.length > 0) return m;
  }

  let bestScore = -Infinity;
  let bestMove: Point | null = null;
  let alpha = -Infinity;
  const beta = Infinity;
  for (const m of orderMoves(state, color)) {
    const r = applyMove(state, m);
    if (!r) continue;
    let score: number;
    if (r.captured.length > 0) {
      score = TERMINAL - 1;
    } else {
      let nextDepth = depth - 1;
      if (extendLadders && anyGroupInAtari(r.state.board, r.state.toPlay)) {
        nextDepth = depth;
      }
      score = search(r.state, color, nextDepth, alpha, beta, extendLadders, 1);
    }
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  return bestMove;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const chooseBotMove = (
  state: GameState,
  color: Color,
  config: BotConfig = { level: 0 },
): Point | null => {
  switch (config.level) {
    case 0:
      return chooseGreedy(state, color);
    case 1:
      return chooseSafeGreedy(state, color);
    case 2:
      return chooseMinimax(state, color, config.depth, false);
    case 3:
      return chooseMinimax(state, color, config.depth, true);
  }
};

export const playBot = (
  state: GameState,
  config: BotConfig = { level: 0 },
): { state: GameState; move: Point } | null => {
  const move = chooseBotMove(state, state.toPlay, config);
  if (!move) return null;
  const r = applyMove(state, move);
  if (!r) return null;
  return { state: r.state, move };
};
