import './styles.css';
import { renderShell, type Route } from './ui/layout';
import { renderHome } from './ui/homeView';
import { renderPuzzleList, renderPuzzle } from './ui/puzzleView';
import { renderGame } from './ui/gameView';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');

const parseRoute = (): { route: Route; param?: string } => {
  const hash = location.hash.replace(/^#/, '') || '/';
  if (hash === '/') return { route: '/' };
  if (hash === '/puzzles') return { route: '/puzzles' };
  if (hash.startsWith('/puzzles/')) {
    return { route: '/puzzles', param: hash.slice('/puzzles/'.length) };
  }
  if (hash === '/play') return { route: '/play' };
  return { route: '/' };
};

const router = () => {
  const { route, param } = parseRoute();
  let content: HTMLElement;
  if (route === '/') {
    content = renderHome();
  } else if (route === '/puzzles' && param) {
    content = renderPuzzle(param);
  } else if (route === '/puzzles') {
    content = renderPuzzleList();
  } else {
    content = renderGame();
  }
  renderShell(root, route, content);
};

window.addEventListener('hashchange', router);
router();
