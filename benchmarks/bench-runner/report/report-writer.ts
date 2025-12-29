import fs from 'node:fs';
import path from 'node:path';
import type { RenderReportOptions } from '../benchmark-report';
import { renderReport } from '../benchmark-report';

export type ReportOutputPaths = {
  reportPath: string;
  appendixReportPath: string;
};

export function writeBenchmarkReports(options: RenderReportOptions): ReportOutputPaths {
  const { reportPath, appendixReportPath } = options;

  // Ensure output directories exist before writing reports.
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(appendixReportPath), { recursive: true });

  const { mainReport, appendixReport } = renderReport(options);
  fs.writeFileSync(reportPath, mainReport, 'utf8');
  fs.writeFileSync(appendixReportPath, appendixReport, 'utf8');

  return { reportPath, appendixReportPath };
}
