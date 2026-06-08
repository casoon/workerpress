# CI-Gate mit `cms doctor` (M3-2)

`cms doctor` ist ein maschinell auswertbarer Health-Check, der vor dem Deploy
Migration-Drift, Schema-Breaks, fehlende Indizes, Bindings und Secrets aufdeckt.
Bei einem Fehler endet der Prozess mit Exit-Code `1` — ideal als CI-Schranke.

```bash
# Voller Health-Check (Exit 1 bei Fehlern)
pnpm cms doctor

# Maschinenlesbar
pnpm cms doctor --json

# Dry-Run-Gate nur für Breaking-Schema-Changes
pnpm cms inspect --migrations --gate
```

## GitHub Actions

```yaml
name: deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      # --- Gates vor dem Deploy ---
      - run: pnpm --filter workerpress-starter typecheck
      - run: pnpm -r test
      # Health-Check: bricht bei Migration-Drift, Breaking-Changes oder fehlenden Secrets ab.
      - run: pnpm --filter workerpress-starter cms doctor
        env:
          ACCESS_TEAM_DOMAIN: ${{ secrets.ACCESS_TEAM_DOMAIN }}

      # --- Deploy (nur wenn alle Gates grün sind) ---
      - run: pnpm --filter workerpress-starter deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

> Live-Checks (`bindings`, `tables`) werden als `skipped` markiert, wenn kein
> Worker-/D1-Kontext vorhanden ist — so wird CI nie fälschlich grün. Für echte
> Binding-/Tabellen-Prüfungen den Check im Worker oder via `wrangler d1` ausführen.
