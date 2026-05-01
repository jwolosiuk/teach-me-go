import { createGameSession } from '../game/session';
import { BOT_PRESETS, findPreset } from '../game/bot';
import { getBotPreset, recordGame, setBotPreset } from '../storage/progress';
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
    'First player to capture any stone wins. Pick a difficulty and play.';
  panel.appendChild(rules);

  const colorRow = document.createElement('div');
  colorRow.style.marginBottom = '8px';
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

  const levelRow = document.createElement('div');
  levelRow.style.marginBottom = '12px';
  const levelLabel = document.createElement('label');
  levelLabel.style.fontSize = '14px';
  levelLabel.textContent = 'Bot: ';
  const levelSelect = document.createElement('select');
  for (const preset of BOT_PRESETS) {
    const o = document.createElement('option');
    o.value = preset.id;
    o.textContent = preset.label;
    levelSelect.appendChild(o);
  }
  levelSelect.value = getBotPreset();
  levelRow.appendChild(levelLabel);
  levelRow.appendChild(levelSelect);

  const levelDesc = document.createElement('div');
  levelDesc.style.fontSize = '12px';
  levelDesc.style.color = 'var(--muted)';
  levelDesc.style.marginTop = '4px';
  const updateLevelDesc = () => {
    levelDesc.textContent = findPreset(levelSelect.value).description;
  };
  updateLevelDesc();
  levelRow.appendChild(levelDesc);

  panel.appendChild(levelRow);

  const status = document.createElement('div');
  status.className = 'feedback info';
  panel.appendChild(status);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'New game';
  buttonRow.appendChild(resetBtn);
  panel.appendChild(buttonRow);

  let session = createGameSession(9, 'B', findPreset(getBotPreset()).config);
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

  const start = (color: Color, presetId: string) => {
    session = createGameSession(9, color, findPreset(presetId).config);
    recorded = false;
    const markers: BoardMarker[] = [];
    if (session.lastMove) markers.push({ kind: 'last-move', point: session.lastMove });
    view.render(session.state.board, markers);
    updateStatus();
  };
  start('B', getBotPreset());

  colorSelect.addEventListener('change', () => {
    start(colorSelect.value as Color, levelSelect.value);
  });
  levelSelect.addEventListener('change', () => {
    setBotPreset(levelSelect.value);
    updateLevelDesc();
    start(colorSelect.value as Color, levelSelect.value);
  });
  resetBtn.addEventListener('click', () => {
    start(colorSelect.value as Color, levelSelect.value);
  });

  layout.appendChild(boardWrap);
  layout.appendChild(panel);
  wrap.appendChild(layout);
  return wrap;
};
