import { groupAt, neighbors, type Board } from '../engine/board';
import { applyMove, legalMoves, tryPlace, type GameState } from '../engine/rules';
import { opposite, type Color, type Point } from '../engine/types';

export type BotLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type BotConfig =
  | { level: 0 }
  | { level: 1 }
  | { level: 2; depth: number }
  | { level: 3; depth: number }
  | { level: 4; depth: number }
  | { level: 5; depth: number };

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
  {
    id: '4.4',
    label: 'Level 4.4',
    description: 'Pro — iterative deepening to depth 4 + move pruning + ladder ext.',
    config: { level: 4, depth: 4 },
  },
  {
    id: '4.5',
    label: 'Level 4.5',
    description: 'Pro — iterative deepening to depth 5 + move pruning + ladder ext.',
    config: { level: 4, depth: 5 },
  },
  {
    id: '4.6',
    label: 'Level 4.6',
    description: 'Pro — iterative deepening to depth 6 + move pruning + ladder ext.',
    config: { level: 4, depth: 6 },
  },
  {
    id: '5.4',
    label: 'Level 5.4',
    description: 'Master — Level 4 features + quiescence search + transposition table.',
    config: { level: 5, depth: 4 },
  },
  {
    id: '5.5',
    label: 'Level 5.5',
    description: 'Master — depth 5 + quiescence + TT.',
    config: { level: 5, depth: 5 },
  },
  {
    id: '5.6',
    label: 'Level 5.6',
    description: 'Master — depth 6 + quiescence + TT (slowest).',
    config: { level: 5, depth: 6 },
  },
];

export const DEFAULT_PRESET_ID = '0';
export const PUZZLE_REFUTER_PRESET_ID = '5.5';
export const DEFAULT_TIME_MS = 1500;
export const TIME_MIN_MS = 200;
export const TIME_MAX_MS = 30000;

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
// Level 2 / 3: alpha-beta minimax with iterative deepening.
// ---------------------------------------------------------------------------

// Group "criticality" rises sharply as liberties drop.
const groupWeight = (libs: number, stones: number): number => {
  if (libs <= 0) return 0;
  if (libs === 1) return 100 * stones;
  if (libs === 2) return 15 * stones;
  if (libs === 3) return 5 * stones;
  return stones;
};

const evaluate = (board: Board, color: Color): number => {
  let ownScore = 0;
  let oppScore = 0;
  let ownLibs = 0;
  let oppLibs = 0;
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
      const w = groupWeight(grp.liberties.length, grp.stones.length);
      if (cell === color) {
        ownScore += w;
        ownLibs += grp.liberties.length;
      } else {
        oppScore += w;
        oppLibs += grp.liberties.length;
      }
    }
  }
  // Critical groups are weighted heavily; total liberties act as a tie-breaker.
  // We *subtract* ownScore (own atari = bad) and *add* oppScore (opp atari = good).
  return oppScore - ownScore + (ownLibs - oppLibs);
};

// Mark cells within Manhattan distance `maxDist` of any stone.
const nearStoneMask = (board: Board, maxDist: number): Uint8Array => {
  const size = board.size;
  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board.cells[y * size + x] === null) continue;
      const yMin = Math.max(0, y - maxDist);
      const yMax = Math.min(size - 1, y + maxDist);
      const xMin = Math.max(0, x - maxDist);
      const xMax = Math.min(size - 1, x + maxDist);
      for (let yy = yMin; yy <= yMax; yy++) {
        for (let xx = xMin; xx <= xMax; xx++) {
          if (Math.abs(xx - x) + Math.abs(yy - y) <= maxDist) {
            mask[yy * size + xx] = 1;
          }
        }
      }
    }
  }
  return mask;
};

const PRUNE_FALLBACK_THRESHOLD = 4;

const orderMoves = (state: GameState, color: Color, prune: boolean): Point[] => {
  const all = legalMoves(state, color);
  let candidates = all;
  if (prune) {
    const mask = nearStoneMask(state.board, 2);
    const filtered = all.filter((m) => mask[m.y * state.board.size + m.x] === 1);
    if (filtered.length >= PRUNE_FALLBACK_THRESHOLD) candidates = filtered;
  }
  const scored: { m: Point; score: number }[] = [];
  for (const m of candidates) {
    const r = tryPlace(state, m, color);
    if (!r.ok) continue;
    let score = 0;
    if (r.result.captured.length > 0) score += 10000 + r.result.captured.length;
    const placed = groupAt(r.result.board, m);
    score += placed ? placed.liberties.length : 0;
    for (const n of neighbors(r.result.board, m)) {
      if (r.result.board.cells[n.y * r.result.board.size + n.x] === opposite(color)) {
        const oppGrp = groupAt(r.result.board, n);
        if (oppGrp && oppGrp.liberties.length === 1) score += 200;
        else if (oppGrp && oppGrp.liberties.length === 2) score += 30;
      }
    }
    scored.push({ m, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.m);
};

const TERMINAL = 100000;
const MAX_PLIES = 40;
const MAX_NODES = 200000;
const MAX_EXTENSIONS_PER_BRANCH = 6;
const QUIESCE_MAX_PLIES = 8;
const TT_MAX = 80000;

// ---------------------------------------------------------------------------
// Transposition table — keyed by (board cells, side-to-play). Reset before
// each top-level bot call so it can't grow unbounded across games.
// ---------------------------------------------------------------------------
type TTBound = 'exact' | 'lower' | 'upper';
type TTEntry = { depth: number; score: number; bound: TTBound };

const tt = new Map<string, TTEntry>();
const ttClear = () => tt.clear();
const ttKey = (state: GameState): string => {
  let s = '';
  for (let i = 0; i < state.board.cells.length; i++) {
    const c = state.board.cells[i];
    s += c === null ? '.' : c;
  }
  return s + state.toPlay;
};
const ttGet = (key: string): TTEntry | undefined => tt.get(key);
const ttPut = (key: string, entry: TTEntry): void => {
  if (tt.size >= TT_MAX) tt.clear();
  tt.set(key, entry);
};

// ---------------------------------------------------------------------------
// Quiescence search — at search leaves we keep recursing on forcing moves
// (captures, atari-creating, save-from-atari) until the position quiets.
// ---------------------------------------------------------------------------
const quiesce = (
  state: GameState,
  rootColor: Color,
  alpha: number,
  beta: number,
  qPlies: number,
  ctx: SearchCtx,
): number => {
  ctx.nodes += 1;
  if (ctx.aborted) return evaluate(state.board, rootColor);
  if (ctx.nodes > MAX_NODES || ((ctx.nodes & 0xff) === 0 && performance.now() > ctx.deadline)) {
    ctx.aborted = true;
    return evaluate(state.board, rootColor);
  }
  if (qPlies >= QUIESCE_MAX_PLIES) return evaluate(state.board, rootColor);

  const isMax = state.toPlay === rootColor;
  const standPat = evaluate(state.board, rootColor);
  if (isMax) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  // Build forcing-only move list: captures + atari-creating + (forced) save.
  const opp = opposite(state.toPlay);
  const forcing: { m: Point; score: number; capture: boolean }[] = [];
  // 1. Captures and atari-creating.
  for (const m of legalMoves(state, state.toPlay)) {
    const r = tryPlace(state, m, state.toPlay);
    if (!r.ok) continue;
    if (r.result.captured.length > 0) {
      const moverIsRoot = state.toPlay === rootColor;
      return moverIsRoot ? TERMINAL - qPlies : -TERMINAL + qPlies;
    }
    let creates = false;
    for (const n of neighbors(r.result.board, m)) {
      if (r.result.board.cells[n.y * r.result.board.size + n.x] !== opp) continue;
      const oppGrp = groupAt(r.result.board, n);
      if (oppGrp && oppGrp.liberties.length === 1) { creates = true; break; }
    }
    if (creates) forcing.push({ m, score: 100, capture: false });
  }
  // 2. Side-to-play has its own group in atari → must include saving moves.
  for (const rep of distinctGroups(state.board, state.toPlay)) {
    const grp = groupAt(state.board, rep);
    if (!grp || grp.liberties.length !== 1) continue;
    const escape = grp.liberties[0]!;
    if (forcing.some((f) => f.m.x === escape.x && f.m.y === escape.y)) continue;
    const r = tryPlace(state, escape, state.toPlay);
    if (!r.ok) continue;
    const placed = groupAt(r.result.board, escape);
    if (placed && placed.liberties.length >= 2) forcing.push({ m: escape, score: 80, capture: false });
  }

  if (forcing.length === 0) return isMax ? alpha : beta;
  forcing.sort((a, b) => b.score - a.score);

  for (const { m } of forcing) {
    const r = applyMove(state, m);
    if (!r) continue;
    let score: number;
    if (r.captured.length > 0) {
      const moverIsRoot = state.toPlay === rootColor;
      score = moverIsRoot ? TERMINAL - qPlies : -TERMINAL + qPlies;
    } else {
      score = quiesce(r.state, rootColor, alpha, beta, qPlies + 1, ctx);
    }
    if (isMax) {
      if (score > alpha) alpha = score;
    } else {
      if (score < beta) beta = score;
    }
    if (alpha >= beta) break;
    if (ctx.aborted) break;
  }
  return isMax ? alpha : beta;
};

// True iff `move` was just played by `mover` and turned a previously-non-atari
// adjacent opp group into atari. (Stale ataris elsewhere on the board don't
// count — those would otherwise re-trigger ladder extension forever.)
const moveCreatesNewAtari = (
  before: Board,
  after: Board,
  move: Point,
  mover: Color,
): boolean => {
  const opp = opposite(mover);
  for (const n of neighbors(after, move)) {
    if (after.cells[n.y * after.size + n.x] !== opp) continue;
    const grpAfter = groupAt(after, n);
    if (!grpAfter || grpAfter.liberties.length !== 1) continue;
    // Find any stone of this group that already existed before the move and
    // ask whether the group it belonged to had ≥2 liberties then.
    let preLibs = -1;
    for (const s of grpAfter.stones) {
      if (before.cells[s.y * before.size + s.x] === opp) {
        const grpBefore = groupAt(before, s);
        if (grpBefore) {
          preLibs = grpBefore.liberties.length;
          break;
        }
      }
    }
    if (preLibs >= 2) return true;
  }
  return false;
};

type SearchCtx = {
  nodes: number;
  aborted: boolean;
  deadline: number;
  prune: boolean;
  useTT: boolean;
  useQuiescence: boolean;
};

// Alpha-beta minimax. If `extendLadders` is true, a move that just creates a
// fresh atari on an adjacent opp group does not consume search depth, capped
// by `extensionsLeft` per branch.
const search = (
  state: GameState,
  rootColor: Color,
  depth: number,
  alpha: number,
  beta: number,
  extendLadders: boolean,
  plies: number,
  extensionsLeft: number,
  ctx: SearchCtx,
): number => {
  ctx.nodes += 1;
  if (ctx.aborted) return evaluate(state.board, rootColor);
  if (ctx.nodes > MAX_NODES || ((ctx.nodes & 0xff) === 0 && performance.now() > ctx.deadline)) {
    ctx.aborted = true;
    return evaluate(state.board, rootColor);
  }
  const isMax = state.toPlay === rootColor;
  if (plies >= MAX_PLIES) return evaluate(state.board, rootColor);
  if (depth <= 0) {
    if (ctx.useQuiescence) return quiesce(state, rootColor, alpha, beta, 0, ctx);
    return evaluate(state.board, rootColor);
  }

  const alphaOrig = alpha;
  const betaOrig = beta;
  let key = '';
  if (ctx.useTT) {
    key = ttKey(state);
    const cached = ttGet(key);
    if (cached && cached.depth >= depth) {
      if (cached.bound === 'exact') return cached.score;
      if (cached.bound === 'lower' && cached.score > alpha) alpha = cached.score;
      else if (cached.bound === 'upper' && cached.score < beta) beta = cached.score;
      if (alpha >= beta) return cached.score;
    }
  }

  const moves = orderMoves(state, state.toPlay, ctx.prune);
  if (moves.length === 0) return evaluate(state.board, rootColor);

  let best = isMax ? -Infinity : Infinity;
  const before = state.board;
  const mover = state.toPlay;
  for (const m of moves) {
    const r = applyMove(state, m);
    if (!r) continue;

    let score: number;
    if (r.captured.length > 0) {
      const moverIsRoot = mover === rootColor;
      score = moverIsRoot ? TERMINAL - plies : -TERMINAL + plies;
    } else {
      let nextDepth = depth - 1;
      let nextExtensions = extensionsLeft;
      if (
        extendLadders &&
        nextExtensions > 0 &&
        moveCreatesNewAtari(before, r.state.board, m, mover)
      ) {
        nextDepth = depth;
        nextExtensions -= 1;
      }
      score = search(
        r.state,
        rootColor,
        nextDepth,
        alpha,
        beta,
        extendLadders,
        plies + 1,
        nextExtensions,
        ctx,
      );
    }

    if (isMax) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
    if (ctx.aborted) break;
  }
  if (ctx.useTT && key && !ctx.aborted) {
    let bound: TTBound;
    if (best <= alphaOrig) bound = 'upper';
    else if (best >= betaOrig) bound = 'lower';
    else bound = 'exact';
    ttPut(key, { depth, score: best, bound });
  }
  return best;
};

// One root pass at a fixed depth, returning the best move + score from that
// pass and whether the pass completed (didn't abort mid-iteration).
const rootSearch = (
  state: GameState,
  color: Color,
  depth: number,
  extendLadders: boolean,
  preferredFirst: Point | null,
  ctx: SearchCtx,
): { move: Point | null; score: number; complete: boolean } => {
  const ordered = orderMoves(state, color, ctx.prune);
  const movesAtRoot = preferredFirst
    ? [
        preferredFirst,
        ...ordered.filter(
          (m) => !(m.x === preferredFirst.x && m.y === preferredFirst.y),
        ),
      ]
    : ordered;

  let bestScore = -Infinity;
  let bestMove: Point | null = null;
  let alpha = -Infinity;
  const beta = Infinity;
  const before = state.board;
  const mover = color;

  for (const m of movesAtRoot) {
    const r = applyMove(state, m);
    if (!r) continue;
    let score: number;
    if (r.captured.length > 0) {
      score = TERMINAL - 1;
    } else {
      let nextDepth = depth - 1;
      let nextExtensions = MAX_EXTENSIONS_PER_BRANCH;
      if (extendLadders && moveCreatesNewAtari(before, r.state.board, m, mover)) {
        nextDepth = depth;
        nextExtensions -= 1;
      }
      score = search(
        r.state,
        color,
        nextDepth,
        alpha,
        beta,
        extendLadders,
        1,
        nextExtensions,
        ctx,
      );
    }
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (bestScore > alpha) alpha = bestScore;
    if (ctx.aborted) {
      return { move: bestMove, score: bestScore, complete: false };
    }
  }
  return { move: bestMove, score: bestScore, complete: true };
};

const chooseMinimax = (
  state: GameState,
  color: Color,
  depth: number,
  extendLadders: boolean,
  prune: boolean,
  iterative: boolean,
  timeMs: number,
  useTT: boolean = false,
  useQuiescence: boolean = false,
): Point | null => {
  for (const m of orderMoves(state, color, prune)) {
    const r = tryPlace(state, m, color);
    if (r.ok && r.result.captured.length > 0) return m;
  }

  if (useTT) ttClear();

  const ctx: SearchCtx = {
    nodes: 0,
    aborted: false,
    deadline: performance.now() + timeMs,
    prune,
    useTT,
    useQuiescence,
  };

  if (!iterative) {
    return rootSearch(state, color, depth, extendLadders, null, ctx).move;
  }

  let bestMove: Point | null = null;
  for (let d = 2; d <= depth; d++) {
    const pass = rootSearch(state, color, d, extendLadders, bestMove, ctx);
    if (pass.move) {
      // Only commit completed iterations; partial iterations may be biased
      // by the cutoff, but they still beat returning nothing.
      if (pass.complete || bestMove === null) bestMove = pass.move;
    }
    if (ctx.aborted) break;
    if (pass.score >= TERMINAL - 100) break; // forced win, stop searching deeper
    if (performance.now() > ctx.deadline) break;
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
  timeMs: number = DEFAULT_TIME_MS,
): Point | null => {
  switch (config.level) {
    case 0:
      return chooseGreedy(state, color);
    case 1:
      return chooseSafeGreedy(state, color);
    case 2:
      return chooseMinimax(state, color, config.depth, false, false, false, timeMs);
    case 3:
      return chooseMinimax(state, color, config.depth, true, false, false, timeMs);
    case 4:
      return chooseMinimax(state, color, config.depth, true, true, true, timeMs);
    case 5:
      return chooseMinimax(state, color, config.depth, true, true, true, timeMs, true, true);
  }
};

export const playBot = (
  state: GameState,
  config: BotConfig = { level: 0 },
  timeMs: number = DEFAULT_TIME_MS,
): { state: GameState; move: Point } | null => {
  const move = chooseBotMove(state, state.toPlay, config, timeMs);
  if (!move) return null;
  const r = applyMove(state, move);
  if (!r) return null;
  return { state: r.state, move };
};
