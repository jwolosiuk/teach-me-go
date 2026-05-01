export type Route = '/' | '/puzzles' | '/play';

const REPO_URL = 'https://github.com/jwolosiuk/teach-me-go';

const formatBangkok = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${fmt.format(d)} ICT`;
};

export const renderShell = (root: HTMLElement, currentRoute: Route, content: HTMLElement) => {
  root.innerHTML = '';

  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = 'Teach Me Go';
  header.appendChild(title);

  const nav = document.createElement('nav');
  const links: [Route, string][] = [
    ['/', 'Home'],
    ['/puzzles', 'Puzzles'],
    ['/play', 'Atari Go'],
  ];
  for (const [route, label] of links) {
    const a = document.createElement('a');
    a.href = `#${route}`;
    a.textContent = label;
    if (route === currentRoute) a.className = 'active';
    nav.appendChild(a);
  }
  header.appendChild(nav);

  const main = document.createElement('main');
  main.appendChild(content);

  const footer = document.createElement('footer');
  const hashLink = document.createElement('a');
  hashLink.href = `${REPO_URL}/commit/${__COMMIT_HASH__}`;
  hashLink.target = '_blank';
  hashLink.rel = 'noopener noreferrer';
  hashLink.textContent = __COMMIT_HASH__;
  footer.appendChild(document.createTextNode('Build '));
  footer.appendChild(hashLink);
  footer.appendChild(document.createTextNode(` · ${formatBangkok(__COMMIT_TIME__)}`));

  root.appendChild(header);
  root.appendChild(main);
  root.appendChild(footer);
};
