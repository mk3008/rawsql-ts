import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  analyzeColumnLineage,
  analyzeQueryStructure,
  ColumnLineageAnalysisInputError,
  FixtureExtractionInputError,
  generateFixtureExtractionPlan,
  type DdlInput,
} from '@rawsql-ts/investigation-core';
import { buildSqlFileUsageReport } from '@rawsql-ts/sql-grep-core';
import {
  CTEQueryDecomposer,
  optimizeConditions,
  SelectQueryParser,
  SimpleSelectQuery,
} from 'rawsql-ts';
import { z } from 'zod';
import { McpInputError } from './inputError';
import { normalizeWorkspaceRoot } from './workspacePaths';

export { McpInputError } from './inputError';

const MAX_INLINE_BYTES = 1024 * 1024;

const staticSqlSchema = {
  ddl: z.union([z.string().min(1), z.array(z.string().min(1))]).optional()
    .describe('Optional DDL text used only to resolve tables, keys, and columns.'),
  sql: z.string().min(1).describe('SQL text to analyze without executing it.'),
};

export function createRawsqlMcpServer(workspace: string): McpServer {
  const workspaceRoot = normalizeWorkspaceRoot(workspace);
  const server = new McpServer({ name: '@rawsql-ts/mcp-server', version: '0.1.0' });

  server.registerTool(
    'analyze_query_structure',
    {
      description: 'Analyze physical tables, CTEs, derived queries, nesting, dependencies, and row-set-changing operations in supplied SQL. It never connects to a database or executes SQL.',
      inputSchema: z.object(staticSqlSchema).strict(),
    },
    async (request) => runTool(() => analyzeQueryStructure(normalizeStaticInput(request))),
  );

  server.registerTool(
    'analyze_column_lineage',
    {
      description: 'Analyze the value lineage and row-set influences of one uniquely named final output column. Duplicate final output names are rejected.',
      inputSchema: z.object({
        ...staticSqlSchema,
        targetColumn: z.string().min(1).describe('Unique final output-column name to analyze.'),
      }).strict(),
    },
    async (request) => runTool(() => analyzeColumnLineage({
      ...normalizeStaticInput(request),
      targetColumn: request.targetColumn,
    })),
  );

  server.registerTool(
    'create_fixture_extraction_plan',
    {
      description: 'Generate a value-free static capture SELECT plan when supplied SQL and optional DDL prove a bounded extraction condition. It never executes the generated SQL.',
      inputSchema: z.object(staticSqlSchema).strict(),
    },
    async (request) => runTool(() => generateFixtureExtractionPlan(normalizeStaticInput(request))),
  );

  server.registerTool(
    'find_query_usage',
    {
      description: 'Recursively find AST-based table or column usage in project .sql files beneath a workspace-relative directory. The scan skips .git and node_modules. Results include usage kinds, locations, fingerprints, confidence, and warnings.',
      inputSchema: z.object({
        anySchema: z.boolean().optional().describe('Allow a target without an explicit schema.'),
        anyTable: z.boolean().optional().describe('For column searches, allow a target without an explicit table. Requires anySchema.'),
        kind: z.enum(['table', 'column']).describe('Whether the target identifies a table or column.'),
        scopeDir: z.string().min(1).max(1024).optional()
          .describe('Workspace-relative directory to scan recursively for .sql files. Defaults to the workspace root.'),
        target: z.string().min(1).describe('Qualified table or column selector, such as public.orders or public.orders.customer_id.'),
        view: z.enum(['impact', 'detail']).optional().describe('Impact aggregates per statement; detail returns each usage location.'),
      }).strict(),
    },
    async (request) => runTool(() => ({
      kind: 'query-usage-search',
      version: 1,
      report: buildSqlFileUsageReport({
        kind: request.kind,
        rawTarget: request.target,
        rootDir: workspaceRoot,
        scopeDir: request.scopeDir,
        anySchema: request.anySchema,
        anyTable: request.anyTable,
        view: request.view ?? 'impact',
      }),
    })),
  );

  server.registerTool(
    'extract_cte_query',
    {
      description: 'Generate standalone SQL for one named CTE, including its required CTE dependencies in execution order. It generates SQL but does not execute it.',
      inputSchema: z.object({
        cteName: z.string().min(1).describe('Name of the CTE to extract.'),
        sql: z.string().min(1).describe('SQL text containing the CTE.'),
      }).strict(),
    },
    async (request) => runTool(() => {
      ensureInlineSize(request.sql, 'sql');
      const query = SelectQueryParser.parse(request.sql);
      if (!(query instanceof SimpleSelectQuery)) {
        throw new McpInputError('CTE_ROOT_UNSUPPORTED', 'CTE extraction requires a simple SELECT root.');
      }
      const result = new CTEQueryDecomposer().extractCTE(query, request.cteName);
      return { ...result, kind: 'cte-query-extraction', version: 1 };
    }),
  );

  server.registerTool(
    'optimize_sql_conditions',
    {
      description: 'Apply safe-only static condition optimization: optional-branch pruning, parameter and static predicate placement, and duplicate-condition removal. It returns rewritten SQL and structured evidence without changing files or executing SQL.',
      inputSchema: z.object({
        absentParameterNames: z.array(z.string().min(1)).optional()
          .describe('Parameter names known to be absent. Values are neither accepted nor required.'),
        sql: z.string().min(1).describe('SQL text whose conditions should be optimized.'),
      }).strict(),
    },
    async (request) => runTool(() => {
      ensureInlineSize(request.sql, 'sql');
      const optionalConditionParameters = request.absentParameterNames
        ? Object.fromEntries(request.absentParameterNames.map((name) => [name, undefined]))
        : undefined;
      const result = optimizeConditions(request.sql, { optionalConditionParameters });
      const diagnostics = result.diagnostics
        ? { ...result.diagnostics, debugQuery: undefined }
        : undefined;
      return {
        ...result,
        kind: 'sql-condition-optimization',
        version: 1,
        query: undefined,
        diagnostics,
      };
    }),
  );

  return server;
}

export async function runRawsqlMcpServer(workspace = process.cwd()): Promise<void> {
  const server = createRawsqlMcpServer(workspace);
  await server.connect(new StdioServerTransport());
}

function normalizeStaticInput(input: { ddl?: string | string[]; sql: string }): { ddl?: DdlInput[]; sql: string } {
  ensureInlineSize(input.sql, 'sql');
  const ddlTexts = input.ddl === undefined ? [] : Array.isArray(input.ddl) ? input.ddl : [input.ddl];
  ddlTexts.forEach((ddl, index) => ensureInlineSize(ddl, `ddl[${index}]`));
  return {
    sql: input.sql,
    ...(ddlTexts.length > 0
      ? { ddl: ddlTexts.map((sql, index) => ({ filePath: `<inline:${index + 1}>`, sql })) }
      : {}),
  };
}

function ensureInlineSize(text: string, field: string): void {
  if (text.includes('\0')) throw new McpInputError('BINARY_INPUT', `${field} contains a NUL byte.`);
  if (Buffer.byteLength(text) > MAX_INLINE_BYTES) {
    throw new McpInputError('INPUT_SIZE_LIMIT', `${field} exceeds ${MAX_INLINE_BYTES} bytes.`);
  }
}

async function runTool(operation: () => object): Promise<{
  content: Array<{ text: string; type: 'text' }>;
  isError?: true;
  structuredContent?: Record<string, unknown>;
}> {
  try {
    const value = operation();
    const structuredContent = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    return {
      content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
      structuredContent,
    };
  } catch (error) {
    const known = error instanceof McpInputError
      || error instanceof ColumnLineageAnalysisInputError
      || error instanceof FixtureExtractionInputError;
    const failure = {
      code: known && 'code' in error ? String(error.code) : 'INVALID_INPUT',
      kind: 'invalid_input',
      message: error instanceof Error ? error.message : String(error),
      version: 1,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(failure) }],
      isError: true,
    };
  }
}
