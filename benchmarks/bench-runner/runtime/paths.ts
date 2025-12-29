import path from 'node:path';

const ROOT_DIR = path.resolve(__dirname, '../../..');
const TMP_DIR = path.join(ROOT_DIR, 'tmp', 'bench');
const REPORT_PATH = process.env.ZTD_BENCH_REPORT_PATH ?? path.join(TMP_DIR, 'report.md');
const APPENDIX_REPORT_PATH =
  process.env.ZTD_BENCH_APPENDIX_REPORT_PATH ?? path.join(TMP_DIR, 'report-appendix.md');
const REPORT_METADATA_PATH =
  process.env.ZTD_BENCH_REPORT_METADATA_PATH ?? path.join(TMP_DIR, 'report-metadata.json');
const TRADITIONAL_SQL_LOG_DIR = path.join(TMP_DIR, 'traditional-sql');
const BENCH_LOG_PATH = process.env.ZTD_BENCH_LOG_PATH ?? path.join(TMP_DIR, 'log.jsonl');
const RUN_TAG_RAW = process.env.ZTD_BENCH_RUN_TAG?.trim();
const RUN_TAG =
  RUN_TAG_RAW && RUN_TAG_RAW.length > 0 ? RUN_TAG_RAW.replace(/[^a-zA-Z0-9_-]/g, '') : '';
const RUN_TAG_PREFIX = RUN_TAG.length > 0 ? `${RUN_TAG}-` : '';

export {
  ROOT_DIR,
  TMP_DIR,
  REPORT_PATH,
  APPENDIX_REPORT_PATH,
  REPORT_METADATA_PATH,
  TRADITIONAL_SQL_LOG_DIR,
  BENCH_LOG_PATH,
  RUN_TAG,
  RUN_TAG_PREFIX,
};
