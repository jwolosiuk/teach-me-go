import type { Color, Point } from '../engine/types';

export type PuzzleCategory =
  | 'capture-1'
  | 'save-1'
  | 'atari-direction'
  | 'ladder'
  | 'net'
  | 'double-atari'
  | 'semeai-basic';

export type PuzzleStep = {
  user: Point;
  bot?: Point;
};

export type PuzzleLine = {
  steps: PuzzleStep[];
};

export type Puzzle = {
  id: string;
  category: PuzzleCategory;
  difficulty: 1 | 2 | 3;
  size: number;
  toPlay: Color;
  setup: string;
  lines: PuzzleLine[];
  hint?: string;
  description?: string;
};

export const CATEGORY_LABELS: Record<PuzzleCategory, string> = {
  'capture-1': 'Capture in one',
  'save-1': 'Save in one',
  'atari-direction': 'Right direction of atari',
  'ladder': 'Ladder',
  'net': 'Net (geta)',
  'double-atari': 'Double atari',
  'semeai-basic': 'Capture race',
};

export const CATEGORY_TIER: Record<PuzzleCategory, 1 | 2 | 3> = {
  'capture-1': 1,
  'save-1': 1,
  'atari-direction': 2,
  'ladder': 2,
  'net': 3,
  'double-atari': 3,
  'semeai-basic': 3,
};
