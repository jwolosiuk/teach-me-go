import type { Puzzle } from '../types';

const E = `. . . . . . . . .`;

export const TIER2_LADDER: Puzzle[] = [
  {
    id: 'lad-01',
    category: 'ladder',
    difficulty: 2,
    size: 9,
    toPlay: 'B',
    setup: [
      E,
      E,
      `. X . X . . . . .`,
      `. X O X . . . . .`,
      E, E, E, E, E,
    ].join('\n'),
    lines: [
      {
        steps: [
          { user: { x: 2, y: 4 }, bot: { x: 2, y: 2 } },
          { user: { x: 2, y: 1 } },
        ],
      },
    ],
    hint: 'Atari from below. Where will white run?',
    description: 'Short two-step ladder.',
  },
  {
    id: 'lad-02',
    category: 'ladder',
    difficulty: 2,
    size: 9,
    toPlay: 'B',
    setup: [
      E,
      `. . X . . . . . .`,
      `. . O X . . . . .`,
      `. X . . . . . . .`,
      E, E, E, E, E,
    ].join('\n'),
    lines: [
      {
        steps: [
          { user: { x: 2, y: 3 }, bot: { x: 1, y: 2 } },
          { user: { x: 1, y: 1 }, bot: { x: 0, y: 2 } },
          { user: { x: 0, y: 3 }, bot: { x: 0, y: 1 } },
          { user: { x: 0, y: 0 } },
        ],
      },
    ],
    hint: 'A four-step ladder running into the corner.',
    description: 'Ladder all the way to the corner.',
  },
];
