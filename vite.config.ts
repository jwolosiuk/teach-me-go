import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const tryGit = (cmd: string, fallback: string): string => {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
};

const commitHash = tryGit('rev-parse --short HEAD', 'dev');
const commitTime = tryGit('log -1 --format=%cI', new Date().toISOString());

export default defineConfig({
  base: './',
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __COMMIT_TIME__: JSON.stringify(commitTime),
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
