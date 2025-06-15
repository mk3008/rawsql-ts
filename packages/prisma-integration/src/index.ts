/**
 * Prisma integration for rawsql-ts
 * 
 * This package provides seamless integration between Prisma ORM and rawsql-ts,
 * enabling dynamic SQL generation with type safety and hierarchical JSON serialization.
 */

export { PrismaReader } from './PrismaReader';
export { PrismaSchemaResolver } from './PrismaSchemaResolver';
export { AutoTypeCompatibilityValidator } from './AutoTypeCompatibilityValidator';
export { DomainModelCompatibilityTester, validateJsonMappingCompatibility } from './DomainModelCompatibilityTester';
// export { PrismaJsonMapping } from './mappers/PrismaJsonMapping'; // TODO: Implement

// Type exports
export type {
    PrismaReaderOptions,
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

// Re-export QueryBuildOptions from rawsql-ts for convenience
export type { QueryBuildOptions } from '../../core/src/transformers/DynamicQueryBuilder';
