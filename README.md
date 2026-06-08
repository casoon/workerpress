# WorkerPress

> ⚠️ **Work in progress — not production-ready.** WorkerPress is under active development and
> pre-1.0. APIs, the collection DSL, schemas, and the database layout may change without notice,
> and migrations between versions are not guaranteed. Use it to explore and experiment, not for
> production workloads yet.

**WorkerPress** is a schema-driven edge application framework with a CMS focus. It unites
**Astro** (UI) and **Hono** (API) in a single Cloudflare Worker, driven by one source of
truth: a `defineCollection` definition.

From that single definition, WorkerPress derives the database schema, validation, REST API,
a type-safe query layer, OpenAPI docs, admin forms, the search index, cache revalidation, and
TypeScript types. The CMS is the first complete application built on the framework — not the
limit of what you can build with it.

> **Status:** Milestones M0–M3 complete. The collection DSL is fully implemented and drives
> real generation end-to-end: hybrid DB schema + migrations, Zod schemas, REST/RPC, OpenAPI,
> a type-safe query layer (`find`/`where`/`include`/`orderBy`), relations with `?include=`,
> per-collection types, and FTS5 search. Beyond generation: plugin auto-discovery, sync hooks,
> an async event bus (retry + optional Queues), content versioning + audit log, scoped API
> tokens, first-class cache revalidation, and multi-site. Tooling: the full `cms` CLI
> (`routes`/`collections`/`migrations`/`doctor`/`generate` + `inspect`, all with `--json`),
> `cms doctor` as a CI gate, and the `npm create workerpress` scaffolder. The toolchain is
> green (build, typecheck, tests, lint). A timeboxed bunny.net spike confirms the platform
> contract carries beyond Cloudflare. See [`docs/`](./docs) for the full reference.

## Why Astro + Hono in one Worker

Astro and Hono solve different problems and complement each other:

| Layer | Tool | Why |
|---|---|---|
| Admin UI, pages, SSR | **Astro** | Components and islands instead of HTML string builders. |
| API, middleware, plugins | **Hono** | Radix router, composable middleware, native Zod-OpenAPI, RPC. |
| Data | **Drizzle + D1** | Type-safe, edge-native, auto-generated migrations. |
| Deployment | **One Cloudflare Worker** | Astro and Hono run in the same Worker. One deploy, one origin. |

Astro owns the UI and mounts Hono on a catch-all route (`/api/[...path]`). One build artifact,
one deploy, shared types across the UI/API boundary — and end-to-end type safety via Hono RPC.

## What the definition generates

A single `defineCollection` produces:

1. A Drizzle table and migration (generated columns and indexes for indexed fields)
2. Zod schemas (`insert`, `update`, `select`)
3. REST endpoints with pagination, filtering, and sorting
4. An OpenAPI path served at `/api/docs`
5. Auto-generated admin forms, with a field renderer per field type
6. Exported TypeScript types for the UI and RPC
7. A type-safe query layer (`find` / `where` / `include` / `orderBy`)
8. A search index entry for `searchable` fields

A first-class `cms inspect` command makes every generated artifact (routes, schemas,
migrations, policies, admin form) visible before it is deployed — generation is never a black box.

## Multi-Site, not Multi-Tenant

One installation serves a main site and its related landing pages as a single construct,
managed by one user group. `site` is an optional content filter, not an isolation boundary —
there is no per-tenant data separation and no `tenant_id` in auth, policies, or queries.

## Monorepo

| Package | Name | Purpose |
|---|---|---|
| Core | `@workerpress/core` | Collection DSL, generation, query layer, platform contract, `cms` CLI |
| Cloudflare | `@workerpress/cloudflare` | Platform adapter (Drizzle/D1, R2, KV, Cache, events, `defer`) |
| Bunny | `@workerpress/bunny` | Portability spike adapter (libSQL DB/Storage + KV fallback) |
| UI | `@workerpress/ui` | Shared admin islands (Svelte 5, TanStack Query) |
| Create | `create-workerpress` | `npm create workerpress` scaffolder |
| Plugins | `@workerpress/plugin-*` | Official plugins |
| Starter | `workerpress-starter` | Reference application |

## Develop, build & deploy

The reference app lives in `examples/starter`. From the repo root:

```bash
pnpm install
pnpm dev                 # starter on http://localhost:4321 (Astro + Hono, local D1/R2/KV)
pnpm build && pnpm typecheck && pnpm test && pnpm lint

# data (run in examples/starter)
pnpm --filter workerpress-starter db:generate:collections  # generate a migration from the collections
pnpm --filter workerpress-starter db:migrate:local         # apply it to the local D1
pnpm --filter workerpress-starter cms inspect blog         # see what a collection generates
pnpm --filter workerpress-starter cms doctor               # pre-deploy health check (CI gate)
```

### Deploy to Cloudflare

`@astrojs/cloudflare` bundles Astro + Hono into one Worker and emits the deploy config at
`dist/server/wrangler.json`. Provision the bindings once per environment, then write the
returned IDs into `examples/starter/wrangler.toml`:

```bash
cd examples/starter
wrangler d1 create workerpress             # -> d1_databases[0].database_id
wrangler kv namespace create CACHE         # -> kv_namespaces (CACHE) id
wrangler r2 bucket create workerpress-media
wrangler d1 migrations apply DB --remote   # migrate the remote D1

pnpm deploy    # astro build && wrangler deploy -c dist/server/wrangler.json
pnpm preview   # upload a preview version (no production traffic)
```

After deploy, `GET /api/health` and `/admin` are reachable on the Worker URL. The adapter also
adds `SESSION` (KV, for Astro sessions) and `IMAGES` (Cloudflare Images) bindings — provision /
enable those on the account, or adjust the adapter config, before a production deploy.

## Platform

The primary target is **Cloudflare** (Workers + D1 + R2 + KV). A thin platform abstraction
keeps the core portable; a timeboxed **bunny.net** spike (`@workerpress/bunny`, libSQL +
Storage with a KV fallback) confirms the contract carries — see
[`docs/portability-bunny.md`](./docs/portability-bunny.md). No domain code touches Cloudflare
bindings directly.

## Tech stack

Astro, Hono, Drizzle ORM on D1, Zod, Better Auth, Svelte 5 islands, Tailwind CSS v4,
Wrangler, Vitest, Playwright, and Biome.

## License

Licensed under the **Business Source License 1.1 (BUSL-1.1)**. See the LICENSE file in this
repository for the full terms, the Additional Use Grant, the Change Date, and the Change
License (Apache 2.0).
