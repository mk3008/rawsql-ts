import {
  analyzeColumnLineage,
  analyzeQueryStructure,
  generateFixtureExtractionPlan,
  inspectQueryContract,
  sliceQueryScope,
  validateSql,
  type DdlInput,
} from '@rawsql-ts/investigation-core';
import {
  analyzeColumnUsage,
  analyzeTableUsage,
  parseQueryTarget,
  type CatalogStatement,
} from '@rawsql-ts/sql-grep-core/browser';
import {
  CTEQueryDecomposer,
  optimizeConditions,
  SelectQueryParser,
  SimpleSelectQuery,
  SqlFormatter,
  SqlParser,
  type QueryScopeSelectorV1,
} from 'rawsql-ts';

export const demoToolIds = [
  'validate_sql',
  'inspect_query_contract',
  'analyze_query_structure',
  'analyze_column_lineage',
  'slice_query',
  'create_fixture_extraction_plan',
  'find_query_usage',
  'extract_cte_query',
  'optimize_sql_conditions',
  'format_sql',
] as const;

export type DemoToolId = typeof demoToolIds[number];

export interface DemoTool {
  id: DemoToolId;
  label: string;
  summary: string;
  experimental?: true;
}

export const demoTools: readonly DemoTool[] = [
  {
    id: 'validate_sql',
    label: 'Validate SQL',
    summary: 'Checks one SELECT statement for syntax and, when optional DDL is supplied, known table and column references without executing SQL.',
  },
  {
    id: 'inspect_query_contract',
    label: 'Inspect query contract',
    summary: 'Lists input parameter occurrences, ordered output columns, and physical tables, adding DDL-proven types and query-proven output nullability.',
  },
  {
    id: 'analyze_query_structure',
    label: 'Analyze query structure',
    summary: 'Summarizes tables, CTEs, nesting, joins, filters, grouping, and other structural features, with full and compact MCP views.',
  },
  {
    id: 'analyze_column_lineage',
    label: 'Analyze column lineage',
    summary: 'Traces one final output column to its value sources and row influences, with full and compact MCP views and optional probe formatting.',
  },
  {
    id: 'slice_query',
    label: 'Slice a query scope',
    summary: 'Uses an explicit structural selector to produce a standalone representation only when the chosen query scope is statically proven safe; otherwise it returns a blocked result without SQL.',
  },
  {
    id: 'create_fixture_extraction_plan',
    label: 'Create fixture extraction plan',
    summary: 'Uses optional inline or workspace DDL to prove a bounded predicate and produces optionally formatted capture SELECT statements only where the boundary is proven.',
    experimental: true,
  },
  {
    id: 'find_query_usage',
    label: 'Find table and column usage',
    summary: 'Recursively searches .sql files for table or column usage, with optional syntax-context filters, result limits, and summary-only output.',
  },
  {
    id: 'extract_cte_query',
    label: 'Create a CTE inspection query',
    summary: 'Extracts one CTE with its required dependencies into independently inspectable SQL with optional formatting.',
  },
  {
    id: 'optimize_sql_conditions',
    label: 'Optimize SQL conditions',
    summary: 'Moves conditions, prunes optional branches, and removes duplicate predicates only where proven safe, with optional generated-SQL formatting.',
  },
  {
    id: 'format_sql',
    label: 'Format SQL',
    summary: 'Formats one user-supplied SQL statement with rawsql-ts defaults without changing files.',
  },
];

export interface DemoInput {
  absentParameterNames: string;
  cteName: string;
  ddl: string;
  scopeDir: string;
  selector: string;
  sql: string;
  targetColumn: string;
  usageKind: 'table' | 'column';
  usageTarget: string;
}

export const initialInputs: Record<DemoToolId, DemoInput> = {
  validate_sql: commonInput(),
  inspect_query_contract: commonInput(),
  analyze_query_structure: commonInput(),
  analyze_column_lineage: commonInput(),
  slice_query: {
    ...commonInput(),
    selector: JSON.stringify({
      path: [
        { kind: 'root' },
        { index: 0, kind: 'source_subquery', source: 'from' },
      ],
      version: 1,
    }, null, 2),
    sql: `select picked.customer_id
from (
  select customer_id
  from public.orders
  where amount > 0
) picked;`,
  },
  create_fixture_extraction_plan: commonInput(),
  find_query_usage: { ...commonInput(), scopeDir: 'queries', usageKind: 'table', usageTarget: 'public.orders' },
  extract_cte_query: {
    ...commonInput(),
    cteName: 'filtered_orders',
    sql: `with base_orders as (
  select order_id, customer_id, amount from public.orders
), filtered_orders as (
  select * from base_orders where customer_id = :customer_id
)
select * from filtered_orders;`,
  },
  optimize_sql_conditions: {
    ...commonInput(),
    absentParameterNames: 'amount',
    sql: `select customer_id, amount
from public.orders
where customer_id = :customer_id
  and customer_id = :customer_id
  and (:amount is null or amount = :amount);`,
  },
  format_sql: commonInput(),
};

export function runDemoTool(toolId: DemoToolId, input: DemoInput): object {
  if (toolId === 'find_query_usage') return findUsage(input);
  if (!input.sql.trim()) throw new Error('Enter SQL.');
  if (toolId === 'format_sql') {
    return {
      kind: 'sql-format',
      version: 1,
      sql: new SqlFormatter().format(SqlParser.parse(input.sql)).formattedSql,
    };
  }
  const ddl = toDdl(input.ddl);
  const staticInput = { sql: input.sql, ...(ddl ? { ddl } : {}) };
  if (toolId === 'validate_sql') return validateSql(staticInput);
  if (toolId === 'inspect_query_contract') return inspectQueryContract(staticInput);
  if (toolId === 'analyze_query_structure') return analyzeQueryStructure(staticInput);
  if (toolId === 'analyze_column_lineage') {
    if (!input.targetColumn.trim()) throw new Error('Enter an output column name.');
    return analyzeColumnLineage({ ...staticInput, targetColumn: input.targetColumn });
  }
  if (toolId === 'slice_query') {
    return sliceQueryScope({ ...staticInput, selector: parseSelector(input.selector) });
  }
  if (toolId === 'create_fixture_extraction_plan') return generateFixtureExtractionPlan(staticInput);
  if (toolId === 'extract_cte_query') {
    if (!input.cteName.trim()) throw new Error('Enter a CTE name.');
    const query = SelectQueryParser.parse(input.sql);
    if (!(query instanceof SimpleSelectQuery)) throw new Error('Enter a simple SELECT query.');
    return { ...new CTEQueryDecomposer().extractCTE(query, input.cteName), kind: 'cte-query-extraction', version: 1 };
  }
  const absentParameterNames = splitNames(input.absentParameterNames);
  const result = optimizeConditions(input.sql, {
    optionalConditionParameters: absentParameterNames.length > 0
      ? Object.fromEntries(absentParameterNames.map((name) => [name, undefined]))
      : undefined,
  });
  return JSON.parse(JSON.stringify({
    ...result,
    kind: 'sql-condition-optimization',
    version: 1,
    query: undefined,
    diagnostics: result.diagnostics ? { ...result.diagnostics, debugQuery: undefined } : undefined,
  })) as object;
}

function findUsage(input: DemoInput): object {
  if (!input.usageTarget.trim()) throw new Error('Enter a search target.');
  const scopeDir = normalizeDemoScope(input.scopeDir);
  const parsed = parseQueryTarget({ kind: input.usageKind, raw: input.usageTarget });
  const statements = demoSqlFiles()
    .filter((statement) => scopeDir === '.' || statement.sqlFile.startsWith(`${scopeDir}/`));
  const results = statements.map((statement) => input.usageKind === 'table'
    ? analyzeTableUsage({ statement, target: parsed.target, mode: parsed.mode })
    : analyzeColumnUsage({ statement, target: parsed.target, mode: parsed.mode }));
  return {
    kind: 'query-usage-search',
    version: 1,
    source: { kind: 'sql-files', scopeDir },
    target: parsed.target,
    summary: { sqlFilesScanned: statements.length },
    matches: results.flatMap((result) => result.matches),
    warnings: results.flatMap((result) => result.warnings),
  };
}

function commonInput(): DemoInput {
  return {
    absentParameterNames: '',
    cteName: '',
    ddl: `create table public.orders (
  order_id bigint primary key,
  customer_id bigint not null,
  amount numeric not null
);`,
    scopeDir: '.',
    selector: JSON.stringify({ path: [{ kind: 'root' }], version: 1 }, null, 2),
    sql: `select customer_id, sum(amount) as total_amount
from public.orders
where customer_id = :customer_id
group by customer_id;`,
    targetColumn: 'total_amount',
    usageKind: 'table',
    usageTarget: 'public.orders',
  };
}

function parseSelector(value: string): QueryScopeSelectorV1 {
  if (!value.trim()) throw new Error('Enter a query scope selector.');
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isQueryScopeSelector(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error('Enter a valid JSON query scope selector.');
  }
}

function isQueryScopeSelector(value: unknown): value is QueryScopeSelectorV1 {
  if (!isRecord(value) || !hasExactKeys(value, ['path', 'version']) || value.version !== 1) return false;
  if (!Array.isArray(value.path) || value.path.length === 0) return false;
  const [root, ...children] = value.path;
  if (!isRecord(root) || !hasExactKeys(root, ['kind']) || root.kind !== 'root') return false;
  return children.every(isQueryScopeChildSegment);
}

function isQueryScopeChildSegment(value: unknown): boolean {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'cte':
      return hasExactKeys(value, ['index', 'kind', 'name'])
        && isNonnegativeInteger(value.index)
        && typeof value.name === 'string'
        && value.name.length > 0;
    case 'source_subquery':
      return hasExactKeys(value, ['index', 'kind', 'source'])
        && isNonnegativeInteger(value.index)
        && (value.source === 'from' || value.source === 'join');
    case 'expression_subquery':
      return hasExactKeys(value, ['clause', 'index', 'kind', 'subqueryKind'])
        && queryScopeExpressionClauses.has(value.clause)
        && isNonnegativeInteger(value.index)
        && (value.subqueryKind === 'scalar_subquery' || value.subqueryKind === 'exists' || value.subqueryKind === 'in_subquery');
    case 'set_branch':
      return hasExactKeys(value, ['kind', 'side']) && (value.side === 'left' || value.side === 'right');
    default:
      return false;
  }
}

const queryScopeExpressionClauses = new Set<unknown>([
  'fetch', 'from', 'group_by', 'having', 'join', 'limit', 'offset',
  'order_by', 'select', 'values', 'where', 'window',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function normalizeDemoScope(value: string): string {
  const normalized = value.trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '') || '.';
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error('Enter a workspace-relative search directory.');
  }
  return normalized;
}

function demoSqlFiles(): CatalogStatement[] {
  return [
    {
      catalogId: 'file:queries/orders/list.sql',
      queryId: 'file:queries/orders/list.sql:1',
      statementFingerprint: 'browser-demo-orders',
      sqlFile: 'queries/orders/list.sql',
      statementIndex: 1,
      statementText: 'select customer_id, amount from public.orders where customer_id = :customer_id',
      statementStartOffsetInFile: 0,
    },
    {
      catalogId: 'file:archive/orders.sql',
      queryId: 'file:archive/orders.sql:1',
      statementFingerprint: 'browser-demo-archive',
      sqlFile: 'archive/orders.sql',
      statementIndex: 1,
      statementText: 'select order_id from public.orders',
      statementStartOffsetInFile: 0,
    },
  ];
}

function toDdl(ddl: string): DdlInput[] | undefined {
  return ddl.trim() ? [{ filePath: 'demo/schema.sql', sql: ddl }] : undefined;
}

function splitNames(value: string): string[] {
  return value.split(',').map((name) => name.trim()).filter(Boolean);
}
