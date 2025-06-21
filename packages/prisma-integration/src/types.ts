import { PrismaClient } from '@prisma/client';

/**
 * Configuration options for RawSqlClient
 */
export interface RawSqlClientOptions {
    /** Enable debug logging */
    debug?: boolean;
    /** Default schema name */
    defaultSchema?: string;
    /** Custom table name mappings */
    tableNameMappings?: Record<string, string>;
    /** Custom column name mappings */
    columnNameMappings?: Record<string, Record<string, string>>;
    /** SQL files directory path */
    sqlFilesPath?: string;
    /** Custom path to schema.prisma file */
    schemaPath?: string;
    /** 
     * Disable table column resolver (no schema analysis)
     * When true, enables pure SQL mode with faster startup time.
     * Recommended for production environments with pre-validated SQL.
     * Note: Disables column validation and auto-completion features.
     */
    disableResolver?: boolean;
    /** 
     * Enable file caching for JSON mappings and SQL files
     * Default: true - Files are cached in memory to avoid redundant I/O
     * Set to false to disable caching (useful for development with file watching)
     */
    enableFileCache?: boolean;
    /** 
     * Cache size limit for JSON mappings and SQL files
     * Default: 1000 - Maximum number of files to keep in memory cache
     * Set to 0 for unlimited cache size
     */
    cacheMaxSize?: number;
}

/**
 * Information about Prisma schema
 */
export interface PrismaSchemaInfo {
    /** All models in the schema */
    models: Record<string, PrismaModelInfo>;
    /** Schema name */
    schemaName?: string;
    /** Database provider (postgresql, mysql, sqlite, etc.) */
    databaseProvider?: string;
}

/**
 * Information about a Prisma model
 */
export interface PrismaModelInfo {
    /** Model name */
    name: string;
    /** Database table name */
    tableName: string;
    /** Model fields */
    fields: Record<string, PrismaFieldInfo>;
    /** Model relations */
    relations: Record<string, PrismaRelationInfo>;
    /** Primary key fields */
    primaryKey: string[];
    /** Unique constraints */
    uniqueConstraints: string[][];
}

/**
 * Information about a Prisma field
 */
export interface PrismaFieldInfo {
    /** Field name */
    name: string;
    /** Database column name */
    columnName: string;
    /** Field type */
    type: string;
    /** Whether field is optional */
    isOptional: boolean;
    /** Whether field is a list */
    isList: boolean;
    /** Whether field is an ID */
    isId: boolean;
    /** Whether field is unique */
    isUnique: boolean;
    /** Default value */
    defaultValue?: any;
    /** Whether field is auto-generated */
    isGenerated?: boolean;
}

/**
 * Information about a Prisma relation
 */
export interface PrismaRelationInfo {
    /** Relation name */
    name: string;
    /** Related model name */
    modelName: string;
    /** Relation type */
    type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
    /** Foreign key fields */
    foreignKeys: string[];
    /** Referenced fields */
    referencedFields: string[];
    /** Whether relation is optional */
    isOptional: boolean;
    /** Whether relation is a list */
    isList: boolean;
}

/**
 * Generic type for Prisma client
 */
export type PrismaClientType = PrismaClient;


