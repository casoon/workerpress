/**
 * OpenAPI-3.1-Dokument (M1-5) aus den Collection-Definitionen. Request-/Response-
 * Schemas stammen aus den Zod-Schemas (M1-3, via z.toJSONSchema); Pagination,
 * Sortierung und Feld-Filter sind als Query-Parameter beschrieben.
 */

import { z } from 'zod';
import type { CollectionConfig } from '../collections/index.js';
import { deriveTable } from '../db/table.js';
import { collectionSchemas } from '../schema/zod.js';

export interface OpenApiInfo {
  title?: string;
  version?: string;
}

type Json = Record<string, unknown>;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const idParam: Json = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

function jsonBody(schemaRef: Json): Json {
  return { required: true, content: { 'application/json': { schema: schemaRef } } };
}

function jsonResponse(description: string, schema: Json): Json {
  return { description, content: { 'application/json': { schema } } };
}

export function openApiDocument(collections: CollectionConfig[], info: OpenApiInfo = {}): Json {
  const schemas: Json = {};
  const paths: Json = {};

  for (const collection of collections) {
    const name = collection.name;
    const { insert, update, select } = collectionSchemas(collection);
    const selectName = cap(name);
    const insertName = `${selectName}Insert`;
    const updateName = `${selectName}Update`;
    // `unrepresentable: 'any'` => Felder ohne JSON-Schema-Abbildung (z. B. Date) werden zu {}.
    schemas[selectName] = z.toJSONSchema(select, { unrepresentable: 'any' });
    schemas[insertName] = z.toJSONSchema(insert, { unrepresentable: 'any' });
    schemas[updateName] = z.toJSONSchema(update, { unrepresentable: 'any' });

    const ref = (n: string): Json => ({ $ref: `#/components/schemas/${n}` });

    // Filterbare Spaltenfelder als Query-Parameter.
    const filterParams: Json[] = deriveTable(collection)
      .columns.filter((c) => !c.generatedFrom && c.name !== 'id' && c.name !== 'data')
      .map((c) => ({ name: c.name, in: 'query', schema: { type: 'string' } }));

    // Relation-Felder (M2-4): per `?include=` auflösbar.
    const relationKeys = Object.entries(collection.fields)
      .filter(([, f]) => f.kind === 'relation')
      .map(([key]) => key);
    const includeParam: Json[] = relationKeys.length
      ? [
          {
            name: 'include',
            in: 'query',
            description: `Komma-getrennte Relationen zum Auflösen: ${relationKeys.join(', ')}`,
            schema: { type: 'string' },
          },
        ]
      : [];

    const listParams: Json[] = [
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200 } },
      { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
      { name: 'orderBy', in: 'query', schema: { type: 'string' } },
      { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
      ...includeParam,
      ...filterParams,
    ];

    const listResponse = {
      '200': jsonResponse('List', { type: 'array', items: ref(selectName) }),
    };
    const itemResponse = {
      '200': jsonResponse('Item', ref(selectName)),
      '404': { description: 'Not found' },
    };

    paths[`/api/content/${name}`] = {
      get: { tags: ['content', name], parameters: listParams, responses: listResponse },
    };
    paths[`/api/content/${name}/{id}`] = {
      get: {
        tags: ['content', name],
        parameters: [idParam, ...includeParam],
        responses: itemResponse,
      },
    };
    paths[`/api/internal/content/${name}`] = {
      get: { tags: ['internal', name], parameters: listParams, responses: listResponse },
      post: {
        tags: ['internal', name],
        requestBody: jsonBody(ref(insertName)),
        responses: {
          '201': jsonResponse('Created', ref(selectName)),
          '400': { description: 'Invalid payload' },
        },
      },
    };
    paths[`/api/internal/content/${name}/{id}`] = {
      get: {
        tags: ['internal', name],
        parameters: [idParam, ...includeParam],
        responses: itemResponse,
      },
      put: {
        tags: ['internal', name],
        parameters: [idParam],
        requestBody: jsonBody(ref(updateName)),
        responses: itemResponse,
      },
      delete: {
        tags: ['internal', name],
        parameters: [idParam],
        responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: { title: info.title ?? 'WorkerPress API', version: info.version ?? '0.0.0' },
    paths,
    components: { schemas },
  };
}
