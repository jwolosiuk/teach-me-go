import { TIER1_CAPTURE } from './tier1-capture';
import { TIER1_SAVE } from './tier1-save';
import { TIER2_DIRECTION } from './tier2-direction';
import { TIER2_LADDER } from './tier2-ladder';
import { TIER3_DOUBLE_ATARI } from './tier3-double-atari';
import { GENERATED_PUZZLES } from './generated';
import { getUserPuzzles } from '../../storage/userPuzzles';
import type { Puzzle } from '../types';

export const BUILT_IN_PUZZLES: Puzzle[] = [
  ...TIER1_CAPTURE,
  ...TIER1_SAVE,
  ...TIER2_DIRECTION,
  ...TIER2_LADDER,
  ...TIER3_DOUBLE_ATARI,
  ...GENERATED_PUZZLES,
];

// Combines built-in puzzles with anything the user has generated client-side.
// Read fresh on each access so newly generated puzzles appear immediately.
export const allPuzzles = (): Puzzle[] => [...BUILT_IN_PUZZLES, ...getUserPuzzles()];

// Built-ins only; integrity check imports this directly so it doesn't depend
// on browser-only storage at module load time.
export const ALL_PUZZLES = BUILT_IN_PUZZLES;
