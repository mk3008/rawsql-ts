/**
 * Prisma integration for rawsql-ts
 * 
 * This package provides seamless integration between Prisma ORM and rawsql-ts,
 * enabling dynamic SQL generation with type safety and hierarchical JSON serialization.
 */

export { RawSqlClient, SqlFileNotFoundError, JsonMappingError, SqlExecutionError } from './RawSqlClient';
export { PrismaSchemaResolver } from './PrismaSchemaResolver';
export { AutoTypeCompatibilityValidator } from './AutoTypeCompatibilityValidator';
export { DomainModelCompatibilityTester, validateJsonMappingCompatibility } from './DomainModelCompatibilityTester';
export {
    detectMappingFormat,
    loadAndConvertMappingFile,
    findAndConvertMappingFiles,
    getMappingFileStats
} from './MappingFileProcessor';

// Static Analysis Components
export { SqlStaticAnalyzer, analyzeSqlFiles, validateSqlFile } from './SqlStaticAnalyzer';
export {
    StaticAnalysisOrchestrator,
    runComprehensiveStaticAnalysis,
    runSqlStaticAnalysis,
    runDomainModelAnalysis
} from './StaticAnalysisOrchestrator';

// export { PrismaJsonMapping } from './mappers/PrismaJsonMapping'; // TODO: Implement

// Type exports
export type {
    RawSqlClientOptions,
    PrismaSchemaInfo,
    PrismaModelInfo,
    PrismaFieldInfo,
    PrismaRelationInfo
} from './types';

export type {
    EnhancedJsonMapping,
    TypeValidationResult,
    EntityTypeInfo,
    TypePropertyInfo
} from './EnhancedJsonMapping';

// Unified JSON Mapping
export type {
    UnifiedJsonMapping,
    ColumnMappingConfig,
    JsonMapping,
    TypeProtectionConfig,
    ModelDrivenJsonMapping,
    FieldMapping,
    NestedStructure,
    StructureFields,
    FieldType
} from 'rawsql-ts';
export { unifyJsonMapping, processJsonMapping, convertModelDrivenMapping, validateModelDrivenMapping } from 'rawsql-ts';

// Static Analysis Types
export type {
    SqlFileInfo,
    SqlValidationResult,
    SqlStaticAnalysisReport,
    SqlStaticAnalyzerOptions
} from './SqlStaticAnalyzer';

export type {
    StaticAnalysisOptions,
    ComprehensiveAnalysisReport
} from './StaticAnalysisOrchestrator';

export type {
    MappingFileFormat,
    MappingFileResult
} from './MappingFileProcessor';

// Re-export QueryBuildOptions from rawsql-ts for convenience
export type { QueryBuildOptions } from 'rawsql-ts';
