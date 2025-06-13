/**
 * Prisma integration for rawsql-ts
 * 
 * This package provides seamless integration between Prisma ORM and rawsql-ts,
 * enabling dynamic SQL generation with type safety and hierarchical JSON serialization.
 */

export { PrismaReader } from './PrismaReader';
export { PrismaSchemaResolver } from './PrismaSchemaResolver';
// export { PrismaJsonMapping } from './mappers/PrismaJsonMapping'; // TODO: Implement

// Type exports
export type {
    PrismaReaderOptions,
    PrismaSchemaInfo,
    PrismaModelInfo,
    PrismaFieldInfo,
    PrismaRelationInfo
} from './types';

// Re-export QueryBuildOptions from rawsql-ts for convenience
export type { QueryBuildOptions } from '../../core/src/transformers/DynamicQueryBuilder';
