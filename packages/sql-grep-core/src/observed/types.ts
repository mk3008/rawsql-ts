export type ObservedSqlOutputFormat = 'text' | 'json';

export interface ObservedSqlMatchReportParams {
  observedSql: string;
  rootDir?: string;
  topResults?: number;
}

export interface ObservedSqlMatchWarning {
  code: string;
  message: string;
  sql_file?: string;
  query_index?: number;
}

export interface ObservedSqlQuerySummary {
  queryFingerprint: string;
  projectionTokens: string[];
  sourceTokens: string[];
  whereTokens: string[];
  whereFamilies: string[];
  orderTokens: string[];
  pagingTokens: string[];
  setOperationTokens: string[];
}

export interface ObservedSqlMatchSectionScores {
  projection: number;
  source: number;
  where: number;
  order: number;
  paging: number;
}

export interface ObservedSqlMatchCandidate {
  sql_file: string;
  query_index: number;
  query_fingerprint: string;
  score: number;
  section_scores: ObservedSqlMatchSectionScores;
  reasons: string[];
  differences: string[];
  summary: ObservedSqlQuerySummary;
}

export interface ObservedSqlMatchReport {
  schemaVersion: 1;
  rootDir: string;
  observedSql: string;
  observedQueries: number;
  summary: {
    filesScanned: number;
    sqlFilesScanned: number;
    queriesScored: number;
    queriesSkipped: number;
    candidates: number;
  };
  matches: ObservedSqlMatchCandidate[];
  warnings: ObservedSqlMatchWarning[];
}
