import { applyMove, type GameState } from '../engine/rules';
import type { Color, Point } from '../engine/types';
import { chooseBotMove, findPreset, PUZZLE_REFUTER_PRESET_ID } from '../game/bot';
import { ALL_PUZZLES } from '../puzzles/data/index';
import { startSession, type RunnerSession } from '../puzzles/runner';
import { CATEGORY_LABELS, CATEGORY_TIER, type Puzzle } from '../puzzles/types';
import { isSolved, markSolved, solvedIds } from '../storage/progress';
import { createBoardView, type BoardMarker } from './boardView';

export const renderPuzzleList = (): HTMLElement => {
  const wrap = document.createElement('div');
  const heading = document.createElement('h2');
  heading.style.marginTop = '0';
  heading.textContent = 'Puzzles';
  wrap.appendChild(heading);

  const solved = solvedIds();
  const grouped: Record<1 | 2 | 3, Puzzle[]> = { 1: [], 2: [], 3: [] };
  for (const p of ALL_PUZZLES) grouped[CATEGORY_TIER[p.category]].push(p);

  for (const tier of [1, 2, 3] as const) {
    const sec = document.createElement('section');
    sec.className = 'tier-section';
    const h = document.createElement('h3');
    h.textContent = `Tier ${tier}`;
    sec.appendChild(h);
    const ul = document.createElement('ul');
    ul.className = 'puzzle-list';
    for (const p of grouped[tier]) {
      const li = document.createElement('li');
      li.addEventListener('click', () => {
        location.hash = `#/puzzles/${p.id}`;
      });
      const left = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = `${p.id}: ${CATEGORY_LABELS[p.category]}`;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = p.description ?? '';
      left.appendChild(title);
      left.appendChild(meta);
      const right = document.createElement('div');
      right.className = solved.has(p.id) ? 'solved' : 'meta';
      right.textContent = solved.has(p.id) ? '✓ solved' : 'unsolved';
      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    }
    sec.appendChild(ul);
    wrap.appendChild(sec);
  }
  return wrap;
};

const findNext = (id: string): Puzzle | null => {
  const idx = ALL_PUZZLES.findIndex((p) => p.id === id);
  if (idx === -1 || idx + 1 >= ALL_PUZZLES.length) return null;
  return ALL_PUZZLES[idx + 1] ?? null;
};

type Mode = 'solving' | 'free-play';

export const renderPuzzle = (puzzleId: string): HTMLElement => {
  const puzzle = ALL_PUZZLES.find((p) => p.id === puzzleId);
  const wrap = document.createElement('div');
  if (!puzzle) {
    wrap.textContent = `Puzzle "${puzzleId}" not found.`;
    return wrap;
  }

  const layout = document.createElement('div');
  layout.className = 'layout';

  const boardWrap = document.createElement('div');
  boardWrap.className = 'board-wrap';

  const panel = document.createElement('div');
  panel.className = 'panel';

  const heading = document.createElement('h2');
  heading.textContent = `${puzzle.id} · ${CATEGORY_LABELS[puzzle.category]}`;
  panel.appendChild(heading);

  const desc = document.createElement('p');
  desc.textContent = puzzle.description ?? '';
  panel.appendChild(desc);

  const turn = document.createElement('p');
  turn.textContent = `${puzzle.toPlay === 'B' ? 'Black' : 'White'} to play.`;
  turn.style.fontWeight = '600';
  turn.style.color = 'var(--text)';
  panel.appendChild(turn);

  const feedback = document.createElement('div');
  feedback.className = 'feedback info';
  feedback.textContent = 'Find the move.';
  panel.appendChild(feedback);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';

  const resetBtn = document.createElement('button');
  resetBtn.className = 'secondary';
  resetBtn.textContent = 'Reset';
  buttonRow.appendChild(resetBtn);

  const hintBtn = document.createElement('button');
  hintBtn.className = 'secondary';
  hintBtn.textContent = 'Hint';
  buttonRow.appendChild(hintBtn);

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next puzzle →';
  nextBtn.style.display = 'none';
  buttonRow.appendChild(nextBtn);

  panel.appendChild(buttonRow);

  let session: RunnerSession;
  let mode: Mode = 'solving';
  let freeState: GameState | null = null;
  let lastMarker: BoardMarker[] = [];
  let solved = false;
  let frozen = false;
  const userColor: Color = puzzle.toPlay;
  const refuterConfig = findPreset(PUZZLE_REFUTER_PRESET_ID).config;

  const setFeedback = (kind: 'good' | 'bad' | 'info', text: string) => {
    feedback.className = `feedback ${kind}`;
    feedback.textContent = text;
  };

  const playBotReply = (state: GameState): { state: GameState; move: Point | null; capturedUser: boolean } => {
    const move = chooseBotMove(state, state.toPlay, refuterConfig);
    if (!move) return { state, move: null, capturedUser: false };
    const r = applyMove(state, move);
    if (!r) return { state, move: null, capturedUser: false };
    return { state: r.state, move, capturedUser: r.captured.length > 0 };
  };

  let botBusy = false;

  const scheduleBotReply = () => {
    if (!freeState || frozen || botBusy) return;
    botBusy = true;
    setTimeout(() => {
      if (!freeState) {
        botBusy = false;
        return;
      }
      const reply = playBotReply(freeState);
      freeState = reply.state;
      if (reply.move) lastMarker.push({ kind: 'last-move', point: reply.move });
      view.render(freeState.board, lastMarker);
      if (reply.capturedUser) {
        setFeedback('bad', 'Bot captured your stones. Reset to retry the puzzle.');
        frozen = true;
      } else if (mode === 'free-play') {
        setFeedback(
          'bad',
          'Free play. Keep playing — or hit Reset to retry the puzzle.',
        );
      }
      botBusy = false;
    }, 0);
  };

  const enterFreePlay = (wrongMove: Point) => {
    const r = applyMove(session.state, wrongMove);
    if (!r) {
      setFeedback('bad', 'That move is illegal here. Try another point.');
      return;
    }
    mode = 'free-play';
    freeState = r.state;
    lastMarker = [{ kind: 'last-move', point: wrongMove }];

    if (r.captured.length > 0) {
      view.render(freeState.board, lastMarker);
      setFeedback(
        'good',
        'You captured — but this isn’t the puzzle’s solution line. Reset to retry.',
      );
      frozen = true;
      return;
    }

    view.render(freeState.board, lastMarker);
    setFeedback('bad', 'Not the solution. Bot (Level 2.3) is thinking...');
    scheduleBotReply();
  };

  const handleFreePlayClick = (p: Point) => {
    if (!freeState || frozen || botBusy) return;
    if (freeState.toPlay !== userColor) return;
    const r = applyMove(freeState, p);
    if (!r) return;
    freeState = r.state;
    lastMarker = [{ kind: 'last-move', point: p }];

    if (r.captured.length > 0) {
      view.render(freeState.board, lastMarker);
      setFeedback('good', 'You captured. Reset to try the original puzzle solution.');
      frozen = true;
      return;
    }

    view.render(freeState.board, lastMarker);
    setFeedback('info', 'Bot is thinking...');
    scheduleBotReply();
  };

  const view = createBoardView({
    onClick: (p) => {
      if (frozen || solved) return;
      if (mode === 'free-play') {
        handleFreePlayClick(p);
        return;
      }
      const out = session.play(p);
      if (out.kind === 'wrong') {
        enterFreePlay(p);
        return;
      }
      lastMarker = [{ kind: 'last-move', point: out.lastUser }];
      if (out.botMove) lastMarker.push({ kind: 'last-move', point: out.botMove });
      view.render(session.state.board, lastMarker);
      if (out.kind === 'solved') {
        solved = true;
        markSolved(puzzle.id);
        setFeedback('good', 'Solved!');
        nextBtn.style.display = findNext(puzzle.id) ? 'inline-block' : 'none';
      } else {
        setFeedback('info', 'Good. Keep going.');
      }
    },
    showCoordinates: true,
  });
  boardWrap.appendChild(view.element);

  const start = () => {
    solved = false;
    frozen = false;
    botBusy = false;
    mode = 'solving';
    freeState = null;
    session = startSession(puzzle);
    lastMarker = [];
    view.render(session.state.board, []);
    if (isSolved(puzzle.id)) {
      setFeedback('good', 'Already solved. Try again to refresh the pattern.');
    } else {
      setFeedback('info', 'Find the move.');
    }
    nextBtn.style.display = 'none';
  };
  start();

  resetBtn.addEventListener('click', start);
  hintBtn.addEventListener('click', () => {
    setFeedback('info', puzzle.hint ?? 'No hint available.');
  });
  nextBtn.addEventListener('click', () => {
    const n = findNext(puzzle.id);
    if (n) location.hash = `#/puzzles/${n.id}`;
  });

  layout.appendChild(boardWrap);
  layout.appendChild(panel);
  wrap.appendChild(layout);
  return wrap;
};
