export type QueryUsageMode = 'exact' | 'any-schema' | 'any-schema-any-table';
export type QueryUsageConfidence = 'high' | 'medium' | 'low';
export type QueryUsageSource = 'ast' | 'fallback';
export type QueryUsageTargetKind = 'table' | 'column';

export interface QueryUsageTarget {
  kind: QueryUsageTargetKind;
  raw: string;
  schema?: string;
  table?: string;
  column?: string;
}

export interface QueryUsageLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  fileOffsetStart: number;
  fileOffsetEnd: number;
  statementOffsetStart?: number;
  statementOffsetEnd?: number;
}

export interface QueryUsageMatch {
  catalog_id: string;
  query_id: string;
  statement_fingerprint: string;
  sql_file: string;
  usage_kind: string;
  exprHints?: string[];
  location: QueryUsageLocation | null;
  snippet: string;
  confidence: QueryUsageConfidence;
  notes: string[];
  source: QueryUsageSource;
}

export interface QueryUsageWarning {
  catalog_id?: string;
  query_id?: string;
  sql_file?: string;
  code: string;
  message: string;
}

export interface QueryUsageReport {
  schemaVersion: 1;
  mode: QueryUsageMode;
  target: QueryUsageTarget;
  summary: {
    catalogsScanned: number;
    statementsScanned: number;
    matches: number;
    fallbackMatches: number;
    unresolvedSqlFiles: number;
    parseWarnings: number;
  };
  matches: QueryUsageMatch[];
  warnings: QueryUsageWarning[];
}

export interface QueryUsageAnalyzerResult {
  matches: QueryUsageMatch[];
  warnings: QueryUsageWarning[];
}
