/**
 * @workerpress/core — öffentliche API-Oberfläche.
 */

export type { AdminCollectionSchema, AdminField, AdminFieldOptions } from './admin/schema.js';
export { adminSchema } from './admin/schema.js';
export type { IssuedToken, Scope, TokenPrincipal } from './auth/tokens.js';
export {
  apiTokensTableSql,
  createApiToken,
  hashToken,
  hasScope,
  listApiTokens,
  revokeApiToken,
  tokenToUser,
  verifyApiToken,
} from './auth/tokens.js';
export {
  readThroughContent,
  resolveRevalidateTargets,
  revalidateOnWrite,
  revalidatePaths,
  revalidateTag,
  siteCacheKey,
} from './cache/revalidate.js';
export type {
  CollectionInfo,
  DescribeRoutesOptions,
  RouteInfo,
} from './cli/describe.js';
export {
  collectionRoutes,
  describeCollectionsData,
  describeRoutesData,
  scaffoldCollection,
} from './cli/describe.js';
export { color, formatCollections, formatRoutes, renderOutput } from './cli/format.js';
export type { InspectOptions, InspectTarget } from './cli/inspect.js';
export { inspect } from './cli/inspect.js';
export type { CollectionClient, FindArgs, QueryClientOptions } from './client.js';
export { createQueryClient, findToQuery } from './client.js';
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
export type { AuditAction, AuditEntry, VersionRecord } from './db/history.js';
export {
  getVersion,
  listAudit,
  listVersions,
  platformTablesSql,
  recordAudit,
  recordVersion,
} from './db/history.js';
export type { GeneratedMigration, MigrationSnapshot, TableSql } from './db/migrate.js';
export { generateMigration, migrationSnapshot, tableToSql } from './db/migrate.js';
export type {
  FindOptions,
  FindWhere,
  WhereOperators,
  WhereValue,
} from './db/query.js';
export { buildConditions, normalizeOrderBy, parseFindQuery } from './db/query.js';
export type { CollectionRegistry } from './db/relations.js';
export { buildRegistry, parseInclude, resolveIncludes } from './db/relations.js';
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
export type { EventBusOptions, QueueTransport, SubscriberMap } from './events/bus.js';
export {
  collectSubscribers,
  createEventBus,
  deliverQueuedEvent,
  describeSubscribers,
} from './events/bus.js';
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
  CachePurge,
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
export type { RouteOptions } from './rest/routes.js';
export { contentRoutes, internalRoutes } from './rest/routes.js';
export type { TokenRoutesOptions } from './rest/tokens.js';
export { apiTokenAuth, tokenRoutes, tokenScopeGuard } from './rest/tokens.js';
export type { InferInsert, InferSelect, WithInclude } from './schema/types.js';
export type { CollectionSchemas } from './schema/zod.js';
export { collectionSchemas } from './schema/zod.js';
export type { SiteConfig, SiteRole } from './sites/index.js';
export {
  defineSite,
  describeSites,
  listSites,
  resolveSite,
  seedSites,
  sitesTableSql,
} from './sites/index.js';
