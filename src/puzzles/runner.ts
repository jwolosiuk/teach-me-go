import { applyMove, initialState, type GameState } from '../engine/rules';
import type { Point } from '../engine/types';
import { parseSetup } from './parse';
import type { Puzzle, PuzzleLine } from './types';

export type RunnerOutcome =
  | { kind: 'wrong' }
  | { kind: 'progress'; state: GameState; lastUser: Point; botMove: Point | null }
  | { kind: 'solved'; state: GameState; lastUser: Point; botMove: Point | null };

export type RunnerSession = {
  puzzle: Puzzle;
  state: GameState;
  reset: () => void;
  play: (move: Point) => RunnerOutcome;
  remainingLines: () => PuzzleLine[];
};

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export const startSession = (puzzle: Puzzle): RunnerSession => {
  let state: GameState;
  let activeLines: PuzzleLine[];
  let stepIndex: number;

  const reset = () => {
    const board = parseSetup(puzzle.setup, puzzle.size);
    state = initialState(board, puzzle.toPlay);
    activeLines = puzzle.lines.map((l) => ({ steps: l.steps.slice() }));
    stepIndex = 0;
  };

  reset();

  const play = (move: Point): RunnerOutcome => {
    const matching = activeLines.filter((line) => {
      const step = line.steps[stepIndex];
      return step ? samePoint(step.user, move) : false;
    });
    if (matching.length === 0) return { kind: 'wrong' };

    const userResult = applyMove(state, move);
    if (!userResult) return { kind: 'wrong' };
    state = userResult.state;

    activeLines = matching;
    const step = matching[0]!.steps[stepIndex]!;
    let botMove: Point | null = null;
    if (step.bot) {
      const botResult = applyMove(state, step.bot);
      if (botResult) {
        state = botResult.state;
        botMove = step.bot;
      }
    }

    stepIndex += 1;

    const stillGoing = activeLines.some((line) => line.steps.length > stepIndex);
    if (!stillGoing) {
      return { kind: 'solved', state, lastUser: move, botMove };
    }
    return { kind: 'progress', state, lastUser: move, botMove };
  };

  return {
    puzzle,
    get state() {
      return state;
    },
    reset,
    play,
    remainingLines: () => activeLines,
  };
};
