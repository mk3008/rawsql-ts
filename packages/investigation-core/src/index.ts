export {
  analyzeColumnLineage,
  ColumnLineageAnalysisInputError,
} from './lineage/columnLineageAnalysis';
export type {
  ColumnLineageAnalysisInputErrorCode,
  ColumnLineageAnalysisInputV1,
  ColumnLineageAnalysisV1,
} from './lineage/columnLineageAnalysis';
export { analyzeQueryStructure } from './lineage/queryStructureAnalysis';
export type {
  QueryStructureAnalysisInputV1,
  QueryStructureAnalysisV1,
  QueryStructureComponentV1,
  QueryStructureOperationV1,
  QueryStructureScopeV1,
  QueryStructureSummaryV1,
} from './lineage/queryStructureAnalysis';
export { analyzeQueryScopes } from './lineage/queryScopeAnalysis';
export type {
  OuterReferenceStatusV1,
  QueryScopeMetadataV1,
} from './lineage/queryScopeAnalysis';
export {
  QuerySliceInputError,
  sliceQueryScope,
} from './lineage/querySlice';
export type {
  QuerySliceBlockedV1,
  QuerySliceDiagnosticCodeV1,
  QuerySliceDiagnosticV1,
  QuerySliceInputErrorCode,
  QuerySliceInputV1,
  QuerySliceReadyV1,
  QuerySliceResultV1,
} from './lineage/querySlice';
export { generateFixtureExtractionPlan } from './lineage/fixture-extraction/generateFixtureExtractionPlan';
export {
  FIXTURE_EXTRACTION_PLAN_SCHEMA_VERSION,
  FixtureExtractionInputError,
} from './lineage/fixture-extraction/fixtureExtractionPlan';
export type * from './lineage/fixture-extraction/fixtureExtractionPlan';
export { parseSchemaFactsFromDdl } from './lineage/schemaFacts';
export type {
  DdlInput,
  SchemaFacts,
  SchemaFactsDiagnostic,
} from './lineage/schemaFacts';
export { validateSql } from './query/sqlValidation';
export type {
  SqlValidationDiagnosticV1,
  SqlValidationInputV1,
  SqlValidationResultV1,
} from './query/sqlValidation';
export { inspectQueryContract } from './query/queryContractInspection';
export type {
  QueryContractDiagnosticV1,
  QueryContractInspectionInputV1,
  QueryContractInspectionV1,
  QueryContractOutputColumnV1,
  QueryContractParameterV1,
  QueryContractReferencedTableV1,
} from './query/queryContractInspection';
