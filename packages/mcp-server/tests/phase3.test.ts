import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

describe('MCP Phase 3 analysis tools', () => {
  it('returns validation failures as domain results and accepts all common DDL inputs', async () => {
    const workspace = temporaryWorkspace();
    mkdirSync(resolve(workspace, 'ddl'));
    writeFileSync(resolve(workspace, 'ddl', 'customers.sql'), 'create table public.customers (customer_id bigint not null);');
    const { client, close } = await connectedClient(workspace);
    try {
      const parseOnly = await client.callTool({ name: 'validate_sql', arguments: { sql: 'select 1 as value' } });
      expect(parseOnly.isError).not.toBe(true);
      expect(parseOnly.structuredContent).toMatchObject({ valid: true, kind: 'sql-validation' });

      for (const arguments_ of [
        { sql: 'values (1), (2)' },
        { ddl: 'create table public.orders (order_id bigint not null);', sql: 'values (1), (2)' },
      ]) {
        const values = await client.callTool({ name: 'validate_sql', arguments: arguments_ });
        expect(values.isError).not.toBe(true);
        expect(values.structuredContent).toMatchObject({
          valid: true,
          diagnostics: expect.arrayContaining([expect.objectContaining({
            code: 'SCHEMA_VALIDATION_UNSUPPORTED_QUERY_ROOT',
            severity: 'warning',
          })]),
        });
      }

      const inline = await client.callTool({
        name: 'validate_sql',
        arguments: {
          ddl: 'create table public.orders (order_id bigint not null);',
          sql: 'select order_id from public.orders',
        },
      });
      expect(inline.structuredContent).toMatchObject({ valid: true });

      const path = await client.callTool({
        name: 'validate_sql',
        arguments: { ddlPaths: 'ddl', sql: 'select customer_id from public.customers' },
      });
      expect(path.structuredContent).toMatchObject({ valid: true });

      const combined = await client.callTool({
        name: 'validate_sql',
        arguments: {
          ddl: 'create table public.orders (customer_id bigint not null);',
          ddlPaths: 'ddl',
          sql: 'select o.customer_id from public.orders o join public.customers c on c.customer_id = o.customer_id',
        },
      });
      expect(combined.structuredContent).toMatchObject({ valid: true });

      const syntax = await client.callTool({ name: 'validate_sql', arguments: { sql: 'select from' } });
      expect(syntax.isError).not.toBe(true);
      expect(syntax.structuredContent).toMatchObject({
        valid: false,
        diagnostics: [expect.objectContaining({ code: 'SQL_PARSE_ERROR' })],
      });

      const unknownTable = await client.callTool({
        name: 'validate_sql',
        arguments: {
          ddl: 'create table public.orders (order_id bigint not null);',
          sql: 'select order_id from public.missing',
        },
      });
      expect(unknownTable.isError).not.toBe(true);
      expect(unknownTable.structuredContent).toMatchObject({
        valid: false,
        diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'TABLE_NOT_DEFINED' })]),
      });

      const unknownColumn = await client.callTool({
        name: 'validate_sql',
        arguments: {
          ddl: 'create table public.orders (order_id bigint not null);',
          sql: 'select missing from public.orders',
        },
      });
      expect(unknownColumn.isError).not.toBe(true);
      expect(unknownColumn.structuredContent).toMatchObject({
        valid: false,
        diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'COLUMN_NOT_DEFINED' })]),
      });

      const ambiguousColumn = await client.callTool({
        name: 'validate_sql',
        arguments: {
          ddl: [
            'create table users (id bigint);',
            'create table accounts (id bigint, user_id bigint);',
          ],
          sql: 'select id from users join accounts on users.id = accounts.user_id',
        },
      });
      expect(ambiguousColumn.isError).not.toBe(true);
      expect(ambiguousColumn.structuredContent).toMatchObject({
        valid: false,
        diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'COLUMN_REFERENCE_AMBIGUOUS' })]),
      });

      const uniqueColumn = await client.callTool({
        name: 'validate_sql',
        arguments: {
          ddl: [
            'create table users (id bigint);',
            'create table accounts (user_id bigint);',
          ],
          sql: 'select id from users join accounts on users.id = accounts.user_id',
        },
      });
      expect(uniqueColumn.isError).not.toBe(true);
      expect(uniqueColumn.structuredContent).toMatchObject({ valid: true, diagnostics: [] });
    } finally {
      await close();
    }
  });

  it('keeps invalid DDL paths in the MCP input-error contract', async () => {
    const { client, close } = await connectedClient(temporaryWorkspace());
    try {
      const response = await client.callTool({
        name: 'validate_sql',
        arguments: { ddlPaths: '../outside.sql', sql: 'select 1' },
      });
      expect(response.isError).toBe(true);
      expect(JSON.parse((response.content as Array<{ text: string }>)[0].text)).toMatchObject({ kind: 'invalid_input' });
    } finally {
      await close();
    }
  });

  it('inspects caller-facing query contracts from inline and path DDL without exposing AST', async () => {
    const workspace = temporaryWorkspace();
    mkdirSync(resolve(workspace, 'ddl'));
    writeFileSync(resolve(workspace, 'ddl', 'orders.sql'), 'create table public.orders (order_id bigint not null, customer_id bigint not null);');
    const { client, close } = await connectedClient(workspace);
    try {
      const response = await client.callTool({
        name: 'inspect_query_contract',
        arguments: {
          ddl: 'create table public.customers (customer_id bigint not null);',
          ddlPaths: 'ddl',
          sql: `with selected as (
            select o.order_id, o.customer_id from public.orders o
            join public.customers c on c.customer_id = o.customer_id
            where o.customer_id = :customer_id
          )
          select order_id as id, customer_id from selected where customer_id = :customer_id`,
        },
      });

      expect(response.isError).not.toBe(true);
      expect(response.structuredContent).toMatchObject({
        kind: 'query-contract-inspection',
        parameters: [
          { name: 'customer_id', occurrenceIndex: 0, sourceText: ':customer_id', style: 'named' },
          { name: 'customer_id', occurrenceIndex: 1, sourceText: ':customer_id', style: 'named' },
        ],
        outputColumns: [
          { name: 'id', outputIndex: 0 },
          { name: 'customer_id', outputIndex: 1 },
        ],
        referencedTables: [
          { qualifiedName: 'public.customers' },
          { qualifiedName: 'public.orders' },
        ],
      });
      expect(JSON.stringify(response.structuredContent)).not.toContain('selectClause');

      const wildcard = await client.callTool({
        name: 'inspect_query_contract',
        arguments: { ddlPaths: 'ddl/orders.sql', sql: 'select * from public.orders' },
      });
      expect(wildcard.structuredContent).toMatchObject({
        outputColumns: [
          { name: 'order_id', nullable: false, outputIndex: 0, type: 'bigint' },
          { name: 'customer_id', nullable: false, outputIndex: 1, type: 'bigint' },
        ],
      });

      const invalid = await client.callTool({ name: 'inspect_query_contract', arguments: { sql: 'select from' } });
      expect(invalid.isError).not.toBe(true);
      expect(invalid.structuredContent).toMatchObject({
        diagnostics: [expect.objectContaining({ code: 'QUERY_CONTRACT_PARSE_ERROR' })],
      });
    } finally {
      await close();
    }
  });
});

async function connectedClient(workspace: string): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createRawsqlMcpServer(workspace);
  const client = new Client({ name: 'rawsql-mcp-phase3-test', version: '1.0.0' });
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
  const directory = mkdtempSync(resolve(tmpdir(), 'rawsql-ts-mcp-phase3-'));
  temporaryDirectories.push(directory);
  return directory;
}
