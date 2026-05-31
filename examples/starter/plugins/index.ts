/**
 * Plugin-Registry des Starters (M2-1). Ein Eintrag hier genügt — das Plugin wird
 * automatisch aufgelöst (Abhängigkeitsreihenfolge) und überall gemountet:
 * Worker-Routen, Migrations-Generierung und die `cms`-Befehle lesen dieselbe
 * Liste. Kein manuelles Mounten pro Oberfläche, kein `autoLoad: false`.
 *
 * Hinweis: Im Worker gibt es kein Dateisystem; deshalb IST dieses Barrel die
 * Discovery-Quelle (statt eines Laufzeit-Verzeichnis-Scans).
 */
import type { PluginConfig } from '@workerpress/core';
import comments from './comments/index.js';

export const plugins: PluginConfig[] = [comments];

export default plugins;
