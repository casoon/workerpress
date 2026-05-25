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

/**
 * Eingebaute Field-Builder. `const`-Generics bewahren die Optionen (required,
 * enum-Werte, relation.many) auf Typebene, damit pro Collection Row-/Insert-Typen
 * abgeleitet werden können (M1-6). Erweiterbar über `defineField`.
 */
export const field = {
  text: <const O extends TextOptions>(o?: O) => make('text', (o ?? {}) as O),
  richText: <const O extends BaseFieldOptions>(o?: O) => make('richText', (o ?? {}) as O),
  markdown: <const O extends BaseFieldOptions>(o?: O) => make('markdown', (o ?? {}) as O),
  number: <const O extends BaseFieldOptions>(o?: O) => make('number', (o ?? {}) as O),
  boolean: <const O extends BaseFieldOptions>(o?: O) => make('boolean', (o ?? {}) as O),
  date: <const O extends DateOptions>(o?: O) => make('date', (o ?? {}) as O),
  enum: <const V extends string, const O extends EnumOptions = EnumOptions>(
    values: readonly V[],
    o?: O,
  ): Field<'enum', O & { values: readonly V[] }> =>
    ({ kind: 'enum', options: { ...o, values } }) as Field<'enum', O & { values: readonly V[] }>,
  slug: <const O extends SlugOptions>(o?: O) => make('slug', (o ?? {}) as O),
  media: <const O extends MediaOptions>(o?: O) => make('media', (o ?? {}) as O),
  relation: <const O extends RelationOptions>(o: O) => make('relation', o),
  json: <const O extends BaseFieldOptions>(o?: O) => make('json', (o ?? {}) as O),
  email: <const O extends BaseFieldOptions>(o?: O) => make('email', (o ?? {}) as O),
  url: <const O extends BaseFieldOptions>(o?: O) => make('url', (o ?? {}) as O),
} as const;

// Options-Typ bewusst weit (Record statt BaseFieldOptions), damit die per
// const-Generic erhaltenen Feld-Optionen (z. B. { to: 'users' }) zuweisbar sind.
export type Fields = Record<string, Field<FieldType, Record<string, unknown>>>;

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
