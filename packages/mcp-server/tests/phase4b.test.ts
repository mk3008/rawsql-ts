import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRawsqlMcpServer } from '../src/server';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('MCP Phase 4B safe query slicing', () => {
  it('accepts every V1 selector segment emitted by full structure analysis', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    const cases = [
      'select id from orders',
      'with picked as (select id from orders) select * from picked',
      'select * from (select id from orders) picked',
      'select * from orders join (select order_id from payments) paid on paid.order_id = orders.id',
      'select (select max(amount) from payments) from orders',
      'select * from orders where exists (select 1 from payments where amount > 0)',
      'select * from orders where id in (select order_id from payments)',
      'select id from orders union all select id from archived_orders',
    ];
    try {
      const kinds = new Set<string>();
      for (const sql of cases) {
        const structure = result(await client.callTool({
          name: 'analyze_query_structure',
          arguments: { sql },
        })) as { scopes: Array<{ scopeKind: string; selector: object }> };
        for (const scope of structure.scopes) {
          kinds.add(scope.scopeKind);
          const sliced = await client.callTool({
            name: 'slice_query',
            arguments: { selector: scope.selector, sql },
          });
          expect(sliced.isError, JSON.stringify(scope.selector)).not.toBe(true);
        }
      }
      expect(kinds).toEqual(new Set([
        'root', 'cte', 'derived', 'scalar_subquery', 'exists', 'in_subquery', 'set_operation',
      ]));

      const listed = await client.listTools();
      const schema = listed.tools.find((tool) => tool.name === 'slice_query')?.inputSchema;
      const pathSchema = propertySchema(schema, 'selector', 'path');
      expect(pathSchema).toBeDefined();
      expect(pathSchema?.items).toEqual(expect.any(Object));
      expect(pathSchema?.items).not.toBeInstanceOf(Array);
      expect(pathSchema).not.toHaveProperty('additionalItems');
      expect(enumValuesForProperty(schema, 'clause')).toEqual([
        'fetch', 'from', 'group_by', 'having', 'join', 'limit', 'offset',
        'order_by', 'select', 'values', 'where', 'window',
      ]);
    } finally {
      await close();
    }
  });

  it.each([
    ['SELECT', 'select * from (select id from orders) picked'],
    ['CREATE TABLE AS SELECT', 'create table picked_orders as select * from (select id from orders) picked'],
    ['CREATE VIEW AS SELECT', 'create view picked_orders as select * from (select id from orders) picked'],
    ['INSERT SELECT', 'insert into picked_orders (id) select * from (select id from orders) picked'],
  ])('round-trips a full-analysis selector through slice_query for %s', async (_kind, sql) => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    try {
      const structure = result(await client.callTool({
        name: 'analyze_query_structure',
        arguments: { sql },
      })) as { scopes: Array<{ scopeKind: string; selector: object }> };
      const derived = structure.scopes.find((scope) => scope.scopeKind === 'derived');
      expect(derived).toBeDefined();

      const sliced = result(await client.callTool({
        name: 'slice_query',
        arguments: { selector: derived!.selector, sql },
      }));

      expect(sliced).toMatchObject({ scopeKind: 'derived', status: 'ready' });
      expect(sliced.sql).toEqual(expect.any(String));
    } finally {
      await close();
    }
  });

  it('separates malformed and stale selectors from domain blocked results', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    const derived = selector({ index: 0, kind: 'source_subquery', source: 'from' });
    try {
      const malformed = await client.callTool({
        name: 'slice_query',
        arguments: { selector: { path: [{ kind: 'root' }] }, sql: 'select 1' },
      });
      const unsupportedVersion = await client.callTool({
        name: 'slice_query',
        arguments: { selector: { path: [{ kind: 'root' }], version: 2 }, sql: 'select 1' },
      });
      const rootNotFirst = await client.callTool({
        name: 'slice_query',
        arguments: { selector: { path: [{ index: 0, kind: 'cte', name: 'picked' }], version: 1 }, sql: 'select 1' },
      });
      const repeatedRoot = await client.callTool({
        name: 'slice_query',
        arguments: { selector: { path: [{ kind: 'root' }, { kind: 'root' }], version: 1 }, sql: 'select 1' },
      });
      const stale = await client.callTool({
        name: 'slice_query',
        arguments: { selector: derived, sql: 'select id from orders' },
      });
      const invalidSql = await client.callTool({
        name: 'slice_query',
        arguments: { selector: rootSelector(), sql: 'select * from' },
      });

      expect(malformed.isError).toBe(true);
      expect(unsupportedVersion.isError).toBe(true);
      expect(rootNotFirst.isError).toBe(true);
      expect(repeatedRoot.isError).toBe(true);
      expect(failure(stale)).toMatchObject({ code: 'SCOPE_SELECTOR_NOT_FOUND', kind: 'invalid_input' });
      expect(failure(invalidSql)).toMatchObject({ code: 'SOURCE_SQL_INVALID', kind: 'invalid_input' });
    } finally {
      await close();
    }
  });

  it('returns ready SQL for a safe slice and no SQL for correlated or unresolved scopes', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    try {
      const ready = result(await client.callTool({
        name: 'slice_query',
        arguments: {
          selector: selector({ index: 0, kind: 'source_subquery', source: 'from' }),
          sql: 'select * from (select o.id from orders o) picked',
        },
      }));
      expect(ready).toMatchObject({
        kind: 'query-slice',
        outerReferenceStatus: 'none',
        scopeKind: 'derived',
        status: 'ready',
        version: 1,
      });
      expect(ready.sql).toEqual(expect.any(String));

      const correlated = result(await client.callTool({
        name: 'slice_query',
        arguments: {
          selector: selector({ clause: 'where', index: 0, kind: 'expression_subquery', subqueryKind: 'exists' }),
          sql: 'select * from orders o where exists (select 1 from payments p where p.order_id = o.order_id)',
        },
      }));
      expect(correlated).toMatchObject({
        diagnostics: [{ code: 'SCOPE_CORRELATED' }],
        outerReferenceStatus: 'correlated',
        status: 'blocked',
      });
      expect(correlated).not.toHaveProperty('sql');

      const unresolved = result(await client.callTool({
        name: 'slice_query',
        arguments: {
          selector: selector({ clause: 'select', index: 0, kind: 'expression_subquery', subqueryKind: 'scalar_subquery' }),
          sql: 'select (select amount from payments p) from orders o',
        },
      }));
      expect(unresolved).toMatchObject({
        diagnostics: [{ code: 'SCOPE_REFERENCE_UNRESOLVED' }],
        status: 'blocked',
      });
      expect(unresolved).not.toHaveProperty('sql');

      const unsafeSql = `select * from orders o join lateral (
        select (select max(p.amount) from payments p where p.order_id = o.id) as amount
      ) picked on true`;
      const structure = result(await client.callTool({
        name: 'analyze_query_structure',
        arguments: { sql: unsafeSql },
      })) as { scopes: Array<{ scopeKind: string; selector: object }> };
      const derived = structure.scopes.find((scope) => scope.scopeKind === 'derived');
      const descendantEscape = result(await client.callTool({
        name: 'slice_query',
        arguments: { selector: derived!.selector, sql: unsafeSql },
      }));
      expect(descendantEscape).toMatchObject({
        diagnostics: [{ code: 'SCOPE_REFERENCE_UNRESOLVED' }],
        status: 'blocked',
      });
      expect(descendantEscape).not.toHaveProperty('sql');
    } finally {
      await close();
    }
  });

  it('keeps the Product Gate compound EXISTS selector semantic and fail-closed', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    const sql = `select *
      from orders o
      where exists (
        select 1
        from payments p
        where p.order_id = o.order_id
      )
      and o.customer_id = :customer_id`;
    try {
      const structureResponse = await client.callTool({
        name: 'analyze_query_structure',
        arguments: { sql, view: 'full' },
      });
      expect(structureResponse.isError).not.toBe(true);
      const structure = result(structureResponse) as {
        scopes: Array<{ scopeKind: string; selector: { path: Array<Record<string, unknown>>; version: number } }>;
      };
      const existsScopes = structure.scopes.filter((scope) => scope.scopeKind === 'exists');

      expect(existsScopes).toHaveLength(1);
      expect(existsScopes[0].selector).toEqual(selector({
        clause: 'where',
        index: 0,
        kind: 'expression_subquery',
        subqueryKind: 'exists',
      }));

      const sliceResponse = await client.callTool({
        name: 'slice_query',
        arguments: { selector: existsScopes[0].selector, sql },
      });
      expect(sliceResponse.isError).not.toBe(true);
      const sliced = result(sliceResponse);
      expect(sliced).toMatchObject({
        diagnostics: [{ code: 'SCOPE_CORRELATED' }],
        outerReferenceStatus: 'correlated',
        scopeKind: 'exists',
        status: 'blocked',
      });
      expect(sliced).not.toHaveProperty('sql');
    } finally {
      await close();
    }
  });

  it('uses the common DDL resolver to turn a provable scope from blocked to ready', async () => {
    const workspace = temporaryWorkspace();
    mkdirSync(resolve(workspace, 'schema'));
    writeFileSync(resolve(workspace, 'schema', 'tables.sql'), [
      'create table orders (order_id bigint);',
      'create table payments (amount numeric);',
    ].join('\n'));
    const { client, close } = await connectedClient(workspace);
    const argumentsBase = {
      selector: selector({ clause: 'select', index: 0, kind: 'expression_subquery', subqueryKind: 'scalar_subquery' }),
      sql: 'select (select amount from payments p) from orders o',
    };
    try {
      const withoutDdl = result(await client.callTool({ name: 'slice_query', arguments: argumentsBase }));
      const withDdl = result(await client.callTool({
        name: 'slice_query',
        arguments: { ...argumentsBase, ddlPaths: 'schema' },
      }));

      expect(withoutDdl).toMatchObject({ outerReferenceStatus: 'unresolved', status: 'blocked' });
      expect(withDdl).toMatchObject({ outerReferenceStatus: 'none', status: 'ready' });
    } finally {
      await close();
    }
  });

  it('formats only ready generated SQL with config and inline precedence without mutating files', async () => {
    const workspace = temporaryWorkspace();
    const configPath = resolve(workspace, 'formatter.json');
    const originalConfig = JSON.stringify({ keywordCase: 'upper' });
    writeFileSync(configPath, originalConfig);
    const { client, close } = await connectedClient(workspace);
    const argumentsBase = {
      selector: rootSelector(),
      sql: 'select id from orders where id > 0',
    };
    try {
      const omitted = result(await client.callTool({ name: 'slice_query', arguments: argumentsBase }));
      const config = result(await client.callTool({
        name: 'slice_query',
        arguments: { ...argumentsBase, format: { configPath: 'formatter.json' } },
      }));
      const inline = result(await client.callTool({
        name: 'slice_query',
        arguments: { ...argumentsBase, format: { options: { keywordCase: 'lower' } } },
      }));
      const precedence = result(await client.callTool({
        name: 'slice_query',
        arguments: {
          ...argumentsBase,
          format: { configPath: 'formatter.json', options: { keywordCase: 'lower' } },
        },
      }));

      expect(config.sql).toContain('SELECT');
      expect(inline.sql).toContain('select');
      expect(precedence.sql).toContain('select');
      expect(precedence.sql).not.toContain('SELECT');
      expect(omitted.selector).toEqual(config.selector);
      expect(omitted.directCteNames).toEqual(config.directCteNames);
      expect(readFileSync(configPath, 'utf8')).toBe(originalConfig);

      const correlatedArguments = {
        format: { options: { keywordCase: 'upper' } },
        selector: selector({ clause: 'where', index: 0, kind: 'expression_subquery', subqueryKind: 'exists' }),
        sql: 'select * from orders o where exists (select 1 from payments p where p.order_id = o.order_id)',
      };
      const blockedFormatted = result(await client.callTool({ name: 'slice_query', arguments: correlatedArguments }));
      const blockedDefault = result(await client.callTool({
        name: 'slice_query',
        arguments: { ...correlatedArguments, format: undefined },
      }));
      expect(blockedFormatted).toEqual(blockedDefault);
      expect(blockedFormatted).not.toHaveProperty('sql');
    } finally {
      await close();
    }
  });
});

async function connectedClient(workspace: string): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createRawsqlMcpServer(workspace);
  const client = new Client({ name: 'rawsql-mcp-phase4b-test', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function temporaryWorkspace(): string {
  const directory = mkdtempSync(resolve(tmpdir(), 'rawsql-ts-mcp-phase4b-'));
  temporaryDirectories.push(directory);
  return directory;
}

function result(response: unknown): Record<string, unknown> {
  const value = response as { structuredContent?: Record<string, unknown> };
  if (!value.structuredContent) throw new Error('Expected structured tool result.');
  return value.structuredContent;
}

function failure(response: unknown): Record<string, unknown> {
  const value = response as { content: Array<{ text: string }> };
  return JSON.parse(value.content[0].text) as Record<string, unknown>;
}

function rootSelector(): object {
  return { path: [{ kind: 'root' }], version: 1 };
}

function selector(...path: object[]): object {
  return { path: [{ kind: 'root' }, ...path], version: 1 };
}

function enumValuesForProperty(value: unknown, propertyName: string): string[] {
  const found = new Set<string>();
  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object') return;
    const record = candidate as Record<string, unknown>;
    const properties = record.properties;
    if (properties && typeof properties === 'object') {
      const property = (properties as Record<string, unknown>)[propertyName];
      if (property && typeof property === 'object') {
        const values = (property as Record<string, unknown>).enum;
        if (Array.isArray(values)) values.forEach((item) => typeof item === 'string' && found.add(item));
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return [...found].sort();
}

function propertySchema(value: unknown, ...path: string[]): Record<string, unknown> | undefined {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== 'object') return undefined;
    const properties = (current as Record<string, unknown>).properties;
    if (!properties || typeof properties !== 'object') return undefined;
    current = (properties as Record<string, unknown>)[segment];
  }
  return current && typeof current === 'object' ? current as Record<string, unknown> : undefined;
}
