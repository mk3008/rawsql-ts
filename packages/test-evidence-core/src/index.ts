export {
  buildDiffJson,
  stableStringify
} from './diff';
export {
  renderDiffReportMarkdown,
  evaluateUnsupportedSchemaValidation,
  type DiffReportMarkdownMeta
} from './reportMarkdown';
export { renderDiffMarkdown, renderLegacyDiffMarkdown, type RemovedDetailLevel } from './renderer/prDiffMarkdown';

export {
  PREVIEW_SCHEMA_VERSION,
  DIFF_SCHEMA_VERSION,
  DiffCoreError,
  type BuildDiffJsonArgs,
  type DiffCase,
  type DiffCatalog,
  type DiffCoreErrorCode,
  type DiffJson,
  type PreviewFunctionCase,
  type PreviewFunctionCatalog,
  type PreviewJson,
  type PreviewSqlCase,
  type PreviewSqlCatalog
} from './types';
