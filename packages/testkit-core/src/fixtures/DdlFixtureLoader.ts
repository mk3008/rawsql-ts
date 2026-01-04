import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeTableName, DDLToFixtureConverter } from 'rawsql-ts';
import type { TableDefinitionModel } from 'rawsql-ts';
import type { FixtureRow } from '../types';
import { TableNameResolver } from './TableNameResolver';
import {
  applyDdlLintMode,
  DEFAULT_DDL_LINT_MODE,
  formatDdlLintDiagnostics,
  lintDdlSources,
  normalizeDdlLintMode,
  type DdlLintMode,
  type DdlLintSource,
} from './ddlLint';
import { DdlLintError } from '../errors';

export interface DdlFixtureLoaderOptions {
  directories: string[];
  extensions?: string[];
  tableNameResolver?: TableNameResolver;
  ddlLint?: DdlLintMode;
}

export interface DdlProcessedFixture {
  tableDefinition: TableDefinitionModel;
  rows?: FixtureRow[];
}

type RawFixtureDefinition = {
  columns?: Array<{ name: string; type?: string; default?: string | null }>;
  rows?: FixtureRow[];
};

type SqlDiagnostics = {
  sqlFileCount: number;
};

export class DdlFixtureLoader {
  private static readonly cache = new Map<string, DdlProcessedFixture[]>();
  private readonly resolvedDirectories: string[];
  private readonly extensions: string[];
  private readonly cacheKey: string;
  private fixtures: DdlProcessedFixture[] = [];
  private fixturesByName = new Map<string, DdlProcessedFixture>();
  private loaded = false;
  private readonly tableNameResolver?: TableNameResolver;
  private readonly ddlLintMode: DdlLintMode;

  constructor(private readonly options: DdlFixtureLoaderOptions) {
    // Resolve directories up front so cache keys stay consistent across calls.
    this.resolvedDirectories = options.directories.map((directory) => path.resolve(directory));
    this.extensions = (options.extensions ?? ['.sql']).map((ext) => ext.toLowerCase());
    // Include resolver settings in the cache key to avoid mixing schema snapshots.
    this.cacheKey = DdlFixtureLoader.buildCacheKey(
      this.resolvedDirectories,
      this.extensions,
      options.tableNameResolver,
      normalizeDdlLintMode(options.ddlLint)
    );
    this.tableNameResolver = options.tableNameResolver;
    this.ddlLintMode = normalizeDdlLintMode(options.ddlLint);
  }

  public getFixtures(): DdlProcessedFixture[] {
    this.ensureLoaded();
    return [...this.fixtures];
  }

  public getFixture(tableName: string): DdlProcessedFixture | undefined {
    this.ensureLoaded();
    const normalized = normalizeTableName(tableName);
    return this.fixturesByName.get(normalized);
  }

  private ensureLoaded(): void {
    if (this.loaded) {
      return;
    }

    // Reuse previously parsed fixtures when the same directories were processed before.
    const cached = DdlFixtureLoader.cache.get(this.cacheKey);
    if (cached) {
      this.registerFixtures(cached);
      this.loaded = true;
      return;
    }

    // Load fixtures from disk and store them in the shared cache key.
    const collected = this.loadFromDirectories();
    DdlFixtureLoader.cache.set(this.cacheKey, collected);
    this.registerFixtures(collected);
    this.loaded = true;
  }

  private registerFixtures(fixtures: DdlProcessedFixture[]): void {
    this.fixtures = fixtures;
    this.fixturesByName = new Map();

    for (const fixture of fixtures) {
      const normalized = this.resolveTableKey(fixture.tableDefinition.name);
      this.fixturesByName.set(normalized, fixture);
    }
  }

  private loadFromDirectories(): DdlProcessedFixture[] {
    // Verify every configured directory exists before scanning to provide fail-fast diagnostics.
    const missingDirectories = this.resolvedDirectories.filter((directory) => !existsSync(directory));
    if (missingDirectories.length) {
      throw new Error(
        `DDL directories were not found: ${missingDirectories.join(
          ', '
        )}. Please review the configured ddl.directories paths.`
      );
    }

    const fixtures: DdlProcessedFixture[] = [];
    const diagnostics: SqlDiagnostics = { sqlFileCount: 0 };
    const sources: DdlLintSource[] = [];

    // Walk each directory recursively to collect SQL files and keep track of what was discovered.
    for (const directory of this.resolvedDirectories) {
      this.collectSqlFiles(directory, fixtures, diagnostics, sources);
    }

    if (diagnostics.sqlFileCount === 0) {
      throw new Error(
        `No SQL files (${this.extensions.join(', ')}) were discovered under ${this.resolvedDirectories.join(
          ', '
        )}. Please place valid SQL fixtures in the configured directories.`
      );
    }

    // Run lint checks before enforcing CREATE TABLE presence so actionable diagnostics surface first.
    this.runDdlLint(sources);

    if (fixtures.length === 0) {
      throw new Error(
        `SQL files were found under ${this.resolvedDirectories.join(
          ', '
        )}, but no CREATE TABLE statements produced fixtures. Please verify the files contain valid DDL.`
      );
    }

    return fixtures;
  }

  private collectSqlFiles(
    directory: string,
    fixtures: DdlProcessedFixture[],
    diagnostics: SqlDiagnostics,
    sources: DdlLintSource[]
  ): void {
    // Skip directories that are missing so optional paths are acceptable.
    if (!existsSync(directory)) {
      return;
    }

    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const resolved = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        this.collectSqlFiles(resolved, fixtures, diagnostics, sources);
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!entry.isFile() || !this.extensions.includes(extension)) {
        continue;
      }

      // Record that a SQL file was encountered regardless of whether it contained definitions.
      diagnostics.sqlFileCount += 1;

      this.loadFile(resolved, fixtures, sources);
    }
  }

  private loadFile(
    filePath: string,
    fixtures: DdlProcessedFixture[],
    sources: DdlLintSource[]
  ): void {
    const sql = readFileSync(filePath, 'utf8');
    if (!sql.trim()) {
      return;
    }

    // Preserve a workspace-relative path so diagnostics remain portable.
    const sourcePath = path
      .relative(process.cwd(), filePath)
      .replace(/\\/g, '/');
    sources.push({ path: sourcePath, sql });

    // Convert every CREATE TABLE/INSERT block into a table definition bundle.
    const fixtureJson = DDLToFixtureConverter.convert(sql);
    for (const [tableName, definition] of Object.entries(fixtureJson)) {
      const rawDefinition = definition as RawFixtureDefinition;

      const columns =
        rawDefinition.columns?.map((column) => ({
          name: column.name,
          typeName: column.type,
          required: false,
          defaultValue: column.default ?? null,
        })) ?? [];

      const rows =
        Array.isArray(rawDefinition.rows) && rawDefinition.rows.length > 0 ? rawDefinition.rows : undefined;

      // Avoid duplicate fixtures for the same canonical table key.
      const canonicalKey = this.resolveTableKey(tableName);
      if (fixtures.some((fixture) => this.resolveTableKey(fixture.tableDefinition.name) === canonicalKey)) {
        continue;
      }

      fixtures.push({
        tableDefinition: {
          name: tableName,
          columns,
        },
        rows,
      });
    }
  }

  private static buildCacheKey(
    directories: string[],
    extensions: string[],
    resolver?: TableNameResolver,
    ddlLintMode: DdlLintMode = DEFAULT_DDL_LINT_MODE
  ): string {
    // Normalize directories and extensions so the cache key stays deterministic regardless of iteration order.
    const normalizedDirectories = [...directories].sort();
    const normalizedExtensions = [...extensions]
      .map((ext) => ext.toLowerCase())
      .sort();

    // Include resolver configuration in the key so different schema search paths do not share the same cache.
    const resolverSegment = `|resolver:${resolver?.toCacheKey() ?? 'none'}`;
    return `${normalizedDirectories.join('|')}|${normalizedExtensions.join('|')}${resolverSegment}|ddlLint:${ddlLintMode}`;
  }

  private runDdlLint(sources: DdlLintSource[]): void {
    if (this.ddlLintMode === 'off' || sources.length === 0) {
      return;
    }

    // Always lint with resolver context so unqualified references resolve deterministically.
    const diagnostics = lintDdlSources(sources, {
      tableNameResolver: this.tableNameResolver,
    });
    if (diagnostics.length === 0) {
      return;
    }

    const adjusted = applyDdlLintMode(diagnostics, this.ddlLintMode);
    if (this.ddlLintMode === 'strict') {
      throw new DdlLintError(adjusted);
    }

    console.warn(formatDdlLintDiagnostics(adjusted));
  }

  // Map raw table names into their canonical schema-qualified keys for deduplication.
  private resolveTableKey(tableName: string): string {
    if (!this.tableNameResolver) {
      return normalizeTableName(tableName);
    }
    return this.tableNameResolver.resolve(tableName);
  }
}
