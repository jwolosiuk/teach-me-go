import { createBoard } from '../engine/board';
import { applyMove, initialState, type GameState } from '../engine/rules';
import type { Color, Point } from '../engine/types';
import { playBot, type BotConfig } from './bot';

export type GameStatus =
  | { kind: 'in-progress' }
  | { kind: 'won'; winner: Color; capturedAt: Point };

export type HumanResult =
  | { ok: false }
  | { ok: true; humanMove: Point; captured: boolean };

export type BotResult = { move: Point; captured: boolean } | null;

type Snapshot = { state: GameState; lastMove: Point | null; status: GameStatus };

export type GameSession = {
  state: GameState;
  status: GameStatus;
  human: Color;
  bot: Color;
  lastMove: Point | null;
  isBotTurn: () => boolean;
  canUndo: () => boolean;
  reset: () => void;
  playHuman: (p: Point) => HumanResult;
  playBotMove: () => BotResult;
  undo: () => boolean;
};

export const createGameSession = (
  size: number,
  human: Color,
  botConfig: BotConfig = { level: 0 },
): GameSession => {
  let state: GameState;
  let status: GameStatus;
  let lastMove: Point | null;
  let history: Snapshot[] = [];

  const snapshot = (): Snapshot => ({ state, lastMove, status });

  const reset = () => {
    state = initialState(createBoard(size), 'B');
    status = { kind: 'in-progress' };
    lastMove = null;
    history = [];
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
    isBotTurn() {
      return status.kind === 'in-progress' && state.toPlay !== human;
    },
    canUndo() {
      return history.length > 0;
    },
    reset() {
      reset();
    },
    playHuman(p) {
      if (status.kind !== 'in-progress') return { ok: false };
      if (state.toPlay !== human) return { ok: false };
      const r = applyMove(state, p);
      if (!r) return { ok: false };
      history.push(snapshot());
      state = r.state;
      lastMove = p;
      const captured = r.captured.length > 0;
      if (captured) status = { kind: 'won', winner: human, capturedAt: p };
      return { ok: true, humanMove: p, captured };
    },
    playBotMove() {
      if (status.kind !== 'in-progress') return null;
      if (state.toPlay === human) return null;
      const r = playBot(state, botConfig);
      if (!r) return null;
      const opp = human;
      const before = state.board.cells.filter((c) => c === opp).length;
      history.push(snapshot());
      state = r.state;
      lastMove = r.move;
      const after = state.board.cells.filter((c) => c === opp).length;
      const captured = before > after;
      if (captured) status = { kind: 'won', winner: session.bot, capturedAt: r.move };
      return { move: r.move, captured };
    },
    undo() {
      if (history.length === 0) return false;
      // Pop one or more plies until we're back at the human's turn.
      while (history.length > 0) {
        const prev = history.pop()!;
        state = prev.state;
        lastMove = prev.lastMove;
        status = prev.status;
        if (state.toPlay === human && status.kind === 'in-progress') return true;
      }
      return true;
    },
  };
  reset();
  return session;
};
