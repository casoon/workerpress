# Policies, Hooks & Events

Drei getrennte Erweiterungspunkte mit klaren Garantien.

## Policies (Access Control)

Policies entscheiden Lese-/Schreibzugriff. Sie greifen in REST **und** im
Query-Layer (serverseitige Filterung — kein Datenleck).

```ts
import { allOf, anyOf, definePolicy } from '@workerpress/core';

const isPublished = definePolicy('isPublished', ({ doc }) => doc?.status === 'published');
const isEditor = definePolicy('isEditor', ({ user }) => user?.groups?.includes('editor'));

defineCollection({
  name: 'blog',
  fields: { /* … */ },
  access: { read: anyOf(isPublished, isEditor), write: isEditor },
});
```

- Read-Deny auf Einzeldatensatz → 404 (Existenz wird nicht geleakt).
- Write-Deny → 403 (+ `access-denied`-Eintrag im Audit-Log, M2-6).

## Hooks (synchron, im Request-Pfad) — M2-2

`beforeChange` darf `doc` mutieren oder mit `throw` abbrechen (→ 422).
`afterChange` läuft nach erfolgreichem Schreiben. Prioritätsgeordnet (`priority`,
niedriger = früher).

```ts
hooks: {
  beforeChange: [
    ({ doc }) => { if (!doc.slug) doc.slug = slugify(doc.title); },
    { handler: guard, priority: -10 }, // läuft zuerst
  ],
}
```

## Events (asynchron, nach der Response) — M2-3

Entkoppelte Seiteneffekte (Webhooks, Such-Index, E-Mail). Subscriber via
`definePlugin({ on })`. Zustellung über `platform.defer` mit Retry (exp. Backoff,
max. 3); ein fehlerhafter Subscriber blockt nie die Response. Optionaler
Cloudflare-Queues-Transport.

```ts
definePlugin({
  name: 'webhooks',
  version: '1.0.0',
  on: {
    'content.published': async ({ collection, id }, { platform }) => {
      await fetch('https://hooks.example.com', { method: 'POST', body: JSON.stringify({ collection, id }) });
    },
  },
});
```

Events: `content.created`, `content.published`, `content.deleted`, `media.uploaded`.
