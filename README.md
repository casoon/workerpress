# WorkerPress

**WorkerPress** is a schema-driven edge application framework with a CMS focus. It unites
**Astro** (UI) and **Hono** (API) in a single Cloudflare Worker, driven by one source of
truth: a `defineCollection` definition.

From that single definition, WorkerPress derives the database schema, validation, REST API,
a type-safe query layer, OpenAPI docs, admin forms, the search index, cache revalidation, and
TypeScript types. The CMS is the first complete application built on the framework — not the
limit of what you can build with it.

> **Status:** Skeleton. The packages expose the public API surface as typed stubs — there is
> no full implementation yet, and dependencies are not installed.

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
| Core | `@workerpress/core` | Collection DSL, generation, platform contract, `cms` CLI |
| UI | `@workerpress/ui` | Shared admin islands (Svelte 5) |
| Create | `create-workerpress` | `npm create workerpress` scaffolder |
| Plugins | `@workerpress/plugin-*` | Official plugins |
| Starter | `workerpress-starter` | Reference application |

## Getting started (planned)

```bash
npm install
npm run dev          # runs the starter (Astro + Hono via Miniflare bindings)
npm run cms inspect  # show generated routes, schemas, and migrations
```

## Platform

The primary target is **Cloudflare** (Workers + D1 + R2 + KV). A thin platform abstraction
keeps the core portable, with **bunny.net** (libSQL + Magic Containers) as a realistic second
target. No domain code touches Cloudflare bindings directly.

## Tech stack

Astro, Hono, Drizzle ORM on D1, Zod, Better Auth, Svelte 5 islands, Tailwind CSS v4,
Wrangler, Vitest, Playwright, and Biome.

## License

Licensed under the **Business Source License 1.1 (BUSL-1.1)**. See the LICENSE file in this
repository for the full terms, the Additional Use Grant, the Change Date, and the Change
License (Apache 2.0).
