/**
 * Seed (M3-3): legt einen Demo-Admin-Hinweis und drei Blog-Beispieleinträge an.
 * Schreibt lokal über die D1-HTTP-API von `wrangler d1 execute`.
 */
import { execSync } from 'node:child_process';

const posts = [
  { slug: 'hallo-welt', title: 'Hallo Welt', body: 'Dein erster Beitrag.' },
  { slug: 'zweiter-beitrag', title: 'Zweiter Beitrag', body: 'Noch ein Beispiel.' },
  { slug: 'dritter-beitrag', title: 'Dritter Beitrag', body: 'Und ein dritter.' },
];

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

for (const p of posts) {
  const id = crypto.randomUUID();
  const data = JSON.stringify({ body: p.body }).replace(/'/g, "''");
  const sql = `INSERT INTO blog (id, title, slug, status, data) VALUES ('${id}', '${esc(p.title)}', '${p.slug}', 'published', '${data}');`;
  console.log(`Seeding: ${p.title}`);
  execSync(`wrangler d1 execute DB --local --command "${sql.replace(/"/g, '\\"')}"`, {
    stdio: 'inherit',
  });
}

console.log('\n✓ Demo-Blog angelegt. Admin-User: Im Dev-Modus ist eine Demo-Session aktiv.');
console.log('  Für Produktion den gewählten Auth-Provider in src/server/auth.ts konfigurieren.');
