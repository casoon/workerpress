/**
 * Field-System — jedes Field kapselt DB, Validation, Renderer, Querying,
 * Serialization, Searchability und Filters. Siehe ARCHITECTURE §5.
 */

export type FieldType =
  | 'text'
  | 'richText'
  | 'markdown'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'slug'
  | 'media'
  | 'relation'
  | 'json'
  | 'email'
  | 'url'
  | 'array'
  | 'group';

export interface BaseFieldOptions {
  required?: boolean;
  indexed?: boolean;
  unique?: boolean;
  searchable?: boolean;
}

export interface Field<TType extends FieldType = FieldType, TOptions = BaseFieldOptions> {
  readonly kind: TType;
  readonly options: TOptions;
}

function make<TType extends FieldType, TOptions extends BaseFieldOptions>(
  kind: TType,
  options: TOptions = {} as TOptions,
): Field<TType, TOptions> {
  return { kind, options };
}

export interface TextOptions extends BaseFieldOptions {
  max?: number;
  min?: number;
  default?: string;
}
export interface SlugOptions extends BaseFieldOptions {
  from?: string;
}
export interface EnumOptions extends BaseFieldOptions {
  default?: string;
}
export interface MediaOptions extends BaseFieldOptions {
  accept?: string;
}
export interface RelationOptions extends BaseFieldOptions {
  to: string;
  many?: boolean;
}
export interface DateOptions extends BaseFieldOptions {
  default?: 'now';
}

/** Eingebaute Field-Builder. Erweiterbar über `defineField`. */
export const field = {
  text: (o?: TextOptions) => make('text', o),
  richText: (o?: BaseFieldOptions) => make('richText', o),
  markdown: (o?: BaseFieldOptions) => make('markdown', o),
  number: (o?: BaseFieldOptions) => make('number', o),
  boolean: (o?: BaseFieldOptions) => make('boolean', o),
  date: (o?: DateOptions) => make('date', o),
  enum: (values: string[], o?: EnumOptions) => make('enum', { ...o, values }),
  slug: (o?: SlugOptions) => make('slug', o),
  media: (o?: MediaOptions) => make('media', o),
  relation: (o: RelationOptions) => make('relation', o),
  json: (o?: BaseFieldOptions) => make('json', o),
  email: (o?: BaseFieldOptions) => make('email', o),
  url: (o?: BaseFieldOptions) => make('url', o),
} as const;

export type Fields = Record<string, Field>;

/**
 * Composite-/Custom-Field. Bündelt Sub-Fields, Renderer und Ausgabe-Integrationen
 * (meta/og/jsonLd/sitemap) — z. B. ein `seo`-Field. Siehe ARCHITECTURE §5.
 */
export interface FieldDefinition {
  type: string;
  fields?: Fields;
  renderer?: unknown;
  output?: Record<string, (value: unknown) => unknown>;
}

export function defineField(def: FieldDefinition): FieldDefinition {
  return def;
}
