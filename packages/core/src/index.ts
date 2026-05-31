/**
 * @workerpress/core — öffentliche API-Oberfläche.
 */

export type { AdminCollectionSchema, AdminField, AdminFieldOptions } from './admin/schema.js';
export { adminSchema } from './admin/schema.js';
export type { InspectOptions, InspectTarget } from './cli/inspect.js';
export { inspect } from './cli/inspect.js';
export type {
  CollectionConfig,
  CollectionHooks,
  CollectionLabels,
  HookContext,
  HookEntry,
  HookFn,
  PrioritizedHook,
  RevalidateTarget,
} from './collections/index.js';
export { defineCollection } from './collections/index.js';
export type {
  CollectionSnapshot,
  FieldSnapshot,
  SchemaChange,
  SchemaSnapshot,
} from './db/diff.js';
export { collectionSnapshot, diffCollections } from './db/diff.js';
export type { Fts5AdapterOptions } from './db/fts5.js';
export { createFts5SearchAdapter, searchableFields } from './db/fts5.js';
export type { GeneratedMigration, MigrationSnapshot, TableSql } from './db/migrate.js';
export { generateMigration, migrationSnapshot, tableToSql } from './db/migrate.js';
export type { CollectionRepository, ListOptions } from './db/repository.js';
export { collectionRepository } from './db/repository.js';
export type {
  ColumnDefault,
  DerivedColumn,
  DerivedIndex,
  DerivedTable,
  SqliteType,
} from './db/table.js';
export { deriveTable } from './db/table.js';
export type { CmsEventName, CmsEventPayloads, EventHandler } from './events/index.js';
export { emit } from './events/index.js';
export type {
  BaseFieldOptions,
  Field,
  FieldDefinition,
  Fields,
  FieldType,
} from './fields/index.js';
export { defineField, field } from './fields/index.js';
export { runHooks, sortHooks } from './hooks/index.js';
export type {
  AuthUser,
  AuthVerifier,
  DrizzleDatabase,
  EventBus,
  KeyValue,
  ObjectStorage,
  Platform,
  SearchAdapter,
  SearchableDoc,
  SearchHit,
  SearchOpts,
} from './platform/index.js';
export { noopAuth } from './platform/index.js';
export type {
  AdminExtensions,
  AdminNavItem,
  AdminTableConfig,
  PluginConfig,
  ResolvedPlugins,
} from './plugins/index.js';
export { definePlugin, describePlugins, resolvePlugins } from './plugins/index.js';
export type { AccessRules, Policy, PolicyContext, PolicyFn } from './policies/index.js';
export { allOf, anyOf, definePolicy } from './policies/index.js';
export type { OpenApiInfo } from './rest/openapi.js';
export { openApiDocument } from './rest/openapi.js';
export { contentRoutes, internalRoutes } from './rest/routes.js';
export type { InferInsert, InferSelect } from './schema/types.js';
export type { CollectionSchemas } from './schema/zod.js';
export { collectionSchemas } from './schema/zod.js';
