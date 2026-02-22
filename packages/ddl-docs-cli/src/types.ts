export interface SqlSource {
  path: string;
  sql: string;
}

export interface GenerateDocsOptions {
  ddlDirectories: string[];
  ddlFiles: string[];
  ddlGlobs: string[];
  extensions: string[];
  outDir: string;
  includeIndexes: boolean;
  strict: boolean;
  dialect: 'postgres';
  columnOrder: 'definition' | 'name';
  locale?: string;
  dictionaryPath?: string;
  configPath?: string;
  defaultSchema?: string;
  searchPath?: string[];
}

export interface PruneDocsOptions {
  outDir: string;
  dryRun: boolean;
  pruneOrphans: boolean;
}

export interface ResolvedSchemaSettings {
  defaultSchema: string;
  searchPath: string[];
}

export interface ColumnDocModel {
  name: string;
  concept: string;
  conceptSlug: string;
  typeName: string;
  canonicalType: string;
  typeKey: string;
  nullable: boolean;
  defaultValue: string;
  isPrimaryKey: boolean;
  comment: string;
  checks: string[];
  unknownType: boolean;
}

export interface TableDocModel {
  schema: string;
  table: string;
  schemaSlug: string;
  tableSlug: string;
  tableComment: string;
  sourceFiles: string[];
  columns: ColumnDocModel[];
  primaryKey: string[];
  constraints: TableConstraintDocModel[];
  outgoingReferences: ReferenceDocModel[];
  incomingReferences: ReferenceDocModel[];
  normalizedSql: string;
}

export interface DocsManifest {
  generator: {
    version: string;
    dialect: 'postgres';
    optionsHash: string;
  };
  naming: {
    slugRules: string;
    nameMap: Record<string, string>;
  };
  outputs: {
    tables: string[];
    columns: string[];
  };
}

export interface WarningSource {
  filePath: string;
  statementIndex?: number;
}

export interface WarningItem {
  kind: 'UNSUPPORTED_DDL' | 'PARSE_FAILED' | 'AMBIGUOUS';
  message: string;
  statementPreview: string;
  source: WarningSource;
}

export interface SnapshotResult {
  tables: TableDocModel[];
  warnings: WarningItem[];
}

export interface TableConstraintDocModel {
  kind: 'PK' | 'UK' | 'CHECK' | 'FK';
  name: string;
  expression: string;
}

export interface ReferenceDocModel {
  direction: 'outgoing' | 'incoming';
  source: 'ddl' | 'suggested';
  fromTableKey: string;
  targetTableKey: string;
  fromColumns: string[];
  targetColumns: string[];
  onDeleteAction: 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default' | null;
  onUpdateAction: 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default' | null;
  fromSchemaSlug: string;
  fromTableSlug: string;
  targetSchemaSlug: string;
  targetTableSlug: string;
  matchRule?: 'exact';
  expression: string;
}

export interface PruneResult {
  removed: string[];
  dryRun: boolean;
}

export interface DictionaryEntry {
  preferredTypes?: string[];
  labels?: Record<string, string>;
  notes?: Record<string, string>;
}

export interface ColumnDictionary {
  version: number;
  locales?: string[];
  columns: Record<string, DictionaryEntry>;
}

export interface ObservedColumnUsage {
  schema: string;
  table: string;
  column: string;
  tableSlug: string;
  schemaSlug: string;
  typeKey: string;
  canonicalType: string;
  nullable: boolean;
  defaultValue: string;
  comment: string;
  hasComment: boolean;
}

export interface ObservedColumnConcept {
  concept: string;
  conceptSlug: string;
  typeDistribution: Record<string, number>;
  usages: ObservedColumnUsage[];
}

export interface ObservedColumnDictionary {
  version: 1;
  generatedAt: string;
  concepts: ObservedColumnConcept[];
}

export type FindingKind =
  | 'COLUMN_NAME_TYPE_DIVERGENCE'
  | 'MISSING_COMMENT_SUGGESTED'
  | 'COMMENT_VS_DICTIONARY_MISMATCH'
  | 'UNSUPPORTED_OR_UNKNOWN_TYPE';

export interface FindingItem {
  kind: FindingKind;
  severity: 'info' | 'warning';
  message: string;
  scope: {
    schema?: string;
    table?: string;
    column?: string;
    concept?: string;
  };
}

export interface SuggestionItem {
  schema: string;
  table: string;
  column: string;
  sql: string;
}
