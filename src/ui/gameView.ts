import { createGameSession } from '../game/session';
import { recordGame } from '../storage/progress';
import type { Color } from '../engine/types';
import { createBoardView, type BoardMarker } from './boardView';

export const renderGame = (): HTMLElement => {
  const wrap = document.createElement('div');

  const layout = document.createElement('div');
  layout.className = 'layout';

  const boardWrap = document.createElement('div');
  boardWrap.className = 'board-wrap';

  const panel = document.createElement('div');
  panel.className = 'panel';

  const heading = document.createElement('h2');
  heading.textContent = 'Atari Go (9×9)';
  panel.appendChild(heading);

  const rules = document.createElement('p');
  rules.textContent =
    'First player to capture any stone wins. The bot plays simple, beginner-level shapes.';
  panel.appendChild(rules);

  const colorRow = document.createElement('div');
  colorRow.style.marginBottom = '12px';
  const colorLabel = document.createElement('label');
  colorLabel.style.fontSize = '14px';
  colorLabel.textContent = 'Play as: ';
  const colorSelect = document.createElement('select');
  for (const [val, label] of [['B', 'Black (first)'], ['W', 'White (second)']] as const) {
    const o = document.createElement('option');
    o.value = val;
    o.textContent = label;
    colorSelect.appendChild(o);
  }
  colorRow.appendChild(colorLabel);
  colorRow.appendChild(colorSelect);
  panel.appendChild(colorRow);

  const status = document.createElement('div');
  status.className = 'feedback info';
  panel.appendChild(status);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'New game';
  buttonRow.appendChild(resetBtn);
  panel.appendChild(buttonRow);

  let session = createGameSession(9, 'B');
  let recorded = false;

  const view = createBoardView({
    onClick: (p) => {
      if (session.status.kind !== 'in-progress') return;
      if (session.state.toPlay !== session.human) return;
      const r = session.playHuman(p);
      if (!r.ok) return;
      const markers: BoardMarker[] = [];
      if (r.humanMove) markers.push({ kind: 'last-move', point: r.humanMove });
      if (r.botMove) markers.push({ kind: 'last-move', point: r.botMove });
      view.render(session.state.board, markers);
      updateStatus();
    },
    showCoordinates: true,
  });
  boardWrap.appendChild(view.element);

  const updateStatus = () => {
    if (session.status.kind === 'won') {
      const won = session.status.winner === session.human;
      status.className = `feedback ${won ? 'good' : 'bad'}`;
      status.textContent = won ? 'You won!' : 'Bot wins. Try again.';
      if (!recorded) {
        recordGame(won);
        recorded = true;
      }
    } else {
      const yourTurn = session.state.toPlay === session.human;
      status.className = 'feedback info';
      status.textContent = yourTurn ? 'Your turn.' : 'Bot is thinking...';
    }
  };

  const start = (color: Color) => {
    session = createGameSession(9, color);
    recorded = false;
    const markers: BoardMarker[] = [];
    if (session.lastMove) markers.push({ kind: 'last-move', point: session.lastMove });
    view.render(session.state.board, markers);
    updateStatus();
  };
  start('B');

  colorSelect.addEventListener('change', () => {
    start(colorSelect.value as Color);
  });
  resetBtn.addEventListener('click', () => {
    start(colorSelect.value as Color);
  });

  layout.appendChild(boardWrap);
  layout.appendChild(panel);
  wrap.appendChild(layout);
  return wrap;
};
