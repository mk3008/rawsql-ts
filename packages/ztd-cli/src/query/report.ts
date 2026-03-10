import {
  buildQueryUsageReport as buildCoreQueryUsageReport,
  QUERY_USES_REPORT_SPANS,
  writeQueryUsageOutput,
} from '@rawsql-ts/sql-grep-core';
import type { BuildQueryUsageReportParams } from '@rawsql-ts/sql-grep-core';
import { withSpanSync } from '../utils/telemetry';
import type { TelemetryAttributes } from '../utils/telemetry';

export { QUERY_USES_REPORT_SPANS, writeQueryUsageOutput };

const runQueryUsageSpan: NonNullable<BuildQueryUsageReportParams['withSpanSync']> = (name, fn, attrs) =>
  withSpanSync(name, fn, attrs as TelemetryAttributes);

/**
 * Build a deterministic impact or detail investigation report from catalog specs.
 */
export function buildQueryUsageReport(params: Omit<BuildQueryUsageReportParams, 'withSpanSync'>) {
  return buildCoreQueryUsageReport({
    ...params,
    withSpanSync: runQueryUsageSpan,
  });
}
