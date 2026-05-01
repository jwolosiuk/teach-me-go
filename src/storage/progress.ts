const SOLVED_KEY = 'tmg.solved';
const GAMES_WON_KEY = 'tmg.games_won';
const GAMES_LOST_KEY = 'tmg.games_lost';
const BOT_PRESET_KEY = 'tmg.bot_preset';
const BOT_TIME_KEY = 'tmg.bot_time_ms';

const safeRead = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeWrite = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

export const solvedIds = (): Set<string> => {
  const raw = safeRead(SOLVED_KEY);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
};

export const markSolved = (id: string): void => {
  const set = solvedIds();
  set.add(id);
  safeWrite(SOLVED_KEY, JSON.stringify([...set]));
};

export const isSolved = (id: string): boolean => solvedIds().has(id);

export const gamesWon = (): number => {
  const raw = safeRead(GAMES_WON_KEY);
  return raw ? Number(raw) || 0 : 0;
};

export const gamesLost = (): number => {
  const raw = safeRead(GAMES_LOST_KEY);
  return raw ? Number(raw) || 0 : 0;
};

export const recordGame = (won: boolean): void => {
  if (won) safeWrite(GAMES_WON_KEY, String(gamesWon() + 1));
  else safeWrite(GAMES_LOST_KEY, String(gamesLost() + 1));
};

export const getBotPreset = (): string => safeRead(BOT_PRESET_KEY) ?? '0';
export const setBotPreset = (id: string): void => safeWrite(BOT_PRESET_KEY, id);

export const getBotTimeMs = (defaultMs: number): number => {
  const raw = safeRead(BOT_TIME_KEY);
  if (!raw) return defaultMs;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
};
export const setBotTimeMs = (ms: number): void => safeWrite(BOT_TIME_KEY, String(ms));
