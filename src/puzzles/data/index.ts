import { TIER1_CAPTURE } from './tier1-capture';
import { TIER1_SAVE } from './tier1-save';
import { TIER2_DIRECTION } from './tier2-direction';
import { TIER2_LADDER } from './tier2-ladder';
import { TIER3_DOUBLE_ATARI } from './tier3-double-atari';
import type { Puzzle } from '../types';

export const ALL_PUZZLES: Puzzle[] = [
  ...TIER1_CAPTURE,
  ...TIER1_SAVE,
  ...TIER2_DIRECTION,
  ...TIER2_LADDER,
  ...TIER3_DOUBLE_ATARI,
];
