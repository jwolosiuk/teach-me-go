import { ALL_PUZZLES } from '../puzzles/data/index';
import { gamesLost, gamesWon, solvedIds } from '../storage/progress';

export const renderHome = (): HTMLElement => {
  const wrap = document.createElement('div');

  const intro = document.createElement('section');
  intro.innerHTML = `
    <h2 style="margin-top:0">Learn Go, one capture at a time.</h2>
    <p style="color: var(--muted); max-width: 640px;">
      Module 1 focuses on the most fundamental Go skill: capturing stones.
      Solve hand-authored puzzles that scale from one-move captures up to
      ladders and double-atari forks, then test what you've learned by playing
      a full Atari Go game (first capture wins) against the bot.
    </p>
  `;
  wrap.appendChild(intro);

  const solved = solvedIds();
  const stats = document.createElement('p');
  stats.style.color = 'var(--muted)';
  stats.style.fontSize = '14px';
  stats.textContent =
    `Puzzles solved: ${solved.size} / ${ALL_PUZZLES.length} · ` +
    `Atari Go: ${gamesWon()} won, ${gamesLost()} lost`;
  wrap.appendChild(stats);

  const cards = document.createElement('div');
  cards.className = 'home-cards';
  cards.style.marginTop = '24px';

  const card1 = document.createElement('a');
  card1.className = 'home-card';
  card1.href = '#/puzzles';
  card1.innerHTML = `
    <h3>Puzzles</h3>
    <p>Capture, save, ladder, and double-atari problems. Pick one and solve it move by move.</p>
  `;
  cards.appendChild(card1);

  const card2 = document.createElement('a');
  card2.className = 'home-card';
  card2.href = '#/play';
  card2.innerHTML = `
    <h3>Atari Go</h3>
    <p>9×9 game vs. a beginner-level bot. First capture wins. Apply your puzzle skills.</p>
  `;
  cards.appendChild(card2);

  wrap.appendChild(cards);
  return wrap;
};
