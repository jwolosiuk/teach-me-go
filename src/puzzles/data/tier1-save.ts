import type { Puzzle } from '../types';

const E = `. . . . . . . . .`;

export const TIER1_SAVE: Puzzle[] = [
  {
    id: 'sav1-01',
    category: 'save-1',
    difficulty: 1,
    size: 9,
    toPlay: 'B',
    setup: [
      E, E, E,
      `. . O O . . . . .`,
      `. . O X O . . . .`,
      E, E, E, E,
    ].join('\n'),
    lines: [{ steps: [{ user: { x: 3, y: 5 } }] }],
    hint: 'Black has only one liberty. Extend toward the open space.',
    description: 'A black stone in atari near the centre.',
  },
  {
    id: 'sav1-02',
    category: 'save-1',
    difficulty: 1,
    size: 9,
    toPlay: 'B',
    setup: [
      E, E, E, E, E, E, E,
      E,
      `. O X O . . . . .`,
    ].join('\n'),
    lines: [{ steps: [{ user: { x: 2, y: 7 } }] }],
    hint: 'Run away from the edge into open space.',
    description: 'A black stone trapped on the bottom edge.',
  },
  {
    id: 'sav1-03',
    category: 'save-1',
    difficulty: 1,
    size: 9,
    toPlay: 'B',
    setup: [
      E, E, E, E,
      `. . O O O . . . .`,
      `. . . O X O . . .`,
      E, E, E,
    ].join('\n'),
    lines: [{ steps: [{ user: { x: 4, y: 6 } }] }],
    hint: 'Only one direction has air to breathe.',
    description: 'Black stone enclosed on three sides.',
  },
  {
    id: 'sav1-04',
    category: 'save-1',
    difficulty: 1,
    size: 9,
    toPlay: 'B',
    setup: [
      E, E,
      `. . . . O . . . .`,
      `. . . O X O . . .`,
      `. . . . . . . . .`,
      E, E, E, E,
    ].join('\n'),
    lines: [{ steps: [{ user: { x: 4, y: 4 } }] }],
    hint: 'Push down into open territory.',
    description: 'Lone black stone in early atari.',
  },
];
