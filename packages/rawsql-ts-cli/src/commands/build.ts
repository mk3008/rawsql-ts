import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  CTEComposer,
  SelectQueryParser,
  TableSourceCollector,
  type EditedCTE,
  type SelectQuery,
  type SimpleSelectQuery,
  type CTEComposerOptions,
} from 'rawsql-ts';
import { collectSqlFiles, ensureDirectoryExists, stripBom } from '../utils/filesystem.js';
import { loadRawSqlConfig, type RawSqlCliConfig } from '../utils/config.js';

type BuildArgs = {
  targets: string[];
  verbose: boolean;
};

type ResourceIndexEntry = {
  name: string;
  normalized: string;
  filePath: string;
};

type ResourceData = {
  entry: ResourceIndexEntry;
  sql: string;
  dependencies: string[];
};

type BuildContext = {
  resourceIndex: Map<string, ResourceIndexEntry>;
  resourceCache: Map<string, ResourceData>;
};

type BuildResult = {
  sourcePath: string;
  ctes: string[];
  missing: string[];
};

type TableSourceLike = { table: { name: string } };

export async function buildCommand(args: string[]): Promise<void> {
  const { targets, verbose } = parseArgs(args);
  const cwd = process.cwd();
  const rootDir = path.resolve(cwd, 'rawsql', 'root');
  const resourcesDir = path.resolve(cwd, 'rawsql', 'resources');

  await ensureDirectoryExists(rootDir, 'rawsql/root directory');
  await ensureDirectoryExists(resourcesDir, 'rawsql/resources directory');

  // Load formatter preferences from rawsql.config if present.
  const loadedConfig = await loadRawSqlConfig(cwd);
  // Merge formatter defaults with composer overrides to configure CTEComposer.
  const composerOptions = resolveComposerOptions(loadedConfig?.config);

  const files = targets.length > 0
    ? await resolveTargetFiles(targets)
    : await collectSqlFiles(rootDir);

  if (files.length === 0) {
    console.log('No .sql files found to build.');
    return;
  }

  const resourceIndex = await buildResourceIndex(resourcesDir);
  const context: BuildContext = {
    resourceIndex,
    resourceCache: new Map(),
  };

  const results: BuildResult[] = [];

  for (const filePath of files) {
    const result = await buildSingleFile(filePath, context, verbose, composerOptions);
    results.push(result);
  }

  for (const result of results) {
    const relativeInput = path.relative(cwd, result.sourcePath);
    const cteInfo = result.ctes.length > 0 ? `CTEs: ${result.ctes.join(', ')}` : 'CTEs: none';
    console.log(`[build] ${relativeInput} (${cteInfo})`);
    if (verbose && result.missing.length > 0) {
      console.log(`        Skipped unresolved tables: ${result.missing.join(', ')}`);
    }
  }
}

function resolveComposerOptions(config?: RawSqlCliConfig): CTEComposerOptions | undefined {
  if (!config) {
    return undefined;
  }

  // Layer formatter defaults under composer-specific overrides for deterministic merging.
  const formatterOptions = config.formatter ?? {};
  const composerOverrides = config.cteComposer ?? {};

  return { ...formatterOptions, ...composerOverrides };
}

function parseArgs(args: string[]): BuildArgs {
  const targets: string[] = [];
  let verbose = false;

  for (const arg of args) {
    if (arg === '--verbose') {
      verbose = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option for build command: ${arg}`);
    } else {
      targets.push(arg);
    }
  }

  return { targets, verbose };
}

async function resolveTargetFiles(targets: string[]): Promise<string[]> {
  const resolved = new Set<string>();

  for (const target of targets) {
    const absolute = path.resolve(process.cwd(), target);
    let stats;
    try {
      stats = await fs.stat(absolute);
    } catch {
      throw new Error(`Target not found: ${target}`);
    }

    if (stats.isDirectory()) {
      const files = await collectSqlFiles(absolute);
      files.forEach((filePath) => resolved.add(filePath));
    } else if (stats.isFile()) {
      if (!absolute.toLowerCase().endsWith('.sql') || absolute.toLowerCase().endsWith('.built.sql')) {
        throw new Error(`Target must be a source .sql file: ${target}`);
      }
      resolved.add(absolute);
    }
  }

  return Array.from(resolved).sort();
}

async function buildSingleFile(filePath: string, context: BuildContext, verbose: boolean, composerOptions?: CTEComposerOptions): Promise<BuildResult> {
  const rawContent = await fs.readFile(filePath, 'utf8');
  const { sql: originalSql, hadSemicolon } = prepareSql(rawContent);

  // Instantiate the composer with user-defined formatting overrides when available.
  const composer = new CTEComposer(composerOptions);
  let rootQuery: SelectQuery;
  let rootWithoutWith: string;

  try {
    rootWithoutWith = composer.removeWithClauses(originalSql);
    rootQuery = SelectQueryParser.parse(rootWithoutWith);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse SQL (${filePath}): ${message}`);
  }

  const references = collectReferencedNames(rootQuery);
  const { resources, missing } = await resolveResources(references, context);

  if (verbose && references.size > 0) {
    const displayNames = Array.from(references.values());
    console.log(`[build] ${path.relative(process.cwd(), filePath)} references: ${displayNames.join(', ')}`);
  }

  const ctes: EditedCTE[] = resources.map((resource) => ({
    name: resource.entry.name,
    query: resource.sql,
  }));

  const composedSql = ctes.length > 0 ? composer.compose(ctes, rootWithoutWith) : rootWithoutWith;
  const finalSql = appendTerminator(composedSql, hadSemicolon);

  await fs.writeFile(filePath, finalSql);

  return {
    sourcePath: filePath,
    ctes: ctes.map((cte) => cte.name),
    missing,
  };
}

function prepareSql(content: string): { sql: string; hadSemicolon: boolean } {
  const trimmed = stripBom(content).trim();
  if (trimmed.length === 0) {
    throw new Error('SQL file is empty.');
  }

  const hadSemicolon = trimmed.endsWith(';');
  const sql = hadSemicolon ? trimmed.slice(0, -1).trimEnd() : trimmed;
  return { sql, hadSemicolon };
}

function appendTerminator(sql: string, hadSemicolon: boolean): string {
  const trimmed = sql.trimEnd();
  const terminated = hadSemicolon ? `${trimmed};` : trimmed;
  return `${terminated}\n`;
}

function parseSelect(sql: string, filePath: string): SelectQuery {
  try {
    return SelectQueryParser.parse(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse SQL (${filePath}): ${message}`);
  }
}


function enforceNoManualCte(query: SimpleSelectQuery, filePath: string): void {
  if (query.withClause && query.withClause.tables.length > 0) {
    throw new Error(`WITH clause is not allowed in SQL resource (found in ${filePath}).`);
  }
}

function collectReferencedNames(query: SelectQuery): Map<string, string> {
  const collector = new TableSourceCollector(false);
  const sources = collector.collect(query) as TableSourceLike[];
  const names = new Map<string, string>();

  for (const source of sources) {
    const tableName = source.table.name;
    const normalized = tableName.toLowerCase();
    if (!names.has(normalized)) {
      names.set(normalized, tableName);
    }
  }

  return names;
}

async function resolveResources(references: Map<string, string>, context: BuildContext): Promise<{ resources: ResourceData[]; missing: string[] }> {
  const ordered: ResourceData[] = [];
  const added = new Set<string>();
  const visiting = new Set<string>();
  const missing = new Set<string>();

  const visit = async (normalized: string, stack: string[]): Promise<void> => {
    if (visiting.has(normalized)) {
      const cycleNames = [...stack, context.resourceIndex.get(normalized)?.name ?? normalized];
      throw new Error(`Circular CTE dependency detected: ${cycleNames.join(' -> ')}`);
    }

    const entry = context.resourceIndex.get(normalized);
    if (!entry) {
      missing.add(normalized);
      return;
    }

    if (added.has(normalized)) {
      return;
    }

    visiting.add(normalized);
    const resource = await loadResource(entry, context);

    for (const dependency of resource.dependencies) {
      await visit(dependency, [...stack, entry.name]);
    }

    visiting.delete(normalized);
    added.add(normalized);
    ordered.push(resource);
  };

  for (const normalized of references.keys()) {
    await visit(normalized, []);
  }

  const missingDisplay = Array.from(missing)
    .filter((name) => references.has(name))
    .map((name) => references.get(name) ?? name)
    .sort();

  return { resources: ordered, missing: missingDisplay };
}

async function loadResource(entry: ResourceIndexEntry, context: BuildContext): Promise<ResourceData> {
  const cached = context.resourceCache.get(entry.normalized);
  if (cached) {
    return cached;
  }

  const rawContent = await fs.readFile(entry.filePath, 'utf8');
  const { sql } = prepareSql(rawContent);
  const parsed = parseSelect(sql, entry.filePath);
  const simple = parsed.toSimpleQuery();
  enforceNoManualCte(simple, entry.filePath);

  const referenced = collectReferencedNames(parsed);
  const dependencies = Array.from(referenced.keys()).filter((name) => name !== entry.normalized && context.resourceIndex.has(name));

  const resource: ResourceData = {
    entry,
    sql,
    dependencies,
  };

  context.resourceCache.set(entry.normalized, resource);
  return resource;
}

async function buildResourceIndex(resourcesDir: string): Promise<Map<string, ResourceIndexEntry>> {
  const files = await collectSqlFiles(resourcesDir);
  const index = new Map<string, ResourceIndexEntry>();

  for (const filePath of files) {
    const baseName = path.parse(filePath).name;
    const normalized = baseName.toLowerCase();

    if (index.has(normalized)) {
      const existing = index.get(normalized)!;
      throw new Error(`Duplicate resource CTE name detected: ${existing.filePath} and ${filePath}`);
    }

    index.set(normalized, {
      name: baseName,
      normalized,
      filePath,
    });
  }

  return index;
}





