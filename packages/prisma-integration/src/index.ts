/**
 * Prisma integration for rawsql-ts
 * 
 * This package provides seamless integration between Prisma ORM and rawsql-ts,
 * enabling dynamic SQL generation with type safety and hierarchical JSON serialization.
 */

export { RawSqlClient } from './RawSqlClient';
export { PrismaSchemaResolver } from './PrismaSchemaResolver';
export { AutoTypeCompatibilityValidator } from './AutoTypeCompatibilityValidator';
export { DomainModelCompatibilityTester, validateJsonMappingCompatibility } from './DomainModelCompatibilityTester';

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
} from './types/EnhancedJsonMapping';

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

// Re-export QueryBuildOptions from rawsql-ts for convenience
export type { QueryBuildOptions } from '../../core/src/transformers/DynamicQueryBuilder';
