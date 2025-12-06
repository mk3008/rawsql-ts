import { normalizeTableName } from 'rawsql-ts';

export type TableLookup = (qualifiedName: string) => boolean;

export interface TableNameResolverOptions {
  defaultSchema?: string;
  searchPath?: string[];
}

export class TableNameResolver {
  private readonly defaultSchema: string;
  private readonly searchPath: string[];

  constructor(options?: TableNameResolverOptions) {
    const defaultSchema = options?.defaultSchema?.trim();
    this.defaultSchema = defaultSchema && defaultSchema.length > 0 ? defaultSchema.toLowerCase() : 'public';

    // Normalize the configured search path so it behaves predictably when iterating.
    const configured = (options?.searchPath ?? [])
      .map((schema) => schema.trim().toLowerCase())
      .filter((schema) => schema.length > 0);

    if (configured.length > 0) {
      this.searchPath = [...new Set(configured)];
    } else {
      this.searchPath = [this.defaultSchema];
    }

    if (!this.searchPath.includes(this.defaultSchema)) {
      this.searchPath.unshift(this.defaultSchema);
    }
  }

  public resolve(tableName: string, lookup?: TableLookup): string {
    const { schemaParts, table } = this.parseNormalizedName(tableName);
    if (schemaParts.length > 0) {
      return this.buildQualifiedName(schemaParts, table);
    }

    if (lookup) {
      // Honor the provided search path order when a matching schema has been registered previously.
      for (const schema of this.searchPath) {
        const candidate = this.buildQualifiedName([schema], table);
        if (lookup(candidate)) {
          return candidate;
        }
      }
    }

    const schema = this.searchPath[0];
    return this.buildQualifiedName([schema], table);
  }

  public buildLookupCandidates(tableName: string): string[] {
    const { schemaParts, table } = this.parseNormalizedName(tableName);
    if (schemaParts.length > 0) {
      return [this.buildQualifiedName(schemaParts, table)];
    }

    const candidates: string[] = [];
    for (const schema of this.searchPath) {
      candidates.push(this.buildQualifiedName([schema], table));
    }

    const fallback = normalizeTableName(table);
    // Keep an unqualified version around so registries keyed by raw table names still work.
    if (!candidates.includes(fallback)) {
      candidates.push(fallback);
    }

    return candidates;
  }

  private parseNormalizedName(tableName: string): { schemaParts: string[]; table: string } {
    const normalized = normalizeTableName(tableName);
    const parts = normalized.split('.');
    const table = parts.pop() ?? normalized;
    return { schemaParts: parts, table };
  }

  private buildQualifiedName(schemaParts: string[], table: string): string {
    if (schemaParts.length === 0) {
      return normalizeTableName(table);
    }
    return normalizeTableName(`${schemaParts.join('.')}.${table}`);
  }
}
