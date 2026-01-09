import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { SqlParamInjector, StateParameterValue } from "./SqlParamInjector";
import { SqlSortInjector, SortConditions } from "./SqlSortInjector";
import { SqlPaginationInjector, PaginationOptions } from "./SqlPaginationInjector";
import { PostgresJsonQueryBuilder, JsonMapping } from "./PostgresJsonQueryBuilder";
import { QueryBuilder } from "./QueryBuilder";
import { SqlParameterBinder } from "./SqlParameterBinder";
import { ParameterDetector } from "../utils/ParameterDetector";
import { SqlParameterValue } from "../models/ValueComponent";
import { ExistsInstruction, injectExistsPredicates } from "./ExistsPredicateInjector";
/**
 * Value union accepted for a single filter entry in DynamicQueryBuilder.
 *
 * @example
 * ```typescript
 * const options = { filter: { price: { min: 10, max: 100 }, status: ['active', 'pending'] } };
 * builder.buildQuery('SELECT * FROM orders', options);
 * ```
 * Related tests: packages/core/tests/transformers/DynamicQueryBuilder.test.ts

 */


export interface FilterConditionObject {
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
    exists?: ExistsSubqueryDefinition;
    notExists?: ExistsSubqueryDefinition;
}

export interface MultiColumnExistsDefinition extends ExistsSubqueryDefinition {
    on: string[];
}

export type FilterConditionValue =
    | SqlParameterValue
    | SqlParameterValue[]
    | FilterConditionObject
    | MultiColumnExistsDefinition[];


/**
 * Describes the correlated subquery that feeds an `exists`/`notExists` filter.
 */
export interface ExistsSubqueryDefinition {
    /** SQL text that uses `$c0`, `$c1`, … to reference the anchor columns. */
    sql: string;
    /** Optional named parameters that the subquery requires. */
    params?: Record<string, SqlParameterValue>;
 }

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
 * Related tests: packages/core/tests/transformers/DynamicQueryBuilder.test.ts
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
    /**
     * Throw when column-anchored EXISTS filters fail to resolve.
     * Defaults to false so invalid definitions are skipped silently.
     */
    existsStrict?: boolean;
}

/**
 * DynamicQueryBuilder combines SQL parsing with dynamic condition injection (filters, sorts, paging, JSON serialization).
 *
 * Key behaviours verified in packages/core/tests/transformers/DynamicQueryBuilder.test.ts:
 * - Preserves the input SQL when no options are supplied.
 * - Applies filter, sort, and pagination in a deterministic order.
 * - Supports JSON serialization for hierarchical projections.
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
     * @param sqlContent Raw SQL string to parse and modify
     * @param options Dynamic conditions to apply (filter, sort, paging, serialize)
     * @returns Modified SelectQuery with all dynamic conditions applied
     * @example
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

            // Extract and remove any column-anchored EXISTS filters before injecting traditional ones.
            const { filters: cleanedFilters, instructions: existsInstructions } = this.extractExistsInstructions(dynamicFilters);

            if (Object.keys(cleanedFilters).length > 0) {
                const paramInjector = new SqlParamInjector(this.tableColumnResolver);
                // Ensure we have a SimpleSelectQuery for the injector
                const simpleQuery = QueryBuilder.buildSimpleQuery(modifiedQuery);
                modifiedQuery = paramInjector.inject(simpleQuery, cleanedFilters);
            }

            if (existsInstructions.length > 0) {
                modifiedQuery = injectExistsPredicates(modifiedQuery, existsInstructions, {
                    tableColumnResolver: this.tableColumnResolver,
                    strict: !!options.existsStrict
                });
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

    private extractExistsInstructions(filters: Record<string, FilterConditionValue>) {
        const cleanedFilters: Record<string, StateParameterValue> = {};        
        const instructions: ExistsInstruction[] = [];

        for (const [key, value] of Object.entries(filters)) {
            if (key === "$exists" || key === "$notExists") {
                // Multi-anchor metadata arrives as arrays keyed by the special markers.
                if (!this.isMultiColumnDefinitionArray(value)) {
                    throw new Error(`'${key}' must be an array of EXISTS definitions.`);
                }
                this.handleMultiAnchorDefinitions(key, value, instructions);
                continue;
            }

            if (this.isFilterConditionObject(value)) {
                const { leftover, exists, notExists } = this.splitExistsProperties(value);

                if (exists) {
                    instructions.push(this.createExistsInstruction([key], exists, "exists"));
                }
                if (notExists) {
                    instructions.push(this.createExistsInstruction([key], notExists, "notExists"));
                }

                if (leftover) {
                    cleanedFilters[key] = leftover;
                }
                continue;
            }

            if (this.isMultiColumnDefinitionArray(value)) {
                continue;
            }
            cleanedFilters[key] = value as StateParameterValue;
        }

        return { filters: cleanedFilters, instructions };
    }

    private handleMultiAnchorDefinitions(
        key: "$exists" | "$notExists",
        definitions: MultiColumnExistsDefinition[],
        instructions: ExistsInstruction[]
    ): void {
        // Build instructions for each multi-anchor definition in the batch.
        for (const definition of definitions) {
            if (!definition.on || definition.on.length === 0) {
                throw new Error(`Every ${key} instruction must specify an "on" array.`);
            }
            instructions.push(
                this.createExistsInstruction(
                    definition.on,
                    definition,
                    key === "$notExists" ? "notExists" : "exists"
                )
            );
        }
    }

    private splitExistsProperties(value: FilterConditionObject) {
        const { exists, notExists, ...rest } = value;
        const hasRemaining = Object.keys(rest).length > 0;
        return {
            leftover: hasRemaining ? (rest as StateParameterValue) : undefined,
            exists: exists as ExistsSubqueryDefinition | undefined,
            notExists: notExists as ExistsSubqueryDefinition | undefined        
        };
    }

    private isFilterConditionObject(value: FilterConditionValue): value is FilterConditionObject {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    private isMultiColumnDefinitionArray(value: FilterConditionValue): value is MultiColumnExistsDefinition[] {
        return Array.isArray(value) && value.every(entry => this.isMultiColumnDefinition(entry));
    }

    private isMultiColumnDefinition(value: unknown): value is MultiColumnExistsDefinition {
        if (!value || typeof value !== "object") {
            return false;
        }
        const candidate = value as MultiColumnExistsDefinition;
        return (
            Array.isArray(candidate.on) &&
            candidate.on.length > 0 &&
            candidate.on.every(column => typeof column === "string") &&
            typeof candidate.sql === "string"
        );
    }

    private createExistsInstruction(
        anchors: string[],
        definition: ExistsSubqueryDefinition,
        mode: "exists" | "notExists"
    ): ExistsInstruction {
        if (!definition.sql || typeof definition.sql !== "string") {
            throw new Error("EXISTS definition must include a SQL string.");
        }
        return {
            mode,
            anchorColumns: anchors,
            sql: definition.sql,
            params: definition.params
        };
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



