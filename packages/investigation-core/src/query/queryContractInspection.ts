import {
  ColumnReference,
  CTECollector,
  ParameterCollector,
  SelectOutputCollector,
  SelectQueryParser,
  SimpleSelectQuery,
  TableSource,
  TableSourceCollector,
  type SelectOutputColumn,
} from 'rawsql-ts';
import {
  createTableColumnResolver,
  parseSchemaFactsFromDdl,
  resolveTableFacts,
  type DdlInput,
  type SchemaFacts,
} from '../lineage/schemaFacts';

export interface QueryContractDiagnosticV1 {
  code: string;
  filePath?: string;
  message: string;
  severity: 'error' | 'info' | 'warning';
}

export interface QueryContractParameterV1 {
  index?: number;
  name?: string;
  occurrenceIndex: number;
  sourceText: string;
  style: 'anonymous' | 'indexed' | 'named';
}

export interface QueryContractOutputColumnV1 {
  name?: string;
  nullable?: boolean;
  outputIndex: number;
  source?: {
    columnName: string;
    tableName: string;
  };
  type?: string;
}

export interface QueryContractReferencedTableV1 {
  name: string;
  qualifiedName: string;
  schemaName?: string;
}

export interface QueryContractInspectionInputV1 {
  ddl?: DdlInput[];
  schemaFacts?: SchemaFacts;
  sql: string;
}

export interface QueryContractInspectionV1 {
  diagnostics: QueryContractDiagnosticV1[];
  kind: 'query-contract-inspection';
  outputColumns: QueryContractOutputColumnV1[];
  parameters: QueryContractParameterV1[];
  parserVersion: string;
  referencedTables: QueryContractReferencedTableV1[];
  version: 1;
}

/**
 * Inspect the caller-facing contract of one SELECT statement without exposing AST nodes.
 * DDL-backed type and nullability facts are included only for directly proven sources.
 */
export function inspectQueryContract(input: QueryContractInspectionInputV1): QueryContractInspectionV1 {
  const schemaFacts = input.schemaFacts ?? (input.ddl && input.ddl.length > 0 ? parseSchemaFactsFromDdl(input.ddl) : undefined);
  const diagnostics: QueryContractDiagnosticV1[] = (schemaFacts?.diagnostics ?? []).map((diagnostic) => ({
    code: diagnostic.code,
    ...(diagnostic.filePath ? { filePath: diagnostic.filePath } : {}),
    message: diagnostic.message,
    severity: diagnostic.severity,
  }));
  const parsed = SelectQueryParser.analyze(input.sql);
  if (!parsed.success || !parsed.query) {
    diagnostics.push({
      code: 'QUERY_CONTRACT_PARSE_ERROR',
      message: parsed.error ?? 'SQL could not be parsed as one SELECT statement.',
      severity: 'error',
    });
    return contractResult(diagnostics);
  }

  const query = parsed.query;
  const parameters = ParameterCollector.collect(query).map((parameter, occurrenceIndex) => {
    const sourceText = parameter.sourceText ?? `:${parameter.name.value}`;
    if (sourceText === '?') {
      return { occurrenceIndex, sourceText, style: 'anonymous' as const };
    }
    if (/^\$\d+$/.test(sourceText)) {
      return {
        index: Number(sourceText.slice(1)),
        occurrenceIndex,
        sourceText,
        style: 'indexed' as const,
      };
    }
    return {
      name: parameter.name.value,
      occurrenceIndex,
      sourceText,
      style: 'named' as const,
    };
  });
  const referencedTables = new TableSourceCollector(false).collect(query)
    .map((table) => {
      const schemaName = table.namespaces?.map((namespace) => namespace.name).join('.') || undefined;
      const name = table.table.name;
      return {
        name,
        qualifiedName: schemaName ? `${schemaName}.${name}` : name,
        ...(schemaName ? { schemaName } : {}),
      };
    })
    .sort((left, right) => left.qualifiedName.localeCompare(right.qualifiedName));
  const outputColumns = collectOutputColumns(query, schemaFacts, diagnostics);

  return {
    diagnostics,
    kind: 'query-contract-inspection',
    outputColumns,
    parameters,
    parserVersion: 'rawsql-ts',
    referencedTables,
    version: 1,
  };
}

function collectOutputColumns(
  query: Parameters<typeof ParameterCollector.collect>[0],
  schemaFacts: SchemaFacts | undefined,
  diagnostics: QueryContractDiagnosticV1[],
): QueryContractOutputColumnV1[] {
  if (!(query instanceof SimpleSelectQuery)) {
    diagnostics.push({
      code: 'QUERY_CONTRACT_OUTPUT_SHAPE_UNSUPPORTED',
      message: 'Output-column inspection currently supports one simple SELECT root.',
      severity: 'warning',
    });
    return [];
  }

  const resolver = schemaFacts ? createTableColumnResolver(schemaFacts) : null;
  const collected = new SelectOutputCollector(resolver).collect(query);
  const hasWildcard = query.selectClause.items.some((item) =>
    item.value instanceof ColumnReference && item.value.column.name === '*'
  );
  if (hasWildcard) {
    if (collected.length === 0) {
      diagnostics.push({
        code: 'WILDCARD_OUTPUT_UNRESOLVED',
        message: 'Wildcard output columns require resolvable DDL or query-defined source columns.',
        severity: 'warning',
      });
      return [];
    }
    return collected.map((output) => outputContract(query, output, schemaFacts));
  }

  if (collected.length === query.selectClause.items.length) {
    return collected.map((output) => outputContract(query, output, schemaFacts));
  }

  return query.selectClause.items.map((item, outputIndex) => ({
    outputIndex,
    ...(item.identifier?.name
      ? { name: item.identifier.name }
      : item.value instanceof ColumnReference
        ? { name: item.value.column.name }
        : {}),
  }));
}

function outputContract(
  query: SimpleSelectQuery,
  output: SelectOutputColumn,
  schemaFacts: SchemaFacts | undefined,
): QueryContractOutputColumnV1 {
  const source = output.sourceName && output.sourceColumnName
    ? { columnName: output.sourceColumnName, tableName: output.sourceName }
    : undefined;
  const columnFacts = source
    ? resolveTableFacts(schemaFacts, source.tableName)?.columns[source.columnName]
    : undefined;
  const nullable = outputNullability(query, output, columnFacts?.nullable);
  return {
    name: output.name,
    outputIndex: output.outputIndex,
    ...(source ? { source } : {}),
    ...(columnFacts?.type ? { type: columnFacts.type } : {}),
    ...(nullable === undefined ? {} : { nullable }),
  };
}

function outputNullability(
  query: SimpleSelectQuery,
  output: SelectOutputColumn,
  sourceNullable: boolean | undefined,
): boolean | undefined {
  const sourceIndex = directPhysicalSourceIndex(query, output);
  if (sourceNullable === undefined || sourceIndex === undefined) {
    return undefined;
  }
  if (sourceNullable) {
    return sourceNullable;
  }
  return isSourceProvenNotNullExtended(query, sourceIndex) ? false : undefined;
}

function directPhysicalSourceIndex(query: SimpleSelectQuery, output: SelectOutputColumn): number | undefined {
  if (!query.fromClause || !output.sourceName) {
    return undefined;
  }

  const cteNames = new Set(new CTECollector().collect(query).map((cte) => cte.getSourceAliasName()));
  if (cteNames.has(output.sourceName)) {
    return undefined;
  }

  const sources = query.fromClause.getSources();
  const matchingIndexes = sources.flatMap((source, sourceIndex) => {
    if (!(source.datasource instanceof TableSource) || source.datasource.getSourceName() !== output.sourceName) {
      return [];
    }
    const matchNames = new Set([
      source.getAliasName(),
      source.datasource.getSourceName(),
      source.datasource.table.name,
    ].filter((name): name is string => Boolean(name)));
    return output.sourceAlias && !matchNames.has(output.sourceAlias) ? [] : [sourceIndex];
  });
  if (matchingIndexes.length !== 1) {
    return undefined;
  }

  return matchingIndexes[0];
}

function isSourceProvenNotNullExtended(query: SimpleSelectQuery, sourceIndex: number): boolean {
  if (!query.fromClause) return false;
  const nullableSourceIndexes = new Set<number>();
  for (const [joinIndex, join] of (query.fromClause.joins ?? []).entries()) {
    const sourceIndex = joinIndex + 1;
    const joinType = normalizeJoinType(join.joinType.value);
    if (joinType === 'unknown') {
      return false;
    }
    if (joinType === 'left') {
      nullableSourceIndexes.add(sourceIndex);
    } else if (joinType === 'right') {
      for (let index = 0; index < sourceIndex; index += 1) {
        nullableSourceIndexes.add(index);
      }
    } else if (joinType === 'full') {
      for (let index = 0; index <= sourceIndex; index += 1) {
        nullableSourceIndexes.add(index);
      }
    }
  }

  return !nullableSourceIndexes.has(sourceIndex);
}

function normalizeJoinType(value: string): 'full' | 'inner' | 'left' | 'right' | 'unknown' {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('left')) return 'left';
  if (normalized.includes('right')) return 'right';
  if (normalized.includes('full')) return 'full';
  if (normalized === 'join' || normalized.includes('inner') || normalized.includes('cross')) return 'inner';
  return 'unknown';
}

function contractResult(diagnostics: QueryContractDiagnosticV1[]): QueryContractInspectionV1 {
  return {
    diagnostics,
    kind: 'query-contract-inspection',
    outputColumns: [],
    parameters: [],
    parserVersion: 'rawsql-ts',
    referencedTables: [],
    version: 1,
  };
}

// API output shape review: this DTO exposes stable caller facts only; parsed
// models and expression SQL remain internal, and uncertain schema facts are omitted.
