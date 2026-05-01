import type { Puzzle } from '../types';

const E = `. . . . . . . . .`;

export const TIER2_DIRECTION: Puzzle[] = [
  {
    id: 'dir-01',
    category: 'atari-direction',
    difficulty: 2,
    size: 9,
    toPlay: 'B',
    setup: [
      E,
      `. . X . . . . . .`,
      `. X O . . . . . .`,
      E,
      `. . O . . . . . .`,
      E, E, E, E,
    ].join('\n'),
    lines: [{ steps: [{ user: { x: 2, y: 3 } }] }],
    hint: 'Atari from the side that prevents white from connecting to a friend.',
    description: 'White has two liberties; one direction lets it link up below.',
  },
  {
    id: 'dir-02',
    category: 'atari-direction',
    difficulty: 2,
    size: 9,
    toPlay: 'B',
    setup: [
      E, E,
      `. . . . . X . . .`,
      `. . . . X O . . .`,
      E,
      `. . . . . O . . .`,
      E, E, E,
    ].join('\n'),
    lines: [{ steps: [{ user: { x: 5, y: 4 } }] }],
    hint: 'Cut off the connection toward the friendly stone.',
    description: 'Pick the atari that doesn’t let white link downward.',
  },
];
