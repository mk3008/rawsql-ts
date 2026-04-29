import { MultiQuerySplitter, SelectQueryParser, CTETableReferenceCollector, normalizeTableName } from 'rawsql-ts';
import type { SelectQuery } from 'rawsql-ts';
import { TableNameResolver } from './TableNameResolver';

export interface DdlViewDefinition {
  name: string;
  cteName: string;
  sql: string;
  source?: string;
  statementIndex?: number;
}

export interface DdlViewSource {
  path: string;
  sql: string;
}

export interface DdlViewCatalogOptions {
  tableNameResolver?: TableNameResolver;
}

export interface ViewCteDefinition {
  name: string;
  query: SelectQuery;
}

export class DdlViewUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DdlViewUnsupportedError';
  }
}

interface IndexedView {
  definition: DdlViewDefinition;
  dependencies: string[];
}

export function collectDdlViewDefinitions(
  sources: DdlViewSource[],
  options: DdlViewCatalogOptions = {}
): DdlViewDefinition[] {
  const definitions: DdlViewDefinition[] = [];

  for (const source of sources) {
    const split = MultiQuerySplitter.split(source.sql);
    for (const query of split.queries) {
      if (query.isEmpty) {
        continue;
      }

      const definition = parseCreateViewStatement(query.sql, {
        source: source.path,
        statementIndex: query.index,
        tableNameResolver: options.tableNameResolver
      });
      if (definition) {
        definitions.push(definition);
      }
    }
  }

  new DdlViewCatalog(definitions, options);
  return definitions;
}

export class DdlViewCatalog {
  private readonly views = new Map<string, IndexedView>();
  private readonly leafIndex = new Map<string, string[]>();
  private readonly resolver?: TableNameResolver;

  constructor(definitions: DdlViewDefinition[] = [], options: DdlViewCatalogOptions = {}) {
    this.resolver = options.tableNameResolver;
    for (const definition of definitions) {
      const key = this.resolveDefinitionKey(definition.name);
      if (this.views.has(key)) {
        throw new DdlViewUnsupportedError(`Duplicate CREATE VIEW definition for "${definition.name}".`);
      }

      const indexed = {
        definition: {
          ...definition,
          name: key,
          cteName: definition.cteName || extractUnqualifiedName(key)
        },
        dependencies: []
      };
      this.views.set(key, indexed);

      const leaf = normalizeTableName(indexed.definition.cteName);
      const bucket = this.leafIndex.get(leaf) ?? [];
      bucket.push(key);
      this.leafIndex.set(leaf, bucket);
    }

    for (const [key, indexed] of this.views.entries()) {
      indexed.dependencies = this.collectViewDependencies(indexed.definition).filter((dependency) => dependency !== key);
    }
    this.assertAcyclic();
  }

  public hasView(tableName: string): boolean {
    return this.resolveViewKey(tableName) !== undefined;
  }

  public getView(tableName: string): DdlViewDefinition | undefined {
    const key = this.resolveViewKey(tableName);
    return key ? this.views.get(key)?.definition : undefined;
  }

  public expandReferencedViews(tableNames: string[], existingCteNames: ReadonlySet<string> = new Set()): DdlViewDefinition[] {
    const ordered: DdlViewDefinition[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (key: string): void => {
      if (visited.has(key)) {
        return;
      }
      if (visiting.has(key)) {
        throw new DdlViewUnsupportedError(`Circular CREATE VIEW dependency detected at "${this.views.get(key)?.definition.name ?? key}".`);
      }

      const view = this.views.get(key);
      if (!view) {
        return;
      }

      visiting.add(key);
      for (const dependency of view.dependencies) {
        visit(dependency);
      }
      visiting.delete(key);
      visited.add(key);

      if (!existingCteNames.has(normalizeTableName(view.definition.cteName))) {
        ordered.push(view.definition);
      }
    };

    for (const tableName of tableNames) {
      const key = this.resolveViewKey(tableName);
      if (key) {
        visit(key);
      }
    }

    return ordered;
  }

  public toCteDefinitions(definitions: DdlViewDefinition[]): ViewCteDefinition[] {
    return definitions.map((definition) => ({
      name: definition.cteName,
      query: SelectQueryParser.parse(definition.sql)
    }));
  }

  public collectReferencedTables(definitions: DdlViewDefinition[]): string[] {
    const names = new Set<string>();
    for (const definition of definitions) {
      for (const tableName of collectSelectTableNames(definition.sql)) {
        names.add(tableName);
      }
    }
    return [...names];
  }

  public createAliasMap(definitions: DdlViewDefinition[]): Map<string, string> {
    const aliasMap = new Map<string, string>();
    for (const definition of definitions) {
      aliasMap.set(this.resolveDefinitionKey(definition.name), definition.cteName);
    }
    return aliasMap;
  }

  private resolveDefinitionKey(tableName: string): string {
    if (this.resolver) {
      return this.resolver.resolve(tableName);
    }
    return normalizeTableName(tableName);
  }

  private resolveViewKey(tableName: string): string | undefined {
    if (this.resolver) {
      const key = this.resolver.resolve(tableName, (candidate) => this.views.has(candidate));
      return this.views.has(key) ? key : undefined;
    }

    const normalized = normalizeTableName(tableName);
    if (this.views.has(normalized)) {
      return normalized;
    }

    const leaf = extractUnqualifiedName(normalized);
    const candidates = this.leafIndex.get(leaf) ?? [];
    if (candidates.length === 1) {
      return candidates[0];
    }
    if (candidates.length > 1) {
      throw new DdlViewUnsupportedError(`Ambiguous unqualified CREATE VIEW reference "${tableName}".`);
    }
    return undefined;
  }

  private collectViewDependencies(definition: DdlViewDefinition): string[] {
    const dependencies = new Set<string>();
    for (const tableName of collectSelectTableNames(definition.sql)) {
      const dependency = this.resolveViewKey(tableName);
      if (dependency) {
        dependencies.add(dependency);
      }
    }
    return [...dependencies];
  }

  private assertAcyclic(): void {
    for (const key of this.views.keys()) {
      this.expandReferencedViews([key]);
    }
  }
}

function parseCreateViewStatement(
  sql: string,
  options: {
    source?: string;
    statementIndex?: number;
    tableNameResolver?: TableNameResolver;
  }
): DdlViewDefinition | undefined {
  const trimmed = sql.trim().replace(/;+\s*$/, '');
  if (!/^create\b/i.test(trimmed)) {
    return undefined;
  }

  if (/^create\s+(?:or\s+replace\s+)?materialized\s+view\b/i.test(trimmed)) {
    throw new DdlViewUnsupportedError('CREATE MATERIALIZED VIEW is not supported by ZTD view shadowing.');
  }
  if (/^create\s+(?:or\s+replace\s+)?recursive\s+view\b/i.test(trimmed)) {
    throw new DdlViewUnsupportedError('CREATE RECURSIVE VIEW is not supported by ZTD view shadowing.');
  }

  const isCreateViewStatement = /^create\s+(?:or\s+replace\s+)?view\b/i.test(trimmed);
  const match = trimmed.match(
    /^create\s+(?:or\s+replace\s+)?view\s+(?:if\s+not\s+exists\s+)?((?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\.(?:"[^"]+"|[a-zA-Z_][\w$]*))?)\s*(?:\([^)]*\))?\s+as\s+([\s\S]+)$/i
  );
  if (!match) {
    if (isCreateViewStatement) {
      throw new DdlViewUnsupportedError('CREATE VIEW uses unsupported syntax for ZTD view shadowing.');
    }
    return undefined;
  }

  const rawName = normalizeIdentifierPath(match[1]);
  const body = match[2].trim();
  if (/^with\s+recursive\b/i.test(body)) {
    throw new DdlViewUnsupportedError(`Recursive CREATE VIEW body is not supported for "${rawName}".`);
  }

  try {
    SelectQueryParser.parse(body);
  } catch (error) {
    throw new DdlViewUnsupportedError(
      `CREATE VIEW "${rawName}" must contain a supported SELECT body: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const resolvedName = options.tableNameResolver
    ? options.tableNameResolver.resolve(rawName)
    : normalizeTableName(rawName);

  return {
    name: resolvedName,
    cteName: extractUnqualifiedName(resolvedName),
    sql: body,
    source: options.source,
    statementIndex: options.statementIndex
  };
}

function collectSelectTableNames(sql: string): string[] {
  const parsed = SelectQueryParser.parse(sql);
  const collector = new CTETableReferenceCollector();
  const names = new Set<string>();
  for (const source of collector.collect(parsed)) {
    names.add(source.getSourceName().toLowerCase());
  }
  return [...names];
}

function normalizeIdentifierPath(value: string): string {
  return value
    .split('.')
    .map((part) => part.trim().replace(/^"/, '').replace(/"$/, ''))
    .join('.');
}

function extractUnqualifiedName(value: string): string {
  const parts = normalizeTableName(value).split('.');
  return parts[parts.length - 1] ?? normalizeTableName(value);
}
