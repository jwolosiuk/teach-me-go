import { describe, expect, it } from 'vitest';
import { createGameSession } from './session';

describe('Atari Go session', () => {
  it('starts with black to play when human is black', () => {
    const s = createGameSession(9, 'B');
    expect(s.state.toPlay).toBe('B');
    expect(s.status.kind).toBe('in-progress');
  });

  it('plays a bot reply automatically when human is white', () => {
    const s = createGameSession(9, 'W');
    // After construction the bot (black) should already have played.
    expect(s.lastMove).not.toBeNull();
    expect(s.state.toPlay).toBe('W');
  });

  it('reaches a result within a bounded number of plies', () => {
    const s = createGameSession(9, 'B');
    let plies = 0;
    while (s.status.kind === 'in-progress' && plies < 200) {
      // The "human" plays a deterministic legal move: scan for first empty.
      let played = false;
      for (let y = 0; y < 9 && !played; y++) {
        for (let x = 0; x < 9 && !played; x++) {
          if (s.state.board.cells[y * 9 + x] === null) {
            const r = s.playHuman({ x, y });
            if (r.ok) played = true;
          }
        }
      }
      if (!played) break;
      plies += 1;
    }
    expect(plies).toBeLessThan(200);
  });
});
