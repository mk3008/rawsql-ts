import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeTableName, DDLToFixtureConverter } from 'rawsql-ts';
import type { TableDefinitionModel } from 'rawsql-ts';
import type { FixtureRow } from '../types';

export interface DdlFixtureLoaderOptions {
  directories: string[];
  extensions?: string[];
}

export interface DdlProcessedFixture {
  tableDefinition: TableDefinitionModel;
  rows?: FixtureRow[];
}

type RawFixtureDefinition = {
  columns?: Array<{ name: string; type?: string; default?: string | null }>;
  rows?: FixtureRow[];
};

export class DdlFixtureLoader {
  private static readonly cache = new Map<string, DdlProcessedFixture[]>();
  private readonly resolvedDirectories: string[];
  private readonly extensions: string[];
  private readonly cacheKey: string;
  private fixtures: DdlProcessedFixture[] = [];
  private fixturesByName = new Map<string, DdlProcessedFixture>();
  private loaded = false;

  constructor(private readonly options: DdlFixtureLoaderOptions) {
    // Resolve directories up front so cache keys stay consistent across calls.
    this.resolvedDirectories = options.directories.map((directory) => path.resolve(directory));
    this.extensions = (options.extensions ?? ['.sql']).map((ext) => ext.toLowerCase());
    this.cacheKey = DdlFixtureLoader.buildCacheKey(this.resolvedDirectories, this.extensions);
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
      const normalized = normalizeTableName(fixture.tableDefinition.name);
      this.fixturesByName.set(normalized, fixture);
    }
  }

  private loadFromDirectories(): DdlProcessedFixture[] {
    const fixtures: DdlProcessedFixture[] = [];

    // Examine each configured directory for SQL fixtures.
    for (const directory of this.resolvedDirectories) {
      this.collectSqlFiles(directory, fixtures);
    }

    return fixtures;
  }

  private collectSqlFiles(directory: string, fixtures: DdlProcessedFixture[]): void {
    // Skip directories that are missing so optional paths are acceptable.
    if (!existsSync(directory)) {
      return;
    }

    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const resolved = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        this.collectSqlFiles(resolved, fixtures);
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!entry.isFile() || !this.extensions.includes(extension)) {
        continue;
      }

      this.loadFile(resolved, fixtures);
    }
  }

  private loadFile(filePath: string, fixtures: DdlProcessedFixture[]): void {
    const sql = readFileSync(filePath, 'utf8');
    if (!sql.trim()) {
      return;
    }

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

      for (const variant of this.buildTableNameVariants(tableName)) {
        const normalized = normalizeTableName(variant);
        if (fixtures.some((fixture) => normalizeTableName(fixture.tableDefinition.name) === normalized)) {
          continue;
        }

        fixtures.push({
          tableDefinition: {
            name: variant,
            columns,
          },
          rows,
        });
      }
    }
  }

  private static buildCacheKey(directories: string[], extensions: string[]): string {
    const normalizedDirectories = [...directories].sort();
    const normalizedExtensions = [...extensions]
      .map((ext) => ext.toLowerCase())
      .sort();

    return `${normalizedDirectories.join('|')}|${normalizedExtensions.join('|')}`;
  }

  private buildTableNameVariants(tableName: string): string[] {
    const normalized = normalizeTableName(tableName);
    const parts = normalized.split('.');
    if (parts.length <= 1) {
      return [normalized];
    }

    return [normalized, parts[parts.length - 1]];
  }
}
