import { describe, expect, it } from 'vitest';
import { createBoard, get, groupAt, set } from './board';
import { applyMove, inAtari, initialState, tryPlace } from './rules';

const placeMany = (size: number, b: [number, number][], w: [number, number][]) => {
  const board = createBoard(size);
  for (const [x, y] of b) set(board, { x, y }, 'B');
  for (const [x, y] of w) set(board, { x, y }, 'W');
  return board;
};

describe('liberties', () => {
  it('counts liberties for a single stone in the centre', () => {
    const board = placeMany(9, [[4, 4]], []);
    const grp = groupAt(board, { x: 4, y: 4 });
    expect(grp?.liberties.length).toBe(4);
  });

  it('counts liberties for a corner stone', () => {
    const board = placeMany(9, [[0, 0]], []);
    const grp = groupAt(board, { x: 0, y: 0 });
    expect(grp?.liberties.length).toBe(2);
  });

  it('shares liberties across a connected group', () => {
    const board = placeMany(9, [[2, 2], [3, 2], [2, 3]], []);
    const grp = groupAt(board, { x: 2, y: 2 });
    expect(grp?.stones.length).toBe(3);
    expect(grp?.liberties.length).toBe(7);
  });
});

describe('capture', () => {
  it('captures a single stone in atari', () => {
    const board = placeMany(9, [[1, 2], [3, 2], [2, 1]], [[2, 2]]);
    const state = initialState(board, 'B');
    const r = applyMove(state, { x: 2, y: 3 });
    expect(r).not.toBeNull();
    expect(r!.captured).toEqual([{ x: 2, y: 2 }]);
    expect(get(r!.state.board, { x: 2, y: 2 })).toBeNull();
  });

  it('captures a group of three corner stones', () => {
    const board = placeMany(9, [[2, 0], [0, 2]], [[0, 0], [1, 0], [0, 1]]);
    const state = initialState(board, 'B');
    const r = applyMove(state, { x: 1, y: 1 });
    expect(r).not.toBeNull();
    expect(r!.captured.length).toBe(3);
  });
});

describe('suicide', () => {
  it('rejects suicide into a full enclosure', () => {
    const board = placeMany(9, [[1, 0], [0, 1], [2, 1], [1, 2]], []);
    const state = initialState(board, 'W');
    const r = tryPlace(state, { x: 1, y: 1 }, 'W');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('suicide');
  });

  it('allows playing if the move captures the surrounding group', () => {
    // White stones in a corner with one liberty at (1,1); black plays (1,1)
    // — this is not suicide because the black move captures whites first.
    const board = placeMany(9, [[2, 0], [0, 2]], [[0, 0], [1, 0], [0, 1]]);
    const state = initialState(board, 'B');
    const r = tryPlace(state, { x: 1, y: 1 }, 'B');
    expect(r.ok).toBe(true);
  });
});

describe('atari', () => {
  it('detects atari', () => {
    const board = placeMany(9, [[1, 2], [3, 2], [2, 1]], [[2, 2]]);
    expect(inAtari(board, { x: 2, y: 2 })).toBe(true);
  });

  it('does not flag healthy groups as atari', () => {
    const board = placeMany(9, [], [[4, 4]]);
    expect(inAtari(board, { x: 4, y: 4 })).toBe(false);
  });
});

describe('ko', () => {
  it('rejects an immediate ko recapture', () => {
    // Build a simple ko shape:
    //  . W B .
    //  W . W B
    //  . W B .
    // Black just captured at (2,1) — recapture at the same point should be illegal.
    const board = createBoard(9);
    set(board, { x: 1, y: 0 }, 'W');
    set(board, { x: 2, y: 0 }, 'B');
    set(board, { x: 0, y: 1 }, 'W');
    set(board, { x: 2, y: 1 }, 'W');
    set(board, { x: 3, y: 1 }, 'B');
    set(board, { x: 1, y: 2 }, 'W');
    set(board, { x: 2, y: 2 }, 'B');
    // Black to play at (1,1) captures the W stone at (2,1).
    let state = initialState(board, 'B');
    const r1 = applyMove(state, { x: 1, y: 1 });
    expect(r1).not.toBeNull();
    state = r1!.state;
    // White cannot immediately recapture at (2,1) — that would restore the prior position.
    const r2 = tryPlace(state, { x: 2, y: 1 }, 'W');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toBe('ko');
  });
});
