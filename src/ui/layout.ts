export type Route = '/' | '/puzzles' | '/play';

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

  root.appendChild(header);
  root.appendChild(main);
};
