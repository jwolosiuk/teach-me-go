# teach-me-go

Learn the game of Go from zero through 48 short puzzles, then play against a bot.
Runs entirely in the browser: no accounts, no backend.

**Play:** https://teach-me-go.oraculum-aeternum.duckdns.org

## What is inside

- **Puzzles** — 48 hand-checked positions that introduce capturing, liberties, eyes,
  life and death, ko and basic shape, each with immediate feedback.
- **Bot** — a Monte Carlo Tree Search opponent (`src/`), playable on small boards;
  strength is tuned for learners, not for winning.
- **Progress** — stored in `localStorage`; nothing leaves your browser.

## Development

```sh
npm ci
npm test          # unit tests
npm run check:puzzles
npm run build     # static site in dist/
```

TypeScript + Vite. The footer shows the commit hash taken from git at build time.
