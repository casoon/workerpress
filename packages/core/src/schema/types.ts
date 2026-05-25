/**
 * TypeScript-Typen pro Collection (M1-6). Aus den Fields werden Row- (select)
 * und Insert-Typen abgeleitet — importierbar von Admin-UI und RPC, deckungsgleich
 * mit den Zod-`select`/`insert`-Schemas (ARCHITECTURE §5).
 */

import type { CollectionConfig } from '../collections/index.js';
import type { Field, FieldType } from '../fields/index.js';

type Opt<F> = F extends Field<FieldType, infer O> ? O : never;

/** Field-Typ -> TS-Wert-Typ (Datum als ISO-String, wie über die Wire-Grenze). */
type FieldValue<F> =
  F extends Field<infer K, infer O>
    ? K extends 'number'
      ? number
      : K extends 'boolean'
        ? boolean
        : K extends 'enum'
          ? O extends { values: readonly (infer V)[] }
            ? V
            : string
          : K extends 'relation'
            ? O extends { many: true }
              ? string[]
              : string
            : K extends 'richText' | 'json' | 'media' | 'array' | 'group'
              ? unknown
              : string
    : unknown;

type IsRequired<O> = O extends { required: true } ? true : false;
type HasDefault<O> = O extends { default: unknown } ? true : false;

type SelectRequiredKeys<F> = {
  [K in keyof F]-?: IsRequired<Opt<F[K]>> extends true ? K : never;
}[keyof F];

type InsertRequiredKeys<F> = {
  [K in keyof F]-?: IsRequired<Opt<F[K]>> extends true
    ? HasDefault<Opt<F[K]>> extends true
      ? never
      : K
    : never;
}[keyof F];

type Shape<F, Required extends keyof F> = {
  [K in Required]: FieldValue<F[K]>;
} & {
  [K in Exclude<keyof F, Required>]?: FieldValue<F[K]>;
};

/** Row-Typ (entspricht Zod `select`): id + alle Felder, required wie definiert. */
export type InferSelect<C> =
  C extends CollectionConfig<infer F> ? { id: string } & Shape<F, SelectRequiredKeys<F>> : never;

/** Insert-Typ (entspricht Zod `insert`): required ohne Default ist Pflicht. */
export type InferInsert<C> =
  C extends CollectionConfig<infer F> ? Shape<F, InsertRequiredKeys<F>> : never;
