# __PROJECT_NAME__

Ein WorkerPress-Projekt (Astro + Hono auf Cloudflare Workers).

## Schnellstart

```bash
npm install
npm run cms setup     # provisioniert D1/KV (und R2, falls aktiviert) via Wrangler
npm run db:migrate    # wendet die gebündelten Migrationen lokal an
npm run seed          # legt Demo-Blog-Einträge an
npm run dev           # http://localhost:4321  (/admin im Dev-Modus offen)
```

## Befehle

- `npm run cms inspect [collection]` — generierte Realität (Tabelle, Routen, Policies …)
- `npm run cms routes` / `collections` / `doctor` — Übersichten + Health-Check (CI-Gate)
- `npm run deploy` — Build + `wrangler deploy`
- `npm run test:e2e` — Playwright-Smoke (`/` + `/admin`)

## Struktur

- `collections/` — die DSL: eine Definition erzeugt Tabelle, REST/RPC, OpenAPI, Admin-Form.
- `src/server/app.ts` — Hono-App unter `/api/*`.
- `src/pages/` — Astro-UI; `/admin` für die Verwaltung.
- `migrations/` — gebündelte SQL-Migrationen (Plattform-Tabellen + Collections).
