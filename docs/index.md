# WorkerPress

Schema-getriebenes Edge-Application-Framework mit CMS-Fokus — Astro + Hono auf
Cloudflare Workers. Eine Collection-Definition erzeugt Tabelle, Zod-Schemas,
REST/RPC, OpenAPI, Admin-Formular, Query-Layer, Such-Index und TypeScript-Typen.

## Getting Started

```bash
npm create workerpress my-cms
cd my-cms
npm install
npm run cms setup     # D1/KV (+R2) via Wrangler
npm run db:migrate
npm run seed
npm run dev           # http://localhost:4321  ·  /admin
```

Erster Deploy:

```bash
npm run db:migrate:remote
npm run deploy
```

## Dokumentation

- [Collections & Fields](./collections.md)
- [Policies, Hooks & Events](./policies-hooks-events.md)
- [Query-Layer](./query-layer.md)
- [Plugin-System](./plugins.md)
- [CLI-Referenz](./cli.md)
- [CI/CD-Gate](./ci.md)

## Architektur in einem Satz

Astro besitzt das UI, Hono besitzt `/api/*` — eine Worker. Domänen-Code greift
nur über den `Platform`-Contract (D1/R2/KV/Queues/Cache) zu, nie direkt auf
Bindings. Zwei API-Oberflächen pro Collection: `/api/content/*` (read-only,
gecacht, nur `published`) und `/api/internal/*` (Vollzugriff, Policy-/Token-geschützt).
