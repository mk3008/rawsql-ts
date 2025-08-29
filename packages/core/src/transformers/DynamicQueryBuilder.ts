import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { SqlParamInjector } from "./SqlParamInjector";
import { SqlSortInjector, SortConditions } from "./SqlSortInjector";
import { SqlPaginationInjector, PaginationOptions } from "./SqlPaginationInjector";
import { PostgresJsonQueryBuilder, JsonMapping } from "./PostgresJsonQueryBuilder";
import { QueryBuilder } from "./QueryBuilder";
import { SqlParameterBinder } from "./SqlParameterBinder";
import { ParameterDetector } from "../utils/ParameterDetector";
import { SqlParameterValue } from "../models/ValueComponent";

// Type-safe filter condition values
export type FilterConditionValue = SqlParameterValue | SqlParameterValue[] | {
    min?: SqlParameterValue;
    max?: SqlParameterValue;
    like?: string;
    ilike?: string;
    in?: SqlParameterValue[];
    any?: SqlParameterValue[];
    '='?: SqlParameterValue;
    '>'?: SqlParameterValue;
    '<'?: SqlParameterValue;
    '>='?: SqlParameterValue;
    '<='?: SqlParameterValue;
    '!='?: SqlParameterValue;
    '<>'?: SqlParameterValue;
    or?: { column: string; [operator: string]: SqlParameterValue | string }[];
    and?: { column: string; [operator: string]: SqlParameterValue | string }[];
    column?: string;
};

/**
 * Filter conditions for dynamic query building.
 * 
 * Supports both unqualified and qualified column names:
 * - Unqualified: `{ name: 'Alice' }` - applies to all columns named 'name'
 * - Qualified: `{ 'users.name': 'Bob' }` - applies only to the 'name' column in the 'users' table/alias
 * - Hybrid: `{ name: 'Default', 'users.name': 'Override' }` - qualified names take priority over unqualified
 * 
 * @example
 * ```typescript
 * // Basic usage (backward compatible)
 * const filter: FilterConditions = {
 *   name: 'Alice',
 *   status: 'active'
 * };
 * 
 * // Qualified names for disambiguation in JOINs
 * const filter: FilterConditions = {
 *   'users.name': 'Alice',    // Only applies to users.name
 *   'profiles.name': 'Bob'    // Only applies to profiles.name
 * };
 * 
 * // Hybrid approach
 * const filter: FilterConditions = {
 *   status: 'active',         // Applies to all 'status' columns
 *   'users.name': 'Alice',    // Overrides for users.name specifically
 *   'profiles.name': 'Bob'    // Overrides for profiles.name specifically
 * };
 * ```
 */
export type FilterConditions = Record<string, FilterConditionValue>;

/**
 * Options for dynamic query building
 */
export interface QueryBuildOptions {
    /** Filter conditions to inject into WHERE clause */
    filter?: FilterConditions;
    /** Sort conditions to inject into ORDER BY clause */
    sort?: SortConditions;
    /** Pagination options to inject LIMIT/OFFSET clauses */
    paging?: PaginationOptions;
    /** JSON serialization mapping to transform results into hierarchical JSON
     * - JsonMapping object: explicit mapping configuration
     * - true: auto-load mapping from corresponding .json file
     * - false/undefined: no serialization
     */
    serialize?: JsonMapping | boolean;
    /** 
     * JSONB usage setting. Must be true (default) for PostgreSQL GROUP BY compatibility.
     * Setting to false will throw an error as JSON type cannot be used in GROUP BY clauses.
     * @default true
     */
    jsonb?: boolean;
}

/**
 * DynamicQueryBuilder provides pure JavaScript SQL query building capabilities.
 * It combines SQL parsing with dynamic condition injection (filtering, sorting, pagination, serialization).
 * 
 * This class is framework-agnostic and does not perform any file I/O operations.
 * It only works with SQL content provided as strings.
 * 
 * Key features:
 * - Pure JavaScript/TypeScript - no file system dependencies
 * - Framework-agnostic - can be used with any database framework
 * - Composable - combines multiple injectors in the correct order
 * - Type-safe - provides TypeScript types for all options
 * - Testable - easy to unit test without mocking file system
 * - Table.Column Notation - supports qualified column names for disambiguation in JOINs
 * 
 * ## Table.Column Notation Support
 * 
 * This class now supports qualified column names in filter conditions to disambiguate
 * columns with the same name from different tables in JOIN queries:
 * 
 * @example
 * ```typescript
 * // Basic filtering (backward compatible)
 * builder.buildQuery('SELECT u.id, u.name FROM users u', {
 *   filter: { name: 'Alice' }
 * });
 * 
 * // Qualified column names for JOIN disambiguation  
 * builder.buildQuery(`
 *   SELECT u.id, u.name, p.name, o.total
 *   FROM users u
 *   JOIN profiles p ON u.id = p.user_id
 *   JOIN orders o ON u.id = o.user_id
 * `, {
 *   filter: {
 *     'u.name': 'Alice',           // Only applies to users.name
 *     'p.name': 'Profile Alice',   // Only applies to profiles.name  
 *     'o.total': { min: 100 }      // Only applies to orders.total
 *   }
 * });
 * 
 * // Hybrid approach - qualified names override unqualified
 * builder.buildQuery(`
 *   SELECT u.name, p.name, o.name FROM users u
 *   JOIN profiles p ON u.id = p.user_id
 *   JOIN orders o ON u.id = o.user_id  
 * `, {
 *   filter: {
 *     name: 'Default',         // Applies to all 'name' columns
 *     'u.name': 'Alice',       // Overrides for users.name specifically
 *     'p.name': 'Bob'          // Overrides for profiles.name specifically
 *     // orders.name gets 'Default'
 *   }
 * });
 * ```
 */
export class DynamicQueryBuilder {
    private tableColumnResolver?: (tableName: string) => string[];
    /**
     * Creates a new DynamicQueryBuilder instance
     * @param tableColumnResolver Optional function to resolve table columns for wildcard queries
     */
    constructor(tableColumnResolver?: (tableName: string) => string[]) {
        this.tableColumnResolver = tableColumnResolver;
    }

    /**
     * Builds a SelectQuery from SQL content with dynamic conditions.
     * This is a pure function that does not perform any I/O operations.
     *     * @param sqlContent Raw SQL string to parse and modify
     * @param options Dynamic conditions to apply (filter, sort, paging, serialize)
     * @returns Modified SelectQuery with all dynamic conditions applied
     *     * @example
     * ```typescript
     * const builder = new DynamicQueryBuilder();
     * const query = builder.buildQuery(
     *   'SELECT id, name FROM users WHERE active = true',
     *   {
     *     filter: { status: 'premium' },
     *     sort: { created_at: { desc: true } },
     *     paging: { page: 2, pageSize: 10 },
     *     serialize: { rootName: 'user', rootEntity: { id: 'user', name: 'User', columns: { id: 'id', name: 'name' } }, nestedEntities: [] }
     *   }
     * );
     * ```
     */
    buildQuery(sqlContent: string, options: QueryBuildOptions = {}): SelectQuery {
        // Parse the base SQL
        let parsedQuery: SimpleSelectQuery;
        try {
            parsedQuery = SelectQueryParser.parse(sqlContent) as SimpleSelectQuery;
        } catch (error) {
            throw new Error(`Failed to parse SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Apply dynamic modifications in the correct order
        let modifiedQuery: SelectQuery = parsedQuery;

        // 1. Bind hardcoded parameters first (before any other transformations)
        if (options.filter && Object.keys(options.filter).length > 0) {
            const { hardcodedParams, dynamicFilters } = ParameterDetector.separateFilters(modifiedQuery, options.filter);
            
            // Bind hardcoded parameters if any exist
            if (Object.keys(hardcodedParams).length > 0) {
                const parameterBinder = new SqlParameterBinder({ requireAllParameters: false });
                modifiedQuery = parameterBinder.bind(modifiedQuery, hardcodedParams);
            }
            
            // Apply dynamic filtering only if there are non-hardcoded filters
            if (Object.keys(dynamicFilters).length > 0) {
                const paramInjector = new SqlParamInjector(this.tableColumnResolver);
                // Ensure we have a SimpleSelectQuery for the injector
                const simpleQuery = QueryBuilder.buildSimpleQuery(modifiedQuery);
                modifiedQuery = paramInjector.inject(simpleQuery, dynamicFilters);
            }
        }

        // 2. Apply sorting second (after filtering to sort smaller dataset)
        if (options.sort && Object.keys(options.sort).length > 0) {
            const sortInjector = new SqlSortInjector(this.tableColumnResolver);
            // Ensure we have a SimpleSelectQuery for the injector
            const simpleQuery = QueryBuilder.buildSimpleQuery(modifiedQuery);
            modifiedQuery = sortInjector.inject(simpleQuery, options.sort);
        }        // 3. Apply pagination third (after filtering and sorting)
        if (options.paging) {
            const { page = 1, pageSize } = options.paging;
            if (pageSize !== undefined) {
                const paginationInjector = new SqlPaginationInjector();
                const paginationOptions = { page, pageSize };
                // Ensure we have a SimpleSelectQuery for the injector
                const simpleQuery = QueryBuilder.buildSimpleQuery(modifiedQuery);
                modifiedQuery = paginationInjector.inject(simpleQuery, paginationOptions);
            }
        }
        // 4. Apply serialization last (transform the final query structure to JSON)
        // Note: boolean values are handled at RawSqlClient level for auto-loading
        if (options.serialize && typeof options.serialize === 'object') {
            const jsonBuilder = new PostgresJsonQueryBuilder();
            // Ensure we have a SimpleSelectQuery for the JSON builder
            const simpleQuery = QueryBuilder.buildSimpleQuery(modifiedQuery);
            modifiedQuery = jsonBuilder.buildJsonQuery(simpleQuery, options.serialize);
        }

        return modifiedQuery;
    }

    /**
     * Builds a SelectQuery with only filtering applied.
     * Convenience method for when you only need dynamic WHERE conditions.
     * 
     * @param sqlContent Raw SQL string to parse and modify
     * @param filter Filter conditions to apply
     * @returns Modified SelectQuery with filter conditions applied
     */
    buildFilteredQuery(sqlContent: string, filter: FilterConditions): SelectQuery {
        return this.buildQuery(sqlContent, { filter });
    }

    /**
     * Builds a SelectQuery with only sorting applied.
     * Convenience method for when you only need dynamic ORDER BY clauses.
     * 
     * @param sqlContent Raw SQL string to parse and modify
     * @param sort Sort conditions to apply
     * @returns Modified SelectQuery with sort conditions applied
     */
    buildSortedQuery(sqlContent: string, sort: SortConditions): SelectQuery {
        return this.buildQuery(sqlContent, { sort });
    }    /**
     * Builds a SelectQuery with only pagination applied.
     * Convenience method for when you only need LIMIT/OFFSET clauses.
     * 
     * @param sqlContent Raw SQL string to parse and modify
     * @param paging Pagination options to apply
     * @returns Modified SelectQuery with pagination applied
     */
    buildPaginatedQuery(sqlContent: string, paging: PaginationOptions): SelectQuery {
        return this.buildQuery(sqlContent, { paging });
    }

    /**
     * Builds a SelectQuery with only JSON serialization applied.
     * Convenience method for when you only need hierarchical JSON transformation.
     * 
     * @param sqlContent Raw SQL string to parse and modify
     * @param serialize JSON mapping configuration to apply
     * @returns Modified SelectQuery with JSON serialization applied
     */
    buildSerializedQuery(sqlContent: string, serialize: JsonMapping): SelectQuery {
        return this.buildQuery(sqlContent, { serialize });
    }

    /**
     * Validates SQL content by attempting to parse it.
     * Useful for testing SQL validity without applying any modifications.
     * 
     * @param sqlContent Raw SQL string to validate
     * @returns true if SQL is valid, throws error if invalid
     * @throws Error if SQL cannot be parsed
     */
    validateSql(sqlContent: string): boolean {
        try {
            SelectQueryParser.parse(sqlContent);
            return true;
        } catch (error) {
            throw new Error(`Invalid SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
