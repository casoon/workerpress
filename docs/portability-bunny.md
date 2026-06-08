# Portabilitäts-Spike: Bunny über die Platform-Schicht (M0-8)

Ziel (timeboxed): zeigen, dass der `Platform`-Contract auch auf Bunny trägt —
ohne Portabilität zu versprechen, bevor der Spike grün ist (PORTABILITY §6).

Adapter: `@workerpress/bunny` (`packages/bunny/src/index.ts`).
Smoke: `packages/bunny/src/index.test.ts` (5 Tests, grün).

## Was getestet wurde

| Capability | Bunny-Umsetzung | Ergebnis |
|-----------|-----------------|----------|
| `db`      | Drizzle über libSQL (Bunny Database) | ✅ **Identischer Domänen-Code** — `generateMigration` + `collectionRepository` (Create/Read/Update/List/Delete) laufen unverändert wie auf D1. |
| `storage` | Bunny-Storage-HTTP-API (PUT/GET/DELETE, `AccessKey`-Header) | ✅ Put/Get/Delete + öffentliche Pull-Zone-URLs. |
| `kv`      | Fallback über libSQL-Tabelle `kv_store` (Bunny hat kein natives KV) | ✅ funktioniert (get/put/delete, TTL via `expires_at` + Lazy-Expiry). |
| `defer`   | Fire-and-Forget (kein `waitUntil`) | ⚠️ läuft, aber ohne Ausführungsgarantie. |

## KV-Fallback-Latenz

`~0.017 ms/op` gegen In-Memory-libSQL (50 put+get-Paare). Das ist die reine
Query-Zeit; gegen eine echte Bunny Database kommt **Netz-Roundtrip-Latenz** dazu
(zweistellige ms statt Edge-KV-Sub-ms). Für Cache-Read-Through okay als Fallback,
aber kein Ersatz für echtes Edge-KV bei hoher Lesefrequenz.

## Fazit — trägt der Contract?

**Ja, der Contract trägt.** Derselbe Domänen-Code (Repository, Migrationen,
Routen) läuft über `createBunnyPlatform` für DB + Storage ohne Änderung. Zwei
Stellen klemmen:

1. **KV** — kein natives Primitiv. Der libSQL-Tabellen-Fallback funktioniert, ist
   aber latenz- und lastseitig unterlegen. Für schreibintensive/häufig gelesene
   Keys eine bewusste Trade-off-Entscheidung.
2. **`defer`** — Bunny hat kein `waitUntil`. Hintergrundarbeit (Events,
   Such-Indizierung, Cache-Revalidation) läuft als Fire-and-Forget ohne Garantie;
   für Zuverlässigkeit braucht es eine echte Queue (analog Cloudflare Queues, M2-3).

Empfehlung: Bunny ist als DB/Storage-Ziel tragfähig; KV und deferred Work sind
die Punkte, die pro Plattform bewusst gelöst werden müssen.
