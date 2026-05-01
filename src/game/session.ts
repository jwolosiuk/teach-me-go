import { createBoard } from '../engine/board';
import { applyMove, initialState, type GameState } from '../engine/rules';
import type { Color, Point } from '../engine/types';
import { playBot } from './bot';

export type GameStatus =
  | { kind: 'in-progress' }
  | { kind: 'won'; winner: Color; capturedAt: Point };

export type GameSession = {
  state: GameState;
  status: GameStatus;
  human: Color;
  bot: Color;
  lastMove: Point | null;
  reset: () => void;
  playHuman: (p: Point) => { ok: false } | { ok: true; humanMove: Point; botMove: Point | null };
};

export const createGameSession = (size: number, human: Color): GameSession => {
  let state: GameState;
  let status: GameStatus;
  let lastMove: Point | null;

  const reset = () => {
    state = initialState(createBoard(size), 'B');
    status = { kind: 'in-progress' };
    lastMove = null;
    if (human === 'W') {
      const r = playBot(state);
      if (r) {
        state = r.state;
        lastMove = r.move;
      }
    }
  };

  const session: GameSession = {
    get state() {
      return state;
    },
    get status() {
      return status;
    },
    human,
    bot: human === 'B' ? 'W' : 'B',
    get lastMove() {
      return lastMove;
    },
    reset() {
      reset();
    },
    playHuman(p) {
      if (status.kind !== 'in-progress') return { ok: false };
      if (state.toPlay !== human) return { ok: false };
      const r = applyMove(state, p);
      if (!r) return { ok: false };
      state = r.state;
      lastMove = p;
      if (r.captured.length > 0) {
        status = { kind: 'won', winner: human, capturedAt: p };
        return { ok: true, humanMove: p, botMove: null };
      }
      const bot = playBot(state);
      if (!bot) return { ok: true, humanMove: p, botMove: null };
      const botCaptured = (() => {
        const before = state.board.cells.filter((c) => c === human).length;
        state = bot.state;
        lastMove = bot.move;
        const after = state.board.cells.filter((c) => c === human).length;
        return before > after;
      })();
      if (botCaptured) {
        status = { kind: 'won', winner: session.bot, capturedAt: bot.move };
      }
      return { ok: true, humanMove: p, botMove: bot.move };
    },
  };
  reset();
  return session;
};
