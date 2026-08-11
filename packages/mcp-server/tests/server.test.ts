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

describe('@rawsql-ts/mcp-server', () => {
  it('registers exactly seven task-oriented tools with minimal argument schemas', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    try {
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name)).toEqual([
        'validate_sql',
        'analyze_query_structure',
        'analyze_column_lineage',
        'create_fixture_extraction_plan',
        'find_query_usage',
        'extract_cte_query',
        'optimize_sql_conditions',
      ]);
      expect(Object.keys(tool(listed.tools, 'validate_sql').inputSchema.properties ?? {}).sort()).toEqual(['ddl', 'ddlPaths', 'sql']);
      expect(Object.keys(tool(listed.tools, 'analyze_query_structure').inputSchema.properties ?? {}).sort()).toEqual(['ddl', 'ddlPaths', 'sql', 'view']);
      expect(Object.keys(tool(listed.tools, 'analyze_column_lineage').inputSchema.properties ?? {}).sort()).toEqual(['ddl', 'ddlPaths', 'format', 'sql', 'targetColumn', 'view']);
      expect(Object.keys(tool(listed.tools, 'create_fixture_extraction_plan').inputSchema.properties ?? {}).sort()).toEqual(['ddl', 'ddlPaths', 'format', 'sql']);
      expect(Object.keys(tool(listed.tools, 'find_query_usage').inputSchema.properties ?? {}).sort()).toEqual([
        'anySchema', 'anyTable', 'kind', 'limit', 'scopeDir', 'summaryOnly', 'target', 'view',
      ]);
      expect(Object.keys(tool(listed.tools, 'extract_cte_query').inputSchema.properties ?? {}).sort()).toEqual(['cteName', 'format', 'sql']);
      expect(Object.keys(tool(listed.tools, 'optimize_sql_conditions').inputSchema.properties ?? {}).sort()).toEqual(['absentParameterNames', 'format', 'sql']);
    } finally {
      await close();
    }
  });

  it('serves structure, column lineage, and bounded fixture planning from investigation-core', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    const input = {
      ddl: 'create table orders (order_id bigint primary key, customer_id bigint not null, amount numeric not null);',
      sql: 'select customer_id, sum(amount) as total_amount from orders where customer_id = :customer_id group by customer_id',
    };
    try {
      const structure = await client.callTool({ name: 'analyze_query_structure', arguments: input });
      expect(structure.structuredContent).toMatchObject({
        kind: 'query-structure-analysis',
        summary: { physicalTableCount: 1, outputColumnCount: 2 },
      });

      const lineage = await client.callTool({
        name: 'analyze_column_lineage',
        arguments: { ...input, targetColumn: 'total_amount' },
      });
      expect(lineage.structuredContent).toMatchObject({
        kind: 'column-lineage-analysis',
        target: { columnName: 'total_amount' },
      });

      const fixture = await client.callTool({ name: 'create_fixture_extraction_plan', arguments: input });
      expect(fixture.structuredContent).toMatchObject({
        kind: 'fixture-extraction-plan',
        reproductionKey: { parameterNames: ['customer_id'] },
      });
      expect(JSON.stringify(fixture.structuredContent)).toContain('select');
    } finally {
      await close();
    }
  });

  it('finds recursive SQL-file usage, extracts a CTE, and returns safe-only condition optimization evidence', async () => {
    const workspace = temporaryWorkspace();
    mkdirSync(resolve(workspace, 'queries'));
    mkdirSync(resolve(workspace, 'archive'));
    writeFileSync(resolve(workspace, 'queries', 'orders.sql'), 'select customer_id from public.orders where status = :status');
    writeFileSync(resolve(workspace, 'archive', 'orders.sql'), 'select order_id from public.orders');
    const { client, close } = await connectedClient(workspace);
    try {
      const usage = await client.callTool({
        name: 'find_query_usage',
        arguments: { kind: 'table', scopeDir: 'queries', target: 'public.orders', view: 'detail' },
      });
      expect(usage.structuredContent).toMatchObject({
        kind: 'query-usage-search',
        report: {
          source: { kind: 'sql-files', scopeDir: 'queries' },
          summary: { sqlFilesScanned: 1 },
          matches: [expect.objectContaining({
            catalog_id: 'file:queries/orders.sql',
            sql_file: 'queries/orders.sql',
          })],
        },
      });

      const cte = await client.callTool({
        name: 'extract_cte_query',
        arguments: {
          cteName: 'filtered',
          sql: 'with base as (select id from orders), filtered as (select id from base where id > 10) select * from filtered',
        },
      });
      expect(cte.structuredContent).toMatchObject({
        kind: 'cte-query-extraction',
        name: 'filtered',
        dependencies: ['base'],
      });
      expect(String((cte.structuredContent as Record<string, unknown> | undefined)?.executableSql)).toContain('base');

      const optimized = await client.callTool({
        name: 'optimize_sql_conditions',
        arguments: { sql: 'select id from orders where id = :id and id = :id' },
      });
      expect(optimized.structuredContent).toMatchObject({
        kind: 'sql-condition-optimization',
        safety: { mode: 'safe_only', unsafeRewriteApplied: false },
      });
      expect(optimized.structuredContent).not.toHaveProperty('query');
    } finally {
      await close();
    }
  });

  it('rejects ambiguous column names and unsupported extra fixture arguments', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    try {
      const duplicate = await client.callTool({
        name: 'analyze_column_lineage',
        arguments: { sql: 'select 1 as repeated, 2 as repeated', targetColumn: 'repeated' },
      });
      expect(duplicate.isError).toBe(true);
      expect(JSON.parse((duplicate.content as Array<{ text: string }>)[0].text)).toMatchObject({
        code: 'DUPLICATE_OUTPUT_COLUMN',
      });

      const extra = await client.callTool({
        name: 'create_fixture_extraction_plan',
        arguments: {
          sql: 'select id from orders where id = :id',
          parameterBindings: { id: 1 },
        },
      });
      expect(extra.isError).toBe(true);
    } finally {
      await close();
    }
  });

  it('rejects a SQL scan directory outside the configured workspace', async () => {
    const workspace = temporaryWorkspace();
    const outside = temporaryWorkspace();
    writeFileSync(resolve(outside, 'orders.sql'), 'select customer_id from public.orders');
    const { client, close } = await connectedClient(workspace);
    try {
      const usage = await client.callTool({
        name: 'find_query_usage',
        arguments: {
          kind: 'table',
          scopeDir: relative(workspace, outside),
          target: 'public.orders',
          view: 'detail',
        },
      });
      expect(usage.isError).toBe(true);
      expect(JSON.parse((usage.content as Array<{ text: string }>)[0].text)).toMatchObject({
        code: 'INVALID_INPUT',
        kind: 'invalid_input',
      });
    } finally {
      await close();
    }
  });
});

async function connectedClient(workspace: string): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createRawsqlMcpServer(workspace);
  const client = new Client({ name: 'rawsql-mcp-test', version: '1.0.0' });
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
  const directory = mkdtempSync(resolve(tmpdir(), 'rawsql-ts-mcp-'));
  temporaryDirectories.push(directory);
  return directory;
}

function tool(
  tools: Array<{ inputSchema: { properties?: Record<string, unknown> }; name: string }>,
  name: string,
): { inputSchema: { properties?: Record<string, unknown> }; name: string } {
  const found = tools.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing tool: ${name}`);
  return found;
}
