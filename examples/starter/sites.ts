import { defineSite, type SiteConfig } from '@workerpress/core';

/**
 * Sites-Register (M2-9): Hauptseite + Landingpages als ein Konstrukt. Content mit
 * `site = <id>` gehört zu dieser Site; Content ohne `site` (NULL) ist global und
 * erscheint überall. Die Content-API löst die aktive Site aus dem Host bzw. dem
 * `x-site`-Header auf. Diese Liste wird zusätzlich in die `sites`-Tabelle
 * gespiegelt (siehe `pnpm cms seed:sites`).
 */
export const sites: SiteConfig[] = [
  defineSite({ id: 'main', role: 'main', host: 'example.com', name: 'Hauptseite' }),
  defineSite({
    id: 'launch',
    role: 'landing',
    host: 'launch.example.com',
    name: 'Produkt-Launch',
  }),
];

export default sites;
