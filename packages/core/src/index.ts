/**
 * @workerpress/core — öffentliche API-Oberfläche.
 */

export type {
  CollectionConfig,
  CollectionHooks,
  CollectionLabels,
  HookFn,
  RevalidateTarget,
} from './collections/index.js';
export { defineCollection } from './collections/index.js';
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
export type {
  DrizzleDatabase,
  EventBus,
  KeyValue,
  ObjectStorage,
  Platform,
  SearchAdapter,
  SearchHit,
  SearchOpts,
} from './platform/index.js';
export type { AdminExtensions, AdminTableConfig, PluginConfig } from './plugins/index.js';
export { definePlugin } from './plugins/index.js';
export type { AccessRules, Policy, PolicyContext, PolicyFn } from './policies/index.js';
export { allOf, anyOf, definePolicy } from './policies/index.js';
