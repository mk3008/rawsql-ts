import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  analyzeColumnLineage,
  analyzeQueryStructure,
  ColumnLineageAnalysisInputError,
  FixtureExtractionInputError,
  generateFixtureExtractionPlan,
  inspectQueryContract,
  validateSql,
  type DdlInput,
} from '@rawsql-ts/investigation-core';
import { applyQueryOutputControls, buildSqlFileUsageReport, QUERY_USAGE_KINDS } from '@rawsql-ts/sql-grep-core';
import {
  CTEQueryDecomposer,
  optimizeConditions,
  SelectQueryParser,
  SimpleSelectQuery,
} from 'rawsql-ts';
import { z } from 'zod';
import { resolveDdlSources } from './ddlSources';
import { McpInputError } from './inputError';
import {
  formatGeneratedSqlArtifact,
  formatRequestedSql,
  generatedSqlArtifact,
  resolveSqlFormatting,
  type SqlFormatInput,
} from './sqlFormatting';
import {
  formatColumnLineageAnalysis,
  formatConditionOptimizationResult,
  formatFixtureExtractionPlan,
  toColumnLineageCompactView,
  toQueryStructureCompactView,
} from './toolResults';
import { normalizeWorkspaceRoot } from './workspacePaths';

export { McpInputError } from './inputError';

const MAX_INLINE_BYTES = 1024 * 1024;

// API output shape review: every new input is optional; omitted/full requests retain
// the existing six-tool outputs, while compact DTOs and output controls are explicit.

const staticSqlSchema = {
  ddl: z.union([z.string().min(1), z.array(z.string().min(1))]).optional()
    .describe('Optional DDL text used only to resolve tables, keys, and columns.'),
  ddlPaths: z.union([z.string().min(1), z.array(z.string().min(1))]).optional()
    .describe('Optional workspace-relative .sql files or directories whose .sql files are loaded recursively as DDL.'),
  sql: z.string().min(1).describe('SQL text to analyze without executing it.'),
};

const formatSchema = z.object({
  configPath: z.string().min(1).optional()
    .describe('Optional workspace-relative JSON file containing rawsql-ts SqlFormatterOptions.'),
  options: z.record(z.string(), z.unknown()).optional()
    .describe('Optional rawsql-ts SqlFormatterOptions object. Keys and values are strictly validated by rawsql-ts core.'),
}).strict().optional();

export function createRawsqlMcpServer(workspace: string): McpServer {
  const workspaceRoot = normalizeWorkspaceRoot(workspace);
  const server = new McpServer({ name: '@rawsql-ts/mcp-server', version: '0.1.0' });

  server.registerTool(
    'validate_sql',
    {
      description: 'Validate one SELECT statement statically. Syntax and schema problems are returned as structured diagnostics; the tool never connects to a database or executes SQL.',
      inputSchema: z.object(staticSqlSchema).strict(),
    },
    async (request) => runTool(() => validateSql(normalizeStaticInput(request, workspaceRoot))),
  );

  server.registerTool(
    'inspect_query_contract',
    {
      description: 'Inspect parameters, ordered output columns, and referenced physical tables for one SELECT statement. DDL-proven types and query-proven output nullability are included without executing SQL.',
      inputSchema: z.object(staticSqlSchema).strict(),
    },
    async (request) => runTool(() => inspectQueryContract(normalizeStaticInput(request, workspaceRoot))),
  );

  server.registerTool(
    'analyze_query_structure',
    {
      description: 'Analyze physical tables, CTEs, derived queries, nesting, dependencies, and row-set-changing operations in supplied SQL. It never connects to a database or executes SQL.',
      inputSchema: z.object({
        ...staticSqlSchema,
        view: z.enum(['compact', 'full']).optional().describe('Compact returns summary detail; full is the default and preserves the complete result.'),
      }).strict(),
    },
    async (request) => runTool(() => {
      const result = analyzeQueryStructure(normalizeStaticInput(request, workspaceRoot));
      return request.view === 'compact' ? toQueryStructureCompactView(result) : result;
    }),
  );

  server.registerTool(
    'analyze_column_lineage',
    {
      description: 'Analyze the value lineage and row-set influences of one uniquely named final output column. Duplicate final output names are rejected.',
      inputSchema: z.object({
        ...staticSqlSchema,
        format: formatSchema,
        targetColumn: z.string().min(1).describe('Unique final output-column name to analyze.'),
        view: z.enum(['compact', 'full']).optional().describe('Compact returns decision-oriented summaries; full is the default and preserves the complete result.'),
      }).strict(),
    },
    async (request) => runTool(() => {
      const formatting = resolveSqlFormatting(workspaceRoot, request.format as SqlFormatInput | undefined);
      const result = analyzeColumnLineage({
        ...normalizeStaticInput(request, workspaceRoot),
        targetColumn: request.targetColumn,
      });
      if (request.view === 'compact') return toColumnLineageCompactView(result);
      return formatColumnLineageAnalysis(result, formatting);
    }),
  );

  server.registerTool(
    'create_fixture_extraction_plan',
    {
      description: 'Generate a value-free static capture SELECT plan when supplied SQL and optional DDL prove a bounded extraction condition. It never executes the generated SQL.',
      inputSchema: z.object({ ...staticSqlSchema, format: formatSchema }).strict(),
    },
    async (request) => runTool(() => {
      const formatting = resolveSqlFormatting(workspaceRoot, request.format as SqlFormatInput | undefined);
      const result = generateFixtureExtractionPlan(normalizeStaticInput(request, workspaceRoot));
      return formatFixtureExtractionPlan(result, formatting);
    }),
  );

  server.registerTool(
    'find_query_usage',
    {
      description: 'Recursively find AST-based table or column usage in project .sql files beneath a workspace-relative directory. The scan skips .git and node_modules. Results include usage kinds, locations, fingerprints, confidence, and warnings.',
      inputSchema: z.object({
        anySchema: z.boolean().optional().describe('Allow a target without an explicit schema.'),
        anyTable: z.boolean().optional().describe('For column searches, allow a target without an explicit table. Requires anySchema.'),
        kind: z.enum(['table', 'column']).describe('Whether the target identifies a table or column.'),
        limit: z.number().optional().describe('Optional positive safe-integer limit applied to returned matches and warnings after scanning.'),
        scopeDir: z.string().min(1).max(1024).optional()
          .describe('Workspace-relative directory to scan recursively for .sql files. Defaults to the workspace root.'),
        summaryOnly: z.boolean().optional().describe('Return report summary and display totals without match or warning bodies.'),
        target: z.string().min(1).describe('Qualified table or column selector, such as public.orders or public.orders.customer_id.'),
        usageKinds: z.array(z.enum(QUERY_USAGE_KINDS)).min(1).optional()
          .describe('Optional syntax contexts to retain. Canonical values are defined by sql-grep-core.'),
        view: z.enum(['impact', 'detail']).optional().describe('Impact aggregates per statement; detail returns each usage location.'),
      }).strict(),
    },
    async (request) => runTool(() => {
      const limit = validateOutputLimit(request.limit);
      const report = buildSqlFileUsageReport({
        kind: request.kind,
        rawTarget: request.target,
        rootDir: workspaceRoot,
        scopeDir: request.scopeDir,
        anySchema: request.anySchema,
        anyTable: request.anyTable,
        usageKinds: request.usageKinds,
        view: request.view ?? 'impact',
      });
      return {
        kind: 'query-usage-search',
        version: 1,
        report: limit === undefined && request.summaryOnly === undefined
          ? report
          : applyQueryOutputControls(report, { limit, summaryOnly: request.summaryOnly }),
      };
    }),
  );

  server.registerTool(
    'extract_cte_query',
    {
      description: 'Generate standalone SQL for one named CTE, including its required CTE dependencies in execution order. It generates SQL but does not execute it.',
      inputSchema: z.object({
        cteName: z.string().min(1).describe('Name of the CTE to extract.'),
        format: formatSchema,
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
      const formatting = resolveSqlFormatting(workspaceRoot, request.format as SqlFormatInput | undefined);
      const executableSql = formatGeneratedSqlArtifact(
        generatedSqlArtifact('cte_extraction_query', result.executableSql),
        formatting,
      ).sql;
      return { ...result, executableSql, kind: 'cte-query-extraction', version: 1 };
    }),
  );

  server.registerTool(
    'optimize_sql_conditions',
    {
      description: 'Apply safe-only static condition optimization: optional-branch pruning, parameter and static predicate placement, and duplicate-condition removal. It returns rewritten SQL and structured evidence without changing files or executing SQL.',
      inputSchema: z.object({
        absentParameterNames: z.array(z.string().min(1)).optional()
          .describe('Parameter names known to be absent. Values are neither accepted nor required.'),
        format: formatSchema,
        sql: z.string().min(1).describe('SQL text whose conditions should be optimized.'),
      }).strict(),
    },
    async (request) => runTool(() => {
      ensureInlineSize(request.sql, 'sql');
      const optionalConditionParameters = request.absentParameterNames
        ? Object.fromEntries(request.absentParameterNames.map((name) => [name, undefined]))
        : undefined;
      const formatting = resolveSqlFormatting(workspaceRoot, request.format as SqlFormatInput | undefined);
      const formatted = formatConditionOptimizationResult(
        optimizeConditions(request.sql, { optionalConditionParameters }),
        formatting,
      );
      const diagnostics = formatted.diagnostics
        ? { ...formatted.diagnostics, debugQuery: undefined }
        : undefined;
      return {
        ...formatted,
        kind: 'sql-condition-optimization',
        version: 1,
        query: undefined,
        diagnostics,
      };
    }),
  );

  server.registerTool(
    'format_sql',
    {
      description: 'Format one SQL statement with rawsql-ts defaults or optional workspace-confined config and inline formatter options. It does not execute SQL or change files.',
      inputSchema: z.object({
        format: formatSchema,
        sql: z.string().min(1).describe('One SQL statement to format without executing it.'),
      }).strict(),
    },
    async (request) => runTool(() => {
      ensureInlineSize(request.sql, 'sql');
      const formatting = resolveSqlFormatting(workspaceRoot, (request.format ?? {}) as SqlFormatInput);
      return {
        kind: 'sql-format',
        version: 1,
        sql: formatRequestedSql(request.sql, formatting),
      };
    }),
  );

  return server;
}

export async function runRawsqlMcpServer(workspace = process.cwd()): Promise<void> {
  const server = createRawsqlMcpServer(workspace);
  await server.connect(new StdioServerTransport());
}

function normalizeStaticInput(
  input: { ddl?: string | string[]; ddlPaths?: string | string[]; sql: string },
  workspaceRoot: string,
): { ddl?: DdlInput[]; sql: string } {
  ensureInlineSize(input.sql, 'sql');
  const inlineDdl = input.ddl === undefined ? [] : Array.isArray(input.ddl) ? input.ddl : [input.ddl];
  inlineDdl.forEach((ddl, index) => ensureInlineSize(ddl, `ddl[${index}]`));
  const ddl = resolveDdlSources({
    inlineDdl,
    paths: input.ddlPaths,
    workspaceRoot,
  });
  return {
    sql: input.sql,
    ...(ddl.length > 0 ? { ddl } : {}),
  };
}

function validateOutputLimit(limit: number | undefined): number | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new McpInputError('OUTPUT_LIMIT_INVALID', 'limit must be a positive safe integer.');
  }
  return limit;
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
