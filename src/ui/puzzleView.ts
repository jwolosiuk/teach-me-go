import { applyMove, type GameState } from '../engine/rules';
import type { Color, Point } from '../engine/types';
import {
  chooseBotMove,
  DEFAULT_TIME_MS,
  findPreset,
  PUZZLE_REFUTER_PRESET_ID,
} from '../game/bot';
import { allPuzzles } from '../puzzles/data/index';
import { generatePuzzles } from '../puzzles/generator/core';
import { startSession, type RunnerSession } from '../puzzles/runner';
import { CATEGORY_LABELS, CATEGORY_TIER, type Puzzle } from '../puzzles/types';
import { getBotTimeMs, isSolved, markSolved, solvedIds } from '../storage/progress';
import { addUserPuzzles, clearUserPuzzles, getUserPuzzles } from '../storage/userPuzzles';
import { createBoardView, type BoardMarker } from './boardView';

export const renderPuzzleList = (): HTMLElement => {
  const wrap = document.createElement('div');
  const heading = document.createElement('h2');
  heading.style.marginTop = '0';
  heading.textContent = 'Puzzles';
  wrap.appendChild(heading);

  // ── Generate panel ────────────────────────────────────────────────────────
  const gen = document.createElement('section');
  gen.className = 'panel';
  gen.style.marginBottom = '24px';
  const genHeading = document.createElement('h3');
  genHeading.textContent = 'Generate puzzles';
  genHeading.style.marginTop = '0';
  gen.appendChild(genHeading);
  const genHelp = document.createElement('p');
  genHelp.style.fontSize = '13px';
  genHelp.style.color = 'var(--muted)';
  genHelp.textContent =
    'Run self-play games and mine forced capture / save patterns. Difficulty controls the maximum number of forcing moves in a line.';
  gen.appendChild(genHelp);

  const formRow = document.createElement('div');
  formRow.style.display = 'flex';
  formRow.style.flexWrap = 'wrap';
  formRow.style.gap = '12px';
  formRow.style.alignItems = 'center';

  const countLabel = document.createElement('label');
  countLabel.style.fontSize = '14px';
  countLabel.textContent = 'Count: ';
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = '100';
  countInput.value = '10';
  countInput.style.width = '64px';
  countLabel.appendChild(countInput);

  const stepsLabel = document.createElement('label');
  stepsLabel.style.fontSize = '14px';
  stepsLabel.textContent = ' Max steps: ';
  const stepsSelect = document.createElement('select');
  for (const s of [1, 2, 3, 4, 5]) {
    const o = document.createElement('option');
    o.value = String(s);
    o.textContent = `${s}`;
    if (s === 3) o.selected = true;
    stepsSelect.appendChild(o);
  }
  stepsLabel.appendChild(stepsSelect);

  const generateBtn = document.createElement('button');
  generateBtn.textContent = 'Generate';

  const clearBtn = document.createElement('button');
  clearBtn.className = 'secondary';
  clearBtn.textContent = 'Clear generated';

  const genStatus = document.createElement('span');
  genStatus.className = 'meta';
  genStatus.style.fontSize = '13px';
  const userCount = getUserPuzzles().length;
  genStatus.textContent = userCount > 0 ? `${userCount} user-generated stored.` : '';

  formRow.appendChild(countLabel);
  formRow.appendChild(stepsLabel);
  formRow.appendChild(generateBtn);
  formRow.appendChild(clearBtn);
  formRow.appendChild(genStatus);
  gen.appendChild(formRow);
  wrap.appendChild(gen);

  // ── Puzzle list ───────────────────────────────────────────────────────────
  const listContainer = document.createElement('div');
  wrap.appendChild(listContainer);

  const renderList = () => {
    listContainer.innerHTML = '';
    const solved = solvedIds();
    const grouped: Record<1 | 2 | 3, Puzzle[]> = { 1: [], 2: [], 3: [] };
    for (const p of allPuzzles()) grouped[CATEGORY_TIER[p.category]].push(p);

    for (const tier of [1, 2, 3] as const) {
      if (grouped[tier].length === 0) continue;
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
        const stepCount = p.lines[0]?.steps.length ?? 1;
        const stepBadge = stepCount > 1 ? ` · ${stepCount}-step` : '';
        title.textContent = `${p.id}: ${CATEGORY_LABELS[p.category]}${stepBadge}`;
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
      listContainer.appendChild(sec);
    }
  };
  renderList();

  generateBtn.addEventListener('click', () => {
    const count = Math.max(1, Math.min(100, Number(countInput.value) | 0));
    const maxSteps = Math.max(1, Math.min(5, Number(stepsSelect.value) | 0));
    generateBtn.disabled = true;
    clearBtn.disabled = true;
    genStatus.textContent = 'Generating (this can take a few seconds)...';
    // Defer so the UI repaints first.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        try {
          const start = performance.now();
          const fresh = generatePuzzles({ count, maxSteps, size: 9 });
          addUserPuzzles(fresh);
          const elapsed = ((performance.now() - start) / 1000).toFixed(1);
          genStatus.textContent = `Added ${fresh.length} puzzles in ${elapsed}s. Total user puzzles: ${getUserPuzzles().length}.`;
          renderList();
        } catch (e) {
          genStatus.textContent = `Error: ${(e as Error).message}`;
        } finally {
          generateBtn.disabled = false;
          clearBtn.disabled = false;
        }
      }),
    );
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('Remove all user-generated puzzles? Built-in puzzles stay.')) return;
    clearUserPuzzles();
    genStatus.textContent = 'Cleared.';
    renderList();
  });

  return wrap;
};

const findNext = (id: string): Puzzle | null => {
  const list = allPuzzles();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1 || idx + 1 >= list.length) return null;
  return list[idx + 1] ?? null;
};

type Mode = 'solving' | 'free-play';

export const renderPuzzle = (puzzleId: string): HTMLElement => {
  const puzzle = allPuzzles().find((p) => p.id === puzzleId);
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
    const timeMs = getBotTimeMs(DEFAULT_TIME_MS);
    const move = chooseBotMove(state, state.toPlay, refuterConfig, timeMs);
    if (!move) return { state, move: null, capturedUser: false };
    const r = applyMove(state, move);
    if (!r) return { state, move: null, capturedUser: false };
    return { state: r.state, move, capturedUser: r.captured.length > 0 };
  };

  let botBusy = false;

  const afterPaint = (cb: () => void) => {
    requestAnimationFrame(() => requestAnimationFrame(cb));
  };

  const scheduleBotReply = () => {
    if (!freeState || frozen || botBusy) return;
    botBusy = true;
    afterPaint(() => {
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
    });
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
