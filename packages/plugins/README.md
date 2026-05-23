# Offizielle WorkerPress-Plugins

Hier leben die offiziellen Plugins, veröffentlicht als `@workerpress/plugin-*`.

Jedes Plugin ist ein eigenes Workspace-Paket (`packages/plugins/<name>`) und nutzt
`definePlugin` aus `@workerpress/core`. Es kann Collections, Routes, Admin-Erweiterungen,
Hooks und Event-Subscriber mitbringen und wird per Auto-Discovery geladen
(siehe ARCHITECTURE §7).

Beispiel-Layout:

```
packages/plugins/
└── comments/
    ├── package.json     # @workerpress/plugin-comments
    └── src/index.ts     # export default definePlugin({ ... })
```
