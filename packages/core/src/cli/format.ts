/**
 * Farb- und Text-Ausgabe für die `cms`-Befehle (M3-1). Hält die Präsentation aus
 * den Daten-Describern (`cli/describe.ts`) heraus, damit `--json` exakt dieselbe
 * Information maschinenlesbar liefert. Farben werden bei `NO_COLOR` oder Nicht-TTY
 * deaktiviert.
 */

import type { CollectionInfo, RouteInfo } from './describe.js';

const enabled = (): boolean => !process.env.NO_COLOR && Boolean(process.stdout?.isTTY);

type Color = 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'gray' | 'bold' | 'dim';
const CODES: Record<Color, [number, number]> = {
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  gray: [90, 39],
  bold: [1, 22],
  dim: [2, 22],
};

export function color(c: Color, text: string): string {
  if (!enabled()) return text;
  const [open, close] = CODES[c];
  return `[${open}m${text}[${close}m`;
}

const METHOD_COLOR: Record<string, Color> = {
  GET: 'green',
  POST: 'yellow',
  PUT: 'blue',
  DELETE: 'red',
  '*': 'magenta',
};

/** Tabellarische Routen-Ausgabe, nach Pfad gruppiert. */
export function formatRoutes(routes: RouteInfo[]): string {
  const width = Math.max(...routes.map((r) => r.method.length), 6);
  const pathWidth = Math.max(...routes.map((r) => r.path.length), 4);
  const lines = [color('bold', `Routes (${routes.length})`)];
  for (const r of routes) {
    const method = color(METHOD_COLOR[r.method] ?? 'gray', r.method.padEnd(width));
    const path = r.path.padEnd(pathWidth);
    lines.push(`  ${method}  ${path}  ${color('dim', r.auth)}  ${color('gray', r.surface)}`);
  }
  return lines.join('\n');
}

/** Tabellarische Collections-Ausgabe. */
export function formatCollections(infos: CollectionInfo[]): string {
  const lines = [color('bold', `Collections (${infos.length})`)];
  for (const c of infos) {
    lines.push(
      `  ${color('cyan', c.name)} ${color('dim', `v${c.version}`)} — ${c.fields} fields`,
      `      policies: read=${c.policies.read ?? color('dim', 'public')} write=${c.policies.write ?? color('dim', 'auth')}`,
      `      hooks: beforeChange=${c.hooks.beforeChange} afterChange=${c.hooks.afterChange}`,
      `      searchable: ${c.searchable.length ? c.searchable.join(', ') : color('dim', 'none')}`,
    );
  }
  return lines.join('\n');
}

/** Hilfsfunktion: gibt `data` als JSON oder formatierten Text aus. */
export function renderOutput(json: boolean, data: unknown, text: string): string {
  return json ? JSON.stringify(data, null, 2) : text;
}
