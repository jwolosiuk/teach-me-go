import { applyMove, inAtari, initialState } from '../engine/rules';
import { groupAt } from '../engine/board';
import { parseSetup } from './parse';
import { ALL_PUZZLES } from './data/index';
import type { Puzzle } from './types';
import type { Point } from '../engine/types';

const fmt = (p: Point) => `(${p.x},${p.y})`;

const checkPuzzle = (puzzle: Puzzle): string[] => {
  const errors: string[] = [];
  let initialBoard;
  try {
    initialBoard = parseSetup(puzzle.setup, puzzle.size);
  } catch (e) {
    return [`[${puzzle.id}] setup parse failed: ${(e as Error).message}`];
  }

  if (puzzle.lines.length === 0) {
    errors.push(`[${puzzle.id}] no solution lines`);
    return errors;
  }

  for (let li = 0; li < puzzle.lines.length; li++) {
    const line = puzzle.lines[li]!;
    if (line.steps.length === 0) {
      errors.push(`[${puzzle.id}] line ${li} has no steps`);
      continue;
    }
    let state = initialState(initialBoard, puzzle.toPlay);
    let captureSeen = false;
    let lastUserMove: Point | null = null;

    let lineFailed = false;
    for (let si = 0; si < line.steps.length; si++) {
      const step = line.steps[si]!;
      const userResult = applyMove(state, step.user);
      if (!userResult) {
        errors.push(
          `[${puzzle.id}] line ${li} step ${si}: user move ${fmt(step.user)} illegal`,
        );
        lineFailed = true;
        break;
      }
      if (userResult.captured.length > 0) captureSeen = true;
      state = userResult.state;
      lastUserMove = step.user;

      if (step.bot) {
        const botResult = applyMove(state, step.bot);
        if (!botResult) {
          errors.push(
            `[${puzzle.id}] line ${li} step ${si}: bot move ${fmt(step.bot)} illegal`,
          );
          lineFailed = true;
          break;
        }
        if (botResult.captured.length > 0) {
          errors.push(
            `[${puzzle.id}] line ${li} step ${si}: bot captured user stones — puzzle line fails`,
          );
        }
        state = botResult.state;
      }
    }
    if (lineFailed) continue;

    const cat = puzzle.category;
    if (cat === 'capture-1' || cat === 'ladder' || cat === 'semeai-basic') {
      if (!captureSeen) {
        errors.push(
          `[${puzzle.id}] line ${li}: no capture observed (category ${cat} requires capture)`,
        );
      }
    } else if (cat === 'save-1') {
      if (lastUserMove) {
        const grp = groupAt(state.board, lastUserMove);
        if (!grp || grp.liberties.length < 2) {
          errors.push(
            `[${puzzle.id}] line ${li}: saved group has < 2 liberties at end`,
          );
        }
      }
    } else if (cat === 'atari-direction') {
      // Expect at least one opposing group to be in atari after the line.
      const opp = puzzle.toPlay === 'B' ? 'W' : 'B';
      let foundAtari = false;
      const visited = new Set<string>();
      for (let y = 0; y < state.board.size; y++) {
        for (let x = 0; x < state.board.size; x++) {
          const p = { x, y };
          const key = `${x},${y}`;
          if (visited.has(key)) continue;
          const cell = state.board.cells[y * state.board.size + x];
          if (cell !== opp) continue;
          const grp = groupAt(state.board, p);
          if (!grp) continue;
          for (const s of grp.stones) visited.add(`${s.x},${s.y}`);
          if (grp.liberties.length === 1) foundAtari = true;
        }
      }
      if (!foundAtari) {
        errors.push(
          `[${puzzle.id}] line ${li}: no opposing group in atari after the line`,
        );
      }
    } else if (cat === 'double-atari') {
      const opp = puzzle.toPlay === 'B' ? 'W' : 'B';
      let atariCount = 0;
      const visited = new Set<string>();
      for (let y = 0; y < state.board.size; y++) {
        for (let x = 0; x < state.board.size; x++) {
          const p = { x, y };
          const key = `${x},${y}`;
          if (visited.has(key)) continue;
          const cell = state.board.cells[y * state.board.size + x];
          if (cell !== opp) continue;
          const grp = groupAt(state.board, p);
          if (!grp) continue;
          for (const s of grp.stones) visited.add(`${s.x},${s.y}`);
          if (grp.liberties.length === 1) atariCount += 1;
        }
      }
      if (atariCount < 2) {
        errors.push(
          `[${puzzle.id}] line ${li}: expected ≥2 opposing groups in atari, got ${atariCount}`,
        );
      }
    } else if (cat === 'net') {
      // Best-effort: ensure the move was legal; deeper net verification is manual.
      void inAtari;
    }
  }
  return errors;
};

const main = () => {
  const allErrors: string[] = [];
  const ids = new Set<string>();
  for (const p of ALL_PUZZLES) {
    if (ids.has(p.id)) allErrors.push(`duplicate id: ${p.id}`);
    ids.add(p.id);
    allErrors.push(...checkPuzzle(p));
  }
  if (allErrors.length === 0) {
    console.log(`All ${ALL_PUZZLES.length} puzzles OK.`);
    process.exit(0);
  } else {
    console.error(`Found ${allErrors.length} issues:`);
    for (const e of allErrors) console.error('  ' + e);
    process.exit(1);
  }
};

main();
