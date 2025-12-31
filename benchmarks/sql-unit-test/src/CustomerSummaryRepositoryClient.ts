import type { QueryResultRow } from 'pg';

/** Minimal query client surface that the repository depends on. */
export interface CustomerSummaryRepositoryClient {
  query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<T[]>;
}
