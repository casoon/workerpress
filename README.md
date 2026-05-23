# WorkerPress

Schema-getriebenes Edge-Application-Framework mit CMS-Fokus. Astro (UI) und Hono (API) in
einem einzigen Cloudflare Worker, getrieben von einer Quelle der Wahrheit (`defineCollection`).

**Multi-Site, nicht Multi-Tenant:** eine Installation liefert Inhalte für eine Hauptseite und
zugehörige Landingpages; eine Nutzergruppe verwaltet das gesamte Konstrukt.

> **Status:** Grundstruktur / Skelett. Die Pakete enthalten die öffentliche API-Oberfläche als
> Stubs — noch keine vollständige Implementierung. Abhängigkeiten sind noch nicht installiert.

## Monorepo

| Paket | Name | Zweck |
|---|---|---|
| `packages/core` | `@workerpress/core` | DSL, Generierung, Platform-Contract, `cms`-CLI |
| `packages/ui` | `@workerpress/ui` | geteilte Admin-Islands (Svelte) |
| `packages/create-app` | `create-workerpress` | `npm create workerpress` Scaffolder |
| `packages/plugins` | `@workerpress/plugin-*` | offizielle Plugins |
| `examples/starter` | — | Referenz-App |

## Konzept-Dokumente

Die Konzept-/Projektarbeit liegt im Nachbar-Ordner `headless-cms`:

- [../headless-cms/ARCHITECTURE.md](../headless-cms/ARCHITECTURE.md)
- [../headless-cms/STACK.md](../headless-cms/STACK.md)
- [../headless-cms/PORTABILITY.md](../headless-cms/PORTABILITY.md)
- [../headless-cms/README.md](../headless-cms/README.md)

## Erste Schritte (geplant)

```bash
npm install
npm run dev        # examples/starter
npm run cms inspect
```

## Lizenz

**Business Source License 1.1 (BUSL-1.1)** — siehe [LICENSE](./LICENSE).

- Erlaubt: Kopieren, Ändern, Weitergeben und **nicht-produktive** Nutzung; zusätzlich
  produktive Nutzung außer als konkurrierender Hosted-/Managed-Service (Additional Use Grant).
- **Change Date:** 2030-05-23 — danach gilt die **Apache License 2.0**.
- Parameter (Licensor, Additional Use Grant, Change Date, Change License) sind als Entwurf
  gesetzt und können noch angepasst werden.
