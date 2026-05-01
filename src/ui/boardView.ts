import type { Board } from '../engine/board';
import type { Point } from '../engine/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type BoardViewOptions = {
  onClick?: (p: Point) => void;
  showCoordinates?: boolean;
};

export type BoardMarker =
  | { kind: 'last-move'; point: Point }
  | { kind: 'highlight'; point: Point; color: string }
  | { kind: 'label'; point: Point; text: string };

export type BoardView = {
  element: SVGSVGElement;
  render: (
    board: Board,
    markers?: BoardMarker[],
    ghost?: { point: Point; color: 'B' | 'W' } | null,
  ) => void;
};

export const createBoardView = (opts: BoardViewOptions = {}): BoardView => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'board');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  let currentSize = 0;
  let hovered: Point | null = null;
  let lastBoard: Board | null = null;
  let lastMarkers: BoardMarker[] = [];
  let lastGhost: { point: Point; color: 'B' | 'W' } | null = null;

  const margin = 30;
  const cellSize = 36;

  const layout = (size: number) => {
    const total = margin * 2 + cellSize * (size - 1);
    svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
    svg.setAttribute('width', String(total));
    svg.setAttribute('height', String(total));
  };

  const coordToPx = (x: number) => margin + x * cellSize;

  const pxToCoord = (clientX: number, clientY: number, size: number): Point | null => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    const x = Math.round((local.x - margin) / cellSize);
    const y = Math.round((local.y - margin) / cellSize);
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return { x, y };
  };

  const draw = () => {
    if (!lastBoard) return;
    const size = lastBoard.size;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(margin * 2 + cellSize * (size - 1)));
    bg.setAttribute('height', String(margin * 2 + cellSize * (size - 1)));
    bg.setAttribute('class', 'board-bg');
    svg.appendChild(bg);

    for (let i = 0; i < size; i++) {
      const h = document.createElementNS(SVG_NS, 'line');
      h.setAttribute('x1', String(coordToPx(0)));
      h.setAttribute('y1', String(coordToPx(i)));
      h.setAttribute('x2', String(coordToPx(size - 1)));
      h.setAttribute('y2', String(coordToPx(i)));
      h.setAttribute('class', 'board-line');
      svg.appendChild(h);

      const v = document.createElementNS(SVG_NS, 'line');
      v.setAttribute('x1', String(coordToPx(i)));
      v.setAttribute('y1', String(coordToPx(0)));
      v.setAttribute('x2', String(coordToPx(i)));
      v.setAttribute('y2', String(coordToPx(size - 1)));
      v.setAttribute('class', 'board-line');
      svg.appendChild(v);
    }

    const stars = starPoints(size);
    for (const s of stars) {
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', String(coordToPx(s.x)));
      dot.setAttribute('cy', String(coordToPx(s.y)));
      dot.setAttribute('r', '3');
      dot.setAttribute('class', 'board-star');
      svg.appendChild(dot);
    }

    if (opts.showCoordinates) {
      const letters = 'ABCDEFGHJKLMNOPQRST';
      for (let i = 0; i < size; i++) {
        const t1 = document.createElementNS(SVG_NS, 'text');
        t1.setAttribute('x', String(coordToPx(i)));
        t1.setAttribute('y', String(margin - 10));
        t1.setAttribute('class', 'board-coord');
        t1.setAttribute('text-anchor', 'middle');
        t1.textContent = letters[i] ?? '';
        svg.appendChild(t1);
        const t2 = document.createElementNS(SVG_NS, 'text');
        t2.setAttribute('x', String(margin - 14));
        t2.setAttribute('y', String(coordToPx(i) + 4));
        t2.setAttribute('class', 'board-coord');
        t2.setAttribute('text-anchor', 'middle');
        t2.textContent = String(size - i);
        svg.appendChild(t2);
      }
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = lastBoard.cells[y * size + x];
        if (!c) continue;
        drawStone(svg, coordToPx(x), coordToPx(y), c, 1);
      }
    }

    for (const m of lastMarkers) {
      if (m.kind === 'last-move') {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', String(coordToPx(m.point.x)));
        dot.setAttribute('cy', String(coordToPx(m.point.y)));
        dot.setAttribute('r', '5');
        const stone = lastBoard.cells[m.point.y * size + m.point.x];
        dot.setAttribute('class', stone === 'B' ? 'last-move on-black' : 'last-move on-white');
        svg.appendChild(dot);
      } else if (m.kind === 'highlight') {
        const ring = document.createElementNS(SVG_NS, 'circle');
        ring.setAttribute('cx', String(coordToPx(m.point.x)));
        ring.setAttribute('cy', String(coordToPx(m.point.y)));
        ring.setAttribute('r', String(cellSize * 0.42));
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', m.color);
        ring.setAttribute('stroke-width', '3');
        svg.appendChild(ring);
      } else if (m.kind === 'label') {
        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('x', String(coordToPx(m.point.x)));
        t.setAttribute('y', String(coordToPx(m.point.y) + 4));
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', 'board-label');
        t.textContent = m.text;
        svg.appendChild(t);
      }
    }

    if (lastGhost) {
      drawStone(
        svg,
        coordToPx(lastGhost.point.x),
        coordToPx(lastGhost.point.y),
        lastGhost.color,
        0.4,
      );
    } else if (hovered && lastBoard.cells[hovered.y * size + hovered.x] === null) {
      // No-op: hover is shown only when caller sets a ghost preview
    }
  };

  svg.addEventListener('click', (e) => {
    if (!lastBoard || !opts.onClick) return;
    const p = pxToCoord(e.clientX, e.clientY, lastBoard.size);
    if (!p) return;
    if (lastBoard.cells[p.y * lastBoard.size + p.x] !== null) return;
    opts.onClick(p);
  });

  svg.addEventListener('mousemove', (e) => {
    if (!lastBoard) return;
    const p = pxToCoord(e.clientX, e.clientY, lastBoard.size);
    if (!p) {
      if (hovered) {
        hovered = null;
        draw();
      }
      return;
    }
    if (!hovered || hovered.x !== p.x || hovered.y !== p.y) {
      hovered = p;
    }
  });

  svg.addEventListener('mouseleave', () => {
    hovered = null;
    draw();
  });

  return {
    element: svg,
    render(board, markers = [], ghost = null) {
      if (board.size !== currentSize) {
        currentSize = board.size;
        layout(board.size);
      }
      lastBoard = board;
      lastMarkers = markers;
      lastGhost = ghost;
      draw();
    },
  };
};

const drawStone = (
  svg: SVGSVGElement,
  cx: number,
  cy: number,
  color: 'B' | 'W',
  opacity: number,
) => {
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('cx', String(cx));
  c.setAttribute('cy', String(cy));
  c.setAttribute('r', '16');
  c.setAttribute('class', color === 'B' ? 'stone-black' : 'stone-white');
  c.setAttribute('opacity', String(opacity));
  svg.appendChild(c);
};

const starPoints = (size: number): { x: number; y: number }[] => {
  if (size === 9) {
    return [
      { x: 2, y: 2 }, { x: 6, y: 2 }, { x: 4, y: 4 },
      { x: 2, y: 6 }, { x: 6, y: 6 },
    ];
  }
  if (size === 13) {
    return [
      { x: 3, y: 3 }, { x: 9, y: 3 }, { x: 6, y: 6 },
      { x: 3, y: 9 }, { x: 9, y: 9 },
    ];
  }
  if (size === 19) {
    const pts: { x: number; y: number }[] = [];
    for (const x of [3, 9, 15]) for (const y of [3, 9, 15]) pts.push({ x, y });
    return pts;
  }
  return [];
};
