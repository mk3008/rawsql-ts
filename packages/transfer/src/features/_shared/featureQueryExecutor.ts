// Shared runtime contract for scaffolded features.
// Inject your DB execution implementation at this seam from the application runtime.
export interface FeatureQueryExecutor {
  query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]>;
}
