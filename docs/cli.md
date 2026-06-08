# CLI-Referenz (`cms`)

Im Projekt: `npm run cms <command>` (bzw. `pnpm cms …`). Alle Befehle unterstützen
`--json` für maschinenlesbare Ausgabe.

| Befehl | Beschreibung |
|--------|--------------|
| `inspect [collection] [flags]` | Generierte Realität: Tabelle, Routen, Schemas, Hooks, Policies, Forms, Suche, Migration. Flags: `--routes --schema --migrations --hooks --policies --forms --search`. |
| `inspect --migrations --gate` | Dry-Run-Gate: Exit 1 bei Breaking-Changes. |
| `routes` | Alle Routen (generiert + Plugin + System) mit Methode/Pfad/Auth/Surface. |
| `collections` | Registrierte Collections: Version, Feld-Anzahl, Policy-Namen, Hooks, searchable. |
| `migrations` | Angewandte Migrationen vs. ausstehende Schema-Drift + Breaking-Warnungen. |
| `doctor` | Health-Check (Bindings, Secrets, Migration-Drift, Schema-Breaks, Tabellen). Exit 1 bei Fehlern — CI-Gate. |
| `plugins` | Entdeckte Plugins + Event-Subscriber + Admin-Erweiterungen. |
| `sites` | Multi-Site-Register (Rolle, Host, Pfad-Präfix). |
| `generate collection <name>` | Scaffoldet `collections/<name>.ts` mit Defaults. |

## Beispiele

```bash
npm run cms routes
npm run cms collections --json
npm run cms inspect blog
npm run cms doctor                       # Exit 1 bei Problemen
npm run cms inspect --migrations --gate  # CI-Schranke
npm run cms generate collection products
```

Siehe auch [CI/CD-Gate](./ci.md).
