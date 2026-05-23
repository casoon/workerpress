/**
 * @workerpress/core — öffentliche API-Oberfläche.
 */

export { defineCollection } from './collections/index.js';
export type {
  CollectionConfig,
  CollectionHooks,
  CollectionLabels,
  HookFn,
  RevalidateTarget,
} from './collections/index.js';

export { field, defineField } from './fields/index.js';
export type {
  Field,
  FieldType,
  Fields,
  FieldDefinition,
  BaseFieldOptions,
} from './fields/index.js';

export { definePolicy, allOf, anyOf } from './policies/index.js';
export type { Policy, PolicyFn, PolicyContext, AccessRules } from './policies/index.js';

export { definePlugin } from './plugins/index.js';
export type { PluginConfig, AdminExtensions, AdminTableConfig } from './plugins/index.js';

export { emit } from './events/index.js';
export type { CmsEventName, CmsEventPayloads, EventHandler } from './events/index.js';

export type {
  Platform,
  ObjectStorage,
  KeyValue,
  SearchAdapter,
  SearchHit,
  SearchOpts,
  EventBus,
  DrizzleDatabase,
} from './platform/index.js';
