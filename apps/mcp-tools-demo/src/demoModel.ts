import {
  analyzeColumnLineage,
  analyzeQueryStructure,
  generateFixtureExtractionPlan,
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
} from 'rawsql-ts';

export const demoToolIds = [
  'analyze_query_structure',
  'analyze_column_lineage',
  'create_fixture_extraction_plan',
  'find_query_usage',
  'extract_cte_query',
  'optimize_sql_conditions',
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
    id: 'analyze_query_structure',
    label: 'Analyze query structure',
    summary: 'Summarizes tables, CTEs, nesting, joins, filters, grouping, and other structural features of a query.',
  },
  {
    id: 'analyze_column_lineage',
    label: 'Analyze column lineage',
    summary: 'Traces one final output column to its value sources and the filters, joins, and aggregates that may affect it.',
  },
  {
    id: 'create_fixture_extraction_plan',
    label: 'Create fixture extraction plan',
    summary: 'Finds a bounded predicate from SQL and DDL and produces capture SELECT statements only where the boundary can be proven statically.',
    experimental: true,
  },
  {
    id: 'find_query_usage',
    label: 'Find table and column usage',
    summary: 'Recursively searches .sql files in a directory for table or column usage and reports the SQL clause for each match.',
  },
  {
    id: 'extract_cte_query',
    label: 'Create a CTE inspection query',
    summary: 'Extracts one CTE with its required dependencies and expands it into SQL that can be inspected independently.',
  },
  {
    id: 'optimize_sql_conditions',
    label: 'Optimize SQL conditions',
    summary: 'Moves conditions, prunes optional branches, and removes duplicate predicates only where the rewrite is statically proven safe.',
  },
];

export interface DemoInput {
  absentParameterNames: string;
  cteName: string;
  ddl: string;
  scopeDir: string;
  sql: string;
  targetColumn: string;
  usageKind: 'table' | 'column';
  usageTarget: string;
}

export const initialInputs: Record<DemoToolId, DemoInput> = {
  analyze_query_structure: commonInput(),
  analyze_column_lineage: commonInput(),
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
};

export function runDemoTool(toolId: DemoToolId, input: DemoInput): object {
  if (toolId === 'find_query_usage') return findUsage(input);
  if (!input.sql.trim()) throw new Error('Enter SQL.');
  const ddl = toDdl(input.ddl);
  const staticInput = { sql: input.sql, ...(ddl ? { ddl } : {}) };
  if (toolId === 'analyze_query_structure') return analyzeQueryStructure(staticInput);
  if (toolId === 'analyze_column_lineage') {
    if (!input.targetColumn.trim()) throw new Error('Enter an output column name.');
    return analyzeColumnLineage({ ...staticInput, targetColumn: input.targetColumn });
  }
  if (toolId === 'create_fixture_extraction_plan') return generateFixtureExtractionPlan(staticInput);
  if (toolId === 'extract_cte_query') {
    if (!input.cteName.trim()) throw new Error('Enter a CTE name.');
    const query = SelectQueryParser.parse(input.sql);
    if (!(query instanceof SimpleSelectQuery)) throw new Error('Enter a simple SELECT query.');
    return { kind: 'cte-query-extraction', version: 1, ...new CTEQueryDecomposer().extractCTE(query, input.cteName) };
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
    sql: `select customer_id, sum(amount) as total_amount
from public.orders
where customer_id = :customer_id
group by customer_id;`,
    targetColumn: 'total_amount',
    usageKind: 'table',
    usageTarget: 'public.orders',
  };
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
