import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRawsqlMcpServer } from '../src/server';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('MCP Phase 2 common I/O integration', () => {
  it('loads directory DDL for all three analysis tools', async () => {
    const workspace = temporaryWorkspace();
    mkdirSync(resolve(workspace, 'schema'));
    writeFileSync(resolve(workspace, 'schema', 'customers.sql'), [
      'create table public.customers (',
      '  customer_id bigint primary key',
      ');',
    ].join('\n'));
    writeFileSync(resolve(workspace, 'schema', 'orders.sql'), [
      'create table public.orders (',
      '  order_id bigint primary key,',
      '  customer_id bigint not null,',
      '  amount numeric not null,',
      '  foreign key (customer_id) references public.customers(customer_id)',
      ');',
    ].join('\n'));
    const { client, close } = await connectedClient(workspace);
    try {
      const structure = result(await client.callTool({
        name: 'analyze_query_structure',
        arguments: { ddlPaths: 'schema', sql: 'select * from public.orders' },
      }));
      expect(structure).toMatchObject({ summary: { outputColumnCount: 3 } });

      const lineage = result(await client.callTool({
        name: 'analyze_column_lineage',
        arguments: { ddlPaths: ['schema'], sql: 'select * from public.orders', targetColumn: 'amount' },
      }));
      expect(lineage).toMatchObject({
        target: { columnName: 'amount' },
        columnLineage: { sourceLeaves: [expect.objectContaining({ columnName: 'amount' })] },
      });

      const fixture = result(await client.callTool({
        name: 'create_fixture_extraction_plan',
        arguments: {
          ddlPaths: 'schema',
          sql: 'select customer_id, amount from public.orders where customer_id = :customer_id',
        },
      }));
      expect(fixture).toMatchObject({ status: 'ready', steps: [expect.objectContaining({ sql: expect.any(String) })] });
    } finally {
      await close();
    }
  });

  it('combines inline and path DDL and returns confined-path failures as stable MCP errors', async () => {
    const workspace = temporaryWorkspace();
    mkdirSync(resolve(workspace, 'schema'));
    writeFileSync(resolve(workspace, 'schema', 'orders.sql'), 'create table public.orders (order_id bigint primary key);');
    const outside = temporaryWorkspace();
    writeFileSync(resolve(outside, 'outside.sql'), 'create table escaped (id bigint);');
    const { client, close } = await connectedClient(workspace);
    try {
      const combined = await client.callTool({
        name: 'analyze_query_structure',
        arguments: {
          ddl: 'create table public.extra_records (record_id bigint primary key);',
          ddlPaths: 'schema/orders.sql',
          sql: 'select orders.order_id, extra_records.record_id from public.orders cross join public.extra_records',
        },
      });
      expect(combined.isError).not.toBe(true);

      const escaped = await client.callTool({
        name: 'analyze_query_structure',
        arguments: {
          ddlPaths: relative(workspace, resolve(outside, 'outside.sql')),
          sql: 'select 1',
        },
      });
      expect(escaped.isError).toBe(true);
      expect(failure(escaped)).toMatchObject({ code: 'WORKSPACE_PATH_TRAVERSAL', kind: 'invalid_input' });
    } finally {
      await close();
    }
  });

  it('preserves the existing inline DDL size error while path DDL uses common resolver limits', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    try {
      const oversized = await client.callTool({
        name: 'analyze_query_structure',
        arguments: { ddl: 'x'.repeat(1024 * 1024 + 1), sql: 'select 1' },
      });
      expect(oversized.isError).toBe(true);
      expect(failure(oversized)).toMatchObject({ code: 'INPUT_SIZE_LIMIT', kind: 'invalid_input' });
    } finally {
      await close();
    }
  });

  it('formats only explicit generated artifacts for all four SQL-producing tools', async () => {
    const workspace = temporaryWorkspace();
    writeFileSync(resolve(workspace, 'upper.json'), JSON.stringify({ keywordCase: 'upper' }));
    const { client, close } = await connectedClient(workspace);
    try {
      const cteArguments = {
        cteName: 'filtered',
        sql: 'with filtered as (select id from orders where id > 10) select * from filtered',
      };
      const cteDefault = result(await client.callTool({ name: 'extract_cte_query', arguments: cteArguments }));
      const cteConfig = result(await client.callTool({
        name: 'extract_cte_query',
        arguments: { ...cteArguments, format: { configPath: 'upper.json' } },
      }));
      const cteInline = result(await client.callTool({
        name: 'extract_cte_query',
        arguments: { ...cteArguments, format: { options: { keywordCase: 'lower' } } },
      }));
      const ctePrecedence = result(await client.callTool({
        name: 'extract_cte_query',
        arguments: {
          ...cteArguments,
          format: { configPath: 'upper.json', options: { keywordCase: 'lower' } },
        },
      }));
      expect(cteConfig.executableSql).toContain('SELECT');
      expect(cteInline.executableSql).toContain('select');
      expect(ctePrecedence.executableSql).toContain('select');
      expect(cteDefault).toMatchObject({ kind: 'cte-query-extraction', version: 1 });

      const fixtureArguments = {
        ddl: 'create table orders (order_id bigint primary key, customer_id bigint not null);',
        sql: 'select order_id from orders where customer_id = :customer_id',
      };
      const fixtureDefault = result(await client.callTool({ name: 'create_fixture_extraction_plan', arguments: fixtureArguments }));
      const fixtureConfig = result(await client.callTool({
        name: 'create_fixture_extraction_plan',
        arguments: { ...fixtureArguments, format: { configPath: 'upper.json' } },
      }));
      const fixtureInline = result(await client.callTool({
        name: 'create_fixture_extraction_plan',
        arguments: { ...fixtureArguments, format: { options: { keywordCase: 'lower' } } },
      }));
      expect(firstStepSql(fixtureConfig)).toContain('SELECT');
      expect(firstStepSql(fixtureInline)).toContain('select');
      expect(fixtureConfig.source).toEqual(fixtureDefault.source);
      expect(fixtureConfig.sourceEvidence).toEqual(fixtureDefault.sourceEvidence);

      const partialFixture = result(await client.callTool({
        name: 'create_fixture_extraction_plan',
        arguments: {
          ddl: 'create table root_record (root_id integer primary key); create table level_a (a_id integer primary key, root_id integer not null);',
          format: { configPath: 'upper.json' },
          sql: 'select r.root_id, a.a_id from root_record r join level_a a on a.root_id = r.root_id where r.root_id = :root_id',
        },
      }));
      expect((partialFixture.steps as Array<{ sql: string | null }>).some((step) => step.sql === null)).toBe(true);

      const lineageArguments = {
        sql: 'select amount from orders where customer_id = :customer_id',
        targetColumn: 'amount',
      };
      const lineageDefault = result(await client.callTool({ name: 'analyze_column_lineage', arguments: lineageArguments }));
      const lineageConfig = result(await client.callTool({
        name: 'analyze_column_lineage',
        arguments: { ...lineageArguments, format: { configPath: 'upper.json' } },
      }));
      const lineageInline = result(await client.callTool({
        name: 'analyze_column_lineage',
        arguments: { ...lineageArguments, format: { options: { keywordCase: 'lower' } } },
      }));
      expect(firstProbeSql(lineageConfig)).toContain('SELECT');
      expect(firstProbeSql(lineageInline)).toContain('select');
      expect(lineageConfig.columnLineage).toEqual(lineageDefault.columnLineage);
      expect((lineageConfig.investigationPlan as Record<string, unknown>).originalQuery)
        .toEqual((lineageDefault.investigationPlan as Record<string, unknown>).originalQuery);

      const optimizeArguments = {
        sql: 'select orders.id from orders join customers on customers.customer_id = orders.customer_id where customers.status = :status',
      };
      const optimizeDefault = result(await client.callTool({ name: 'optimize_sql_conditions', arguments: optimizeArguments }));
      const optimizeConfig = result(await client.callTool({
        name: 'optimize_sql_conditions',
        arguments: { ...optimizeArguments, format: { configPath: 'upper.json' } },
      }));
      const optimizeInline = result(await client.callTool({
        name: 'optimize_sql_conditions',
        arguments: { ...optimizeArguments, format: { options: { keywordCase: 'lower' } } },
      }));
      expect(optimizeConfig.sql).toContain('SELECT');
      expect(optimizeInline.sql).toContain('select');
      expect(firstSuggestedSql(optimizeConfig)).toContain('SELECT');
      expect(firstSuggestedSql(optimizeInline)).toContain('select');
      expect(firstProbe(optimizeConfig).predicate).toBe(firstProbe(optimizeDefault).predicate);
    } finally {
      await close();
    }
  });

  it('returns formatter path and option failures through the stable MCP input-error contract', async () => {
    const workspace = temporaryWorkspace();
    writeFileSync(resolve(workspace, 'unknown.json'), JSON.stringify({ notAFormatterOption: true }));
    const { client, close } = await connectedClient(workspace);
    const argumentsBase = {
      cteName: 'filtered',
      sql: 'with filtered as (select id from orders) select * from filtered',
    };
    try {
      const missing = await client.callTool({
        name: 'extract_cte_query',
        arguments: { ...argumentsBase, format: { configPath: 'missing.json' } },
      });
      expect(missing.isError).toBe(true);
      expect(failure(missing)).toMatchObject({ code: 'WORKSPACE_PATH_NOT_FOUND', kind: 'invalid_input' });

      const unknown = await client.callTool({
        name: 'extract_cte_query',
        arguments: { ...argumentsBase, format: { configPath: 'unknown.json' } },
      });
      expect(unknown.isError).toBe(true);
      expect(failure(unknown)).toMatchObject({ code: 'FORMAT_OPTION_UNKNOWN', kind: 'invalid_input' });
    } finally {
      await close();
    }
  });

  it('preserves failed condition-optimization diagnostics when formatting is requested', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    const sql = 'select * from';
    try {
      const withoutFormatResponse = await client.callTool({
        name: 'optimize_sql_conditions',
        arguments: { sql },
      });
      const withFormatResponse = await client.callTool({
        name: 'optimize_sql_conditions',
        arguments: { format: { options: { keywordCase: 'upper' } }, sql },
      });
      expect(withoutFormatResponse.isError).not.toBe(true);
      expect(withFormatResponse.isError).not.toBe(true);

      const withoutFormat = result(withoutFormatResponse);
      const withFormat = result(withFormatResponse);
      expect(withoutFormat).toMatchObject({ ok: false, sql, errors: expect.any(Array) });
      expect(withFormat).toMatchObject({ ok: false, sql, errors: withoutFormat.errors });
      expect((withFormat.errors as unknown[]).length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  it('returns explicit compact DTOs while omitted and full preserve complete analysis output', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    const sql = `with order_totals as (
      select customer_id, sum(amount) as total from orders group by customer_id
    ) select total from (select total from order_totals) nested where total > 0 order by total`;
    try {
      const structureDefault = result(await client.callTool({ name: 'analyze_query_structure', arguments: { sql } }));
      const structureFull = result(await client.callTool({ name: 'analyze_query_structure', arguments: { sql, view: 'full' } }));
      const structureCompact = result(await client.callTool({ name: 'analyze_query_structure', arguments: { sql, view: 'compact' } }));
      expect(structureFull).toEqual(structureDefault);
      expect(structureFull.scopes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scopeKind: 'root',
          selector: { path: [{ kind: 'root' }], version: 1 },
        }),
      ]));
      expect(structureCompact).toMatchObject({
        kind: 'query-structure-analysis-compact',
        view: 'compact',
        cteNames: ['order_totals'],
        physicalTableNames: ['orders'],
        summary: expect.any(Object),
      });
      expect(structureCompact.operationSummaries).toContainEqual({
        count: 1,
        effects: ['may_change_order'],
        kind: 'order_by',
      });
      expect(structureCompact).not.toHaveProperty('rowSetChangingOperations');
      expect(structureCompact).not.toHaveProperty('components');
      expect(structureCompact).not.toHaveProperty('operations');
      expect(structureCompact).not.toHaveProperty('scopes');
      expect(JSON.stringify(structureCompact)).not.toContain('selector');

      const lineageDefault = result(await client.callTool({
        name: 'analyze_column_lineage',
        arguments: { sql, targetColumn: 'total' },
      }));
      const lineageFull = result(await client.callTool({
        name: 'analyze_column_lineage',
        arguments: { sql, targetColumn: 'total', view: 'full' },
      }));
      const lineageCompact = result(await client.callTool({
        name: 'analyze_column_lineage',
        arguments: { sql, targetColumn: 'total', view: 'compact' },
      }));
      expect(lineageFull).toEqual(lineageDefault);
      expect(lineageCompact).toMatchObject({
        kind: 'column-lineage-analysis-compact',
        view: 'compact',
        target: { columnName: 'total' },
        columnLineage: { sourceLeaves: expect.any(Array), summary: expect.any(Object) },
        candidateConcerns: expect.any(Array),
        diagnostics: expect.any(Array),
        omittedContext: expect.any(Object),
        investigationSummary: expect.any(Object),
      });
      expect(lineageCompact).not.toHaveProperty('views');
      expect(lineageCompact).not.toHaveProperty('investigationPlan');
      expect((lineageCompact.columnLineage as Record<string, unknown>)).not.toHaveProperty('expressionChain');
      expect(JSON.stringify(lineageCompact)).not.toContain('investigation_probe');

      const mixedProbeSql = 'select sum(amount) as total from orders where customer_id = :customer_id';
      const mixedProbeFull = result(await client.callTool({
        name: 'analyze_column_lineage',
        arguments: { sql: mixedProbeSql, targetColumn: 'total' },
      }));
      const mixedProbeCompact = result(await client.callTool({
        name: 'analyze_column_lineage',
        arguments: { sql: mixedProbeSql, targetColumn: 'total', view: 'compact' },
      }));
      const fullPlan = mixedProbeFull.investigationPlan as Record<string, unknown[]>;
      expect(fullPlan.blockedProbes.length).toBeGreaterThan(0);
      expect(fullPlan.recommendedProbes.length).toBeGreaterThan(0);
      expect(mixedProbeCompact.investigationSummary).toMatchObject({
        blockedProbeCount: fullPlan.blockedProbes.length,
        deferredProbeCount: fullPlan.deferredProbes.length,
        recommendedProbeCount: fullPlan.recommendedProbes.length,
        unresolvedParameterCount: fullPlan.unresolvedParameters.length,
      });
      expect(mixedProbeCompact).not.toHaveProperty('status');
      expect(JSON.stringify(mixedProbeCompact)).not.toContain('investigation_probe');
    } finally {
      await close();
    }
  });

  it('reuses sql-grep output controls and rejects invalid output limits', async () => {
    const workspace = temporaryWorkspace();
    mkdirSync(resolve(workspace, 'queries'));
    writeFileSync(resolve(workspace, 'queries', 'one.sql'), 'select id from public.orders');
    writeFileSync(resolve(workspace, 'queries', 'two.sql'), 'select amount from public.orders');
    const { client, close } = await connectedClient(workspace);
    const baseArguments = { kind: 'table', scopeDir: 'queries', target: 'public.orders', view: 'detail' };
    try {
      const defaultResult = result(await client.callTool({ name: 'find_query_usage', arguments: baseArguments }));
      expect(defaultResult.report).not.toHaveProperty('display');

      const limited = result(await client.callTool({
        name: 'find_query_usage',
        arguments: { ...baseArguments, limit: 1 },
      }));
      expect(limited.report).toMatchObject({
        matches: [expect.any(Object)],
        display: { totalMatches: 2, returnedMatches: 1, truncated: true, limit: 1 },
      });

      const summaryOnly = result(await client.callTool({
        name: 'find_query_usage',
        arguments: { ...baseArguments, summaryOnly: true },
      }));
      expect(summaryOnly.report).toMatchObject({
        matches: [],
        warnings: [],
        display: { summaryOnly: true, totalMatches: 2, returnedMatches: 0, truncated: true },
      });

      const invalid = await client.callTool({
        name: 'find_query_usage',
        arguments: { ...baseArguments, limit: 0 },
      });
      expect(invalid.isError).toBe(true);
      expect(failure(invalid)).toMatchObject({ code: 'OUTPUT_LIMIT_INVALID', kind: 'invalid_input' });
    } finally {
      await close();
    }
  });
});

async function connectedClient(workspace: string): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createRawsqlMcpServer(workspace);
  const client = new Client({ name: 'rawsql-mcp-phase2-test', version: '1.0.0' });
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
  const directory = mkdtempSync(resolve(tmpdir(), 'rawsql-ts-mcp-phase2-'));
  temporaryDirectories.push(directory);
  return directory;
}

function result(response: unknown): Record<string, any> {
  const toolResult = response as { structuredContent?: Record<string, unknown> };
  expect(toolResult.structuredContent).toBeDefined();
  return toolResult.structuredContent as Record<string, any>;
}

function failure(response: unknown): Record<string, unknown> {
  const toolResult = response as { content: unknown };
  return JSON.parse((toolResult.content as Array<{ text: string }>)[0].text) as Record<string, unknown>;
}

function firstStepSql(value: Record<string, any>): string {
  return String((value.steps as Array<{ sql: string }>)[0].sql);
}

function firstProbeSql(value: Record<string, any>): string {
  return String(((value.investigationPlan as Record<string, any>).recommendedProbes as Array<{ sql: string }>)[0].sql);
}

function firstProbe(value: Record<string, any>): Record<string, any> {
  return ((value.diagnostics as Record<string, any>).probes as Array<Record<string, any>>)[0];
}

function firstSuggestedSql(value: Record<string, any>): string {
  return String(firstProbe(value).suggestedSql);
}
