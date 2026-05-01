import { groupAt } from '../engine/board';
import { applyMove, legalMoves, tryPlace, type GameState } from '../engine/rules';
import { opposite, type Color, type Point } from '../engine/types';

type Node = {
  state: GameState;
  parent: Node | null;
  move: Point | null;       // move that led to this node from parent
  visits: number;
  wins: number;             // wins from the perspective of `parent.state.toPlay`
  untried: Point[];
  children: Node[];
  terminal: boolean;
  winner: Color | null;     // if terminal, who captured (the mover that reached this node)
};

const PLAYOUT_MAX_PLIES = 80;
const UCT_C = Math.SQRT2;

const candidateMoves = (state: GameState): Point[] => {
  // Near-stone pruning + always-include forcing moves.
  const size = state.board.size;
  const stones = state.board.cells.reduce<number>((n, c) => n + (c !== null ? 1 : 0), 0);
  if (stones < 3) return legalMoves(state, state.toPlay);
  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (state.board.cells[y * size + x] === null) continue;
      const yMin = Math.max(0, y - 2);
      const yMax = Math.min(size - 1, y + 2);
      const xMin = Math.max(0, x - 2);
      const xMax = Math.min(size - 1, x + 2);
      for (let yy = yMin; yy <= yMax; yy++) {
        for (let xx = xMin; xx <= xMax; xx++) {
          if (Math.abs(xx - x) + Math.abs(yy - y) <= 2) {
            mask[yy * size + xx] = 1;
          }
        }
      }
    }
  }
  const all = legalMoves(state, state.toPlay);
  const filtered = all.filter((m) => mask[m.y * size + m.x] === 1);
  if (filtered.length >= 4) return filtered;
  return all;
};

const newNode = (
  state: GameState,
  parent: Node | null,
  move: Point | null,
  terminal: boolean,
  winner: Color | null,
): Node => ({
  state,
  parent,
  move,
  visits: 0,
  wins: 0,
  untried: terminal ? [] : candidateMoves(state),
  children: [],
  terminal,
  winner,
});

const uctSelect = (root: Node): Node => {
  let n = root;
  while (!n.terminal && n.untried.length === 0 && n.children.length > 0) {
    const lnP = Math.log(n.visits);
    let best: Node | null = null;
    let bestScore = -Infinity;
    for (const ch of n.children) {
      const exploit = ch.wins / ch.visits;
      const explore = UCT_C * Math.sqrt(lnP / ch.visits);
      const score = exploit + explore;
      if (score > bestScore) {
        bestScore = score;
        best = ch;
      }
    }
    if (!best) break;
    n = best;
  }
  return n;
};

const expand = (node: Node): Node => {
  // Pop a random untried move for variety.
  const idx = (Math.random() * node.untried.length) | 0;
  const move = node.untried[idx]!;
  node.untried[idx] = node.untried[node.untried.length - 1]!;
  node.untried.pop();
  const r = applyMove(node.state, move);
  if (!r) return node;
  const captured = r.captured.length > 0;
  const child = newNode(r.state, node, move, captured, captured ? node.state.toPlay : null);
  node.children.push(child);
  return child;
};

// Light playout policy: capture when available, then defend atari, otherwise
// pick a random move adjacent to existing stones (with safety filter).
const playoutMove = (state: GameState): Point | null => {
  const color = state.toPlay;
  const opp = opposite(color);
  const size = state.board.size;

  // 1. Capture any opp group in atari.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (state.board.cells[y * size + x] !== opp) continue;
      const grp = groupAt(state.board, { x, y });
      if (grp && grp.liberties.length === 1) {
        const lib = grp.liberties[0]!;
        const r = tryPlace(state, lib, color);
        if (r.ok && r.result.captured.length > 0) return lib;
      }
    }
  }
  // 2. Save own group in atari.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (state.board.cells[y * size + x] !== color) continue;
      const grp = groupAt(state.board, { x, y });
      if (!grp || grp.liberties.length !== 1) continue;
      const escape = grp.liberties[0]!;
      const r = tryPlace(state, escape, color);
      if (!r.ok) continue;
      const placed = groupAt(r.result.board, escape);
      if (placed && placed.liberties.length >= 2) return escape;
    }
  }
  // 3. Random near-stone move with ≥2 liberties after.
  const cands = candidateMoves(state);
  // Shuffle-ish: pick 8 random and play first that's safe.
  for (let i = 0; i < Math.min(8, cands.length); i++) {
    const idx = (Math.random() * cands.length) | 0;
    const m = cands[idx]!;
    const r = tryPlace(state, m, color);
    if (!r.ok) continue;
    const placed = groupAt(r.result.board, m);
    if (placed && placed.liberties.length >= 2) return m;
  }
  // Fallback: any legal safe move.
  for (const m of cands) {
    const r = tryPlace(state, m, color);
    if (!r.ok) continue;
    const placed = groupAt(r.result.board, m);
    if (placed && placed.liberties.length >= 2) return m;
  }
  return null;
};

const playOut = (start: GameState): Color | null => {
  let s = start;
  for (let i = 0; i < PLAYOUT_MAX_PLIES; i++) {
    const move = playoutMove(s);
    if (!move) return null;
    const r = applyMove(s, move);
    if (!r) return null;
    if (r.captured.length > 0) return s.toPlay; // mover wins
    s = r.state;
  }
  return null;
};

const backprop = (leaf: Node, winner: Color | null): void => {
  let n: Node | null = leaf;
  while (n) {
    n.visits += 1;
    if (winner === null) n.wins += 0.5;
    else if (n.parent && n.parent.state.toPlay === winner) n.wins += 1;
    n = n.parent;
  }
};

export type MctsResult = { move: Point | null; iterations: number };

export const runMcts = (
  state: GameState,
  _color: Color,
  timeMs: number,
  maxIterations: number = Infinity,
): MctsResult => {
  const root = newNode(state, null, null, false, null);
  if (root.untried.length === 0) return { move: null, iterations: 0 };
  const deadline = performance.now() + timeMs;
  let iterations = 0;
  while (iterations < maxIterations) {
    if ((iterations & 0xff) === 0 && performance.now() >= deadline) break;
    let leaf = uctSelect(root);
    if (!leaf.terminal && leaf.untried.length > 0) leaf = expand(leaf);
    const winner = leaf.terminal ? leaf.winner : playOut(leaf.state);
    backprop(leaf, winner);
    iterations += 1;
  }
  // Pick the most-visited child (more robust than max win rate).
  let best: Node | null = null;
  for (const ch of root.children) {
    if (!best || ch.visits > best.visits) best = ch;
  }
  return { move: best?.move ?? null, iterations };
};
