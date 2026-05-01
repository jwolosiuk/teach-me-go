import type { Puzzle } from '../puzzles/types';

const KEY = 'tmg.user_puzzles';
const MAX_STORED = 1000;

const safeRead = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const safeWrite = (v: string): void => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
};

export const getUserPuzzles = (): Puzzle[] => {
  const raw = safeRead();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Puzzle[];
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
};

export const addUserPuzzles = (puzzles: Puzzle[]): void => {
  const existing = getUserPuzzles();
  const seenIds = new Set(existing.map((p) => p.id));
  const merged = existing.slice();
  for (const p of puzzles) {
    if (seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    merged.push(p);
  }
  while (merged.length > MAX_STORED) merged.shift();
  safeWrite(JSON.stringify(merged));
};

export const clearUserPuzzles = (): void => {
  safeWrite('[]');
};
