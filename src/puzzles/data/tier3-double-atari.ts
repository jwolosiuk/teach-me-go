import type { Puzzle } from '../types';

const E = `. . . . . . . . .`;

export const TIER3_DOUBLE_ATARI: Puzzle[] = [
  {
    id: 'da-01',
    category: 'double-atari',
    difficulty: 3,
    size: 9,
    toPlay: 'B',
    setup: [
      E,
      E,
      `. X O . O X . . .`,
      `. . X . X . . . .`,
      E, E, E, E, E,
    ].join('\n'),
    lines: [{ steps: [{ user: { x: 3, y: 2 } }] }],
    hint: 'One move, two ataris. Find the shared liberty.',
    description: 'Two white stones share a single liberty between them.',
  },
  {
    id: 'da-02',
    category: 'double-atari',
    difficulty: 3,
    size: 9,
    toPlay: 'B',
    setup: [
      E, E, E,
      `. . X . X . . . .`,
      `. . O . O . . . .`,
      `. . X . X . . . .`,
      E, E, E,
    ].join('\n'),
    lines: [{ steps: [{ user: { x: 3, y: 4 } }] }],
    hint: 'Both white stones lean on the same empty point.',
    description: 'Two enclosed white stones with a single shared liberty.',
  },
];
