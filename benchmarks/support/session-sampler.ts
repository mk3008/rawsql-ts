import { getDbClient } from './db-client';
import type { DbConnection } from './db-client';

/** Pattern used to identify benchmark connections inside pg_stat_activity. */
export const SESSION_SAMPLER_FILTER = 'ztd-bench-%';
/** Application name for the sampler's own connection so it can be excluded from results. */
export const SESSION_SAMPLER_APP_NAME = 'ztd-bench-sampler';
/** Default polling interval in milliseconds for sampling pg_stat_activity. */
export const SESSION_SAMPLER_POLL_INTERVAL_MS = 100;

/** Snapshot of the session sampler's observations. */
export type SessionSamplerSummary = {
  maxTotal: number;
  maxActive: number;
  sampleCount: number;
};

/** Polls pg_stat_activity to capture how many benchmark backends are active at any given moment. */
export class SessionSampler {
  private connection?: DbConnection;
  private timer?: NodeJS.Timeout;
  private maxTotal = 0;
  private maxActive = 0;
  private sampleCount = 0;
  private running = false;

  constructor(
    private readonly filterPattern = SESSION_SAMPLER_FILTER,
    private readonly pollIntervalMs = SESSION_SAMPLER_POLL_INTERVAL_MS,
  ) {}

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    // Acquire a dedicated sampler connection so the measurement does not compete with the workload.
    this.connection = await getDbClient({
      scope: 'case',
      applicationName: SESSION_SAMPLER_APP_NAME,
    });
    this.running = true;
    this.timer = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
  }

  private async poll(): Promise<void> {
    if (!this.connection) {
      return;
    }
    // Track total vs active backend counts for ztd-bench sessions.
    try {
      const result = await this.connection.client.query<{ total: string; active: string }>(
        `
          SELECT
            count(*) AS total,
            count(*) FILTER (WHERE state = 'active') AS active
          FROM pg_stat_activity
          WHERE application_name LIKE $1 AND application_name != $2
        `,
        [this.filterPattern, SESSION_SAMPLER_APP_NAME],
      );
      const total = Number(result.rows[0]?.total ?? 0);
      const active = Number(result.rows[0]?.active ?? 0);
      this.sampleCount += 1;
      this.maxTotal = Math.max(this.maxTotal, total);
      this.maxActive = Math.max(this.maxActive, active);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        ((error as Error).message?.includes('Connection terminated') ||
          (error as Error & { code?: string }).code === '57P01')
      ) {
        return;
      }
      console.error('Session sampler failed to query pg_stat_activity', error);
    }
  }

  async stop(): Promise<SessionSamplerSummary> {
    if (!this.running) {
      return {
        maxTotal: this.maxTotal,
        maxActive: this.maxActive,
        sampleCount: this.sampleCount,
      };
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.connection) {
      // Release the sampler connection once polling is complete.
      await this.connection.release();
      this.connection = undefined;
    }
    this.running = false;
    return {
      maxTotal: this.maxTotal,
      maxActive: this.maxActive,
      sampleCount: this.sampleCount,
    };
  }
}

/** Stop the sampler while handling potential shutdown errors. */
export async function safeStopSampler(sampler: SessionSampler): Promise<SessionSamplerSummary> {
  try {
    return await sampler.stop();
  } catch (error) {
    console.error('Failed to stop session sampler', error);
    return { maxTotal: 0, maxActive: 0, sampleCount: 0 };
  }
}
