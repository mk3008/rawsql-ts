import {
  IdentifierString,
  MultiQuerySplitter,
  RawString,
  SqlComponent,
  SqlFormatter,
  SqlParser,
  QualifiedName
} from 'rawsql-ts';

export type StatementGroup = 'createSchema' | 'createTable' | 'view' | 'alterTable' | 'sequence' | 'index';

export interface NormalizedStatement {
  schema: string;
  objectName: string;
  group: StatementGroup;
  sql: string;
}

interface NormalizationOptions {
  allowedSchemas?: Set<string>;
}

const SqlFormatterOptions = {
  keywordCase: 'lower',
  indentSize: 2,
  indentChar: ' ',
  newline: '\n',
  commaBreak: 'after',
  exportComment: 'none'
} as const;

const ddlFormatter = new SqlFormatter(SqlFormatterOptions);

const groupOrder: Record<StatementGroup, number> = {
  createSchema: 0,
  createTable: 1,
  view: 2,
  alterTable: 3,
  sequence: 4,
  index: 5
};

export function normalizePulledSchema(rawSql: string, options: NormalizationOptions = {}): Map<string, NormalizedStatement[]> {
  const cleanedSql = stripPgDumpNoise(rawSql);
  const queries = MultiQuerySplitter.split(cleanedSql).queries;
  const schemaMap = new Map<string, NormalizedStatement[]>();

  // Iterate over each statement to normalize, bucket by schema, and honor any active filters.
  for (const query of queries) {
    const statementText = query.sql.trim();
    if (!statementText || shouldSkipStatement(statementText)) {
      continue;
    }

    const normalized = processStatement(statementText);
    if (!normalized) {
      continue;
    }

    if (options.allowedSchemas && options.allowedSchemas.size > 0 && !options.allowedSchemas.has(normalized.schema)) {
      continue;
    }

    const bucket = schemaMap.get(normalized.schema) ?? [];
    bucket.push(normalized);
    schemaMap.set(normalized.schema, bucket);
  }
  // Ensure every included schema has a CREATE SCHEMA statement even if pg_dump omitted it.
  for (const [schema, statements] of schemaMap) {
    if (statements.some((entry) => entry.group === 'createSchema')) {
      continue;
    }
    statements.push({
      schema,
      objectName: schema,
      group: 'createSchema',
      sql: finalizeRawStatement(`create schema ${schema}`)
    });
  }

  // Ensure the statements for each schema are returned in a deterministic order.
  for (const statements of schemaMap.values()) {
    statements.sort((a, b) => {
      const primary = groupOrder[a.group] - groupOrder[b.group];
      if (primary !== 0) {
        return primary;
      }
      return a.objectName.localeCompare(b.objectName);
    });
  }

  return schemaMap;
}

function stripPgDumpNoise(rawSql: string): string {
  // Remove pg_dump meta commands and standalone comments so the parser only sees SQL statements.
  const normalizedNewlines = rawSql.replace(/\r\n/g, '\n');
  return normalizedNewlines
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return true;
      }
      if (trimmed.startsWith('\\') || trimmed.startsWith('--')) {
        return false;
      }
      return true;
    })
    .join('\n');
}

function shouldSkipStatement(statement: string): boolean {
  // Strip handles comments and meta commands earlier, so skip only runtime statements we still want to ignore.
  const lower = statement.toLowerCase();
  if (lower.startsWith('set ') || lower.startsWith('select ')) {
    return true;
  }
  if (lower.startsWith('comment ') || lower.startsWith('drop ')) {
    return true;
  }
  if (lower.startsWith('create extension') || lower.startsWith('create type')) {
    return true;
  }
  return false;
}

function processStatement(statement: string): NormalizedStatement | null {
  const lower = statement.toLowerCase();

  // Route statements by their leading keywords to dedicated handlers.
  if (lower.startsWith('create schema')) {
    return buildCreateSchemaStatement(statement);
  }

  if (lower.startsWith('create view') || lower.startsWith('create or replace view')) {
    return buildViewStatement(statement);
  }

  if (lower.startsWith('create table') || lower.startsWith('create temporary table')) {
    return buildAstStatement(statement, 'createTable', (ast) => ast.tableName);
  }

  if (lower.startsWith('alter table')) {
    return buildAstStatement(statement, 'alterTable', (ast) => ast.table);
  }

  if (lower.startsWith('create index') || lower.startsWith('create unique index')) {
    return buildAstStatement(statement, 'index', (ast) => ast.tableName);
  }

  if (lower.startsWith('create sequence')) {
    return buildAstStatement(statement, 'sequence', (ast) => ast.sequenceName);
  }

  if (lower.startsWith('alter sequence')) {
    return buildAstStatement(statement, 'sequence', (ast) => ast.sequenceName);
  }

  return null;
}

function buildCreateSchemaStatement(statement: string): NormalizedStatement | null {
  // SqlParser does not yet support CREATE SCHEMA statements, so fall back to regex parsing.
  const match = statement.match(/create\s+schema\s+(?:if\s+not\s+exists\s+)?(.+?)(?:\s|;|$)/i);
  if (!match) {
    return null;
  }
  const schemaName = normalizeIdentifier(match[1].trim());
  return {
    schema: schemaName,
    objectName: schemaName,
    group: 'createSchema',
    sql: finalizeRawStatement(statement)
  };
}

function buildViewStatement(statement: string): NormalizedStatement | null {
  // SqlParser is not able to parse CREATE VIEW statements yet, so use a regex fallback.
  const match = statement.match(/create\s+(?:or\s+replace\s+)?view\s+(.+?)\s+as\b/i);
  if (!match) {
    return null;
  }
  const namePart = match[1].trim().split(/\s*\(/)[0].trim();
  const { schema, object } = splitQualifiedIdentifier(namePart);
  return {
    schema,
    objectName: object,
    group: 'view',
    sql: finalizeRawStatement(statement)
  };
}

function buildAstStatement(
  statement: string,
  group: StatementGroup,
  qualifier: (ast: any) => QualifiedName
): NormalizedStatement | null {
  try {
    // Parse the statement with rawsql-ts and convert it back to formatted SQL.
    const ast = SqlParser.parse(statement);
    const qualifierName = qualifier(ast);
    const { schema, object } = extractQualifiedInfo(qualifierName);
    return {
      group,
      schema,
      objectName: object,
      sql: formatAstStatement(ast)
    };
  } catch {
    return null;
  }
}

function formatAstStatement(component: SqlComponent): string {
  const { formattedSql } = ddlFormatter.format(component);
  const trimmed = formattedSql.trim();
  return trimmed.endsWith(';') ? trimmed : `${trimmed};`;
}

function finalizeRawStatement(statement: string): string {
  const trimmed = statement.trim();
  return trimmed.endsWith(';') ? trimmed : `${trimmed};`;
}

function extractQualifiedInfo(name: QualifiedName): { schema: string; object: string } {
  // Convert the qualified components into lowercase, unquoted tokens for deterministic grouping.
  const schemaValue =
    name.namespaces && name.namespaces.length > 0 ? name.namespaces[name.namespaces.length - 1] : null;
  const schema = schemaValue ? normalizeIdentifier(schemaValue) : 'public';
  const object = normalizeIdentifier(name.name);
  return { schema, object };
}

function normalizeIdentifier(value: IdentifierString | RawString | string): string {
  const raw = typeof value === 'string' ? value : value instanceof RawString ? value.value : value.name;
  return raw.replace(/^"|"$/g, '').toLowerCase();
}

function splitQualifiedIdentifier(input: string): { schema: string; object: string } {
  const pattern = /^\s*(?:"([^"]+)"|([^".\s]+))(?:\.(?:"([^"]+)"|([^".\s]+)))?\s*$/;
  const match = input.match(pattern);
  let schema = 'public';
  let object = input;

  if (match) {
    const firstPart = match[1] ?? match[2];
    const secondPart = match[3] ?? match[4];
    if (secondPart) {
      schema = firstPart ?? 'public';
      object = secondPart;
    } else if (firstPart) {
      object = firstPart;
    }
  }

  return {
    schema: normalizeIdentifier(schema),
    object: normalizeIdentifier(object)
  };
}
