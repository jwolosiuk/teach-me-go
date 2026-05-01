export type Color = 'B' | 'W';
export type Cell = Color | null;
export type Point = { x: number; y: number };
export type Move = Point | 'pass';

export const opposite = (c: Color): Color => (c === 'B' ? 'W' : 'B');

export const eqPoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

export const pointKey = (p: Point): string => `${p.x},${p.y}`;
