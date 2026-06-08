# Query-Layer (M2-5)

Eine Abfrage, schema-getrieben — dieselbe Beschreibung speist RPC, REST, OpenAPI
und SQL. SQL wird ausschließlich parametrisiert gebaut (injection-sicher).

## Typsicherer RPC-Client

```ts
import { createQueryClient } from '@workerpress/core';
import blog from './collections/blog';

const api = createQueryClient({ blog }, { baseUrl: '', surface: 'content' });

const posts = await api.blog.find({
  where: { status: 'published' },     // je Feld auf erlaubte Operatoren getypt
  include: ['author'],                // nur Relation-Felder
  orderBy: '-publishedAt',            // Feldname, `-` = absteigend
  limit: 10,
});
```

## where-Operatoren (aus dem Field-System)

| Field-Typ | Operatoren |
|-----------|------------|
| text/slug/email/url | `eq`, `contains`, `in` |
| number    | `eq`, `gt`, `lt`, `gte`, `lte`, `in` |
| date      | `eq`, `gt`, `lt`, `gte`, `lte`, `between` |
| enum      | `eq`, `in` |
| boolean   | `eq` |
| relation  | `eq`, `in` |

## REST-Mapping

```http
GET /api/content/blog?where[status]=published&where[views][gt]=5&orderBy=-publishedAt&include=tags,author&limit=10
```

Flacher Shorthand `?status=published` (= `eq`) wird ebenfalls akzeptiert.

## Garantien

- Read-Policy filtert serverseitig **vor** der Relation-Auflösung.
- Multi-Site-Filter (M2-9): `(site = <aktiv> OR site IS NULL)` automatisch auf der
  Content-API.
- Unzulässige Operatoren / unbekannte Felder werden verworfen — die Query bleibt
  wohldefiniert.
