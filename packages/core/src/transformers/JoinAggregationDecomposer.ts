import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import { SelectClause, SelectItem, FromClause, WithClause, CommonTable, GroupByClause, SourceExpression, SourceAliasExpression, TableSource } from "../models/Clause";
import { FunctionCall, ColumnReference, ValueComponent, IdentifierString } from "../models/ValueComponent";
import { SqlFormatter } from "./SqlFormatter";

/**
 * Options for JoinAggregationDecomposer
 */
export interface JoinDecomposerOptions {
    /** Name for the detail CTE (default: "detail_data") */
    detailCTEName?: string;
}

/**
 * Result of decomposition analysis (safe, no exceptions)
 */
export interface DecompositionAnalysisResult {
    /** Whether the query can be decomposed */
    success: boolean;
    /** The decomposed query if successful */
    decomposedQuery?: SimpleSelectQuery;
    /** Error message if failed */
    error?: string;
    /** Known limitations that may affect the result */
    limitations?: string[];
    /** Metadata about the decomposition process */
    metadata: {
        /** Number of JOINs found */
        joinCount: number;
        /** Number of aggregation functions found */
        aggregationCount: number;
        /** Columns included in detail CTE */
        detailColumns: string[];
        /** Whether HAVING clause exists */
        hasHaving: boolean;
        /** Whether ORDER BY clause exists */
        hasOrderBy: boolean;
        /** Whether window functions are present */
        hasWindowFunctions: boolean;
    };
}

/**
 * Error thrown when query decomposition fails
 */
export class DecompositionError extends Error {
    constructor(
        message: string,
        public readonly originalQuery: SimpleSelectQuery,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'DecompositionError';
    }
}

/**
 * Decomposes queries that combine table joins with aggregations into separate detail and aggregation queries using CTEs
 * 
 * This transformer separates JOIN operations from aggregation operations to make queries easier to debug:
 * - Detail query: Contains JOINs and column selection
 * - Aggregation query: Contains GROUP BY and aggregation functions, referencing the CTE
 * 
 * Provides two patterns following existing codebase conventions:
 * - analyze(): Safe analysis (Result pattern like SelectQueryParser.analyze)
 * - decompose(): Direct decomposition with exceptions (Exception pattern like SelectQueryParser.parse)
 * 
 * @example
 * ```typescript
 * const decomposer = new JoinAggregationDecomposer();
 * 
 * // Safe analysis (Result pattern)
 * const analysis = decomposer.analyze(query);
 * if (analysis.success) {
 *   console.log('Can decompose with', analysis.metadata.joinCount, 'joins');
 *   if (analysis.limitations) {
 *     console.log('Known limitations:', analysis.limitations);
 *   }
 * } else {
 *   console.log('Cannot decompose:', analysis.error);
 * }
 * 
 * // Direct decomposition (Exception pattern)
 * try {
 *   const decomposed = decomposer.decompose(query);
 *   // Success: decomposed query ready to use
 * } catch (error) {
 *   if (error instanceof DecompositionError) {
 *     console.log('Decomposition failed:', error.message);
 *   }
 * }
 * ```
 */
export class JoinAggregationDecomposer {
    private readonly options: Required<JoinDecomposerOptions>;
    private readonly formatter: SqlFormatter;

    constructor(options: JoinDecomposerOptions = {}) {
        this.options = {
            detailCTEName: options.detailCTEName || "detail_data"
        };
        this.formatter = new SqlFormatter({ identifierEscape: { start: "", end: "" } });
    }

    /**
     * Analyzes a query for decomposition without throwing errors (safe analysis)
     * Follows the same pattern as SelectQueryParser.analyze()
     * 
     * @param query The query to analyze
     * @returns Analysis result with success status, error information, and metadata
     */
    analyze(query: SimpleSelectQuery): DecompositionAnalysisResult {
        const metadata = this.extractMetadata(query);
        
        try {
            // Phase 1: Validate query structure
            const validationError = this.getValidationError(query, metadata);
            if (validationError) {
                return {
                    success: false,
                    error: validationError,
                    metadata
                };
            }
            
            // Phase 2: Attempt decomposition
            const decomposed = this.performDecomposition(query);
            
            // Phase 3: Check for formatting issues (critical validation)
            try {
                this.formatter.format(decomposed);
            } catch (formatError) {
                return {
                    success: false,
                    error: `Decomposed query cannot be formatted: ${formatError instanceof Error ? formatError.message : String(formatError)}. This usually indicates complex expressions in aggregations that are not supported.`,
                    metadata
                };
            }
            
            // Check for known limitations
            const limitations = this.detectLimitations(metadata);
            
            return {
                success: true,
                decomposedQuery: decomposed,
                limitations: limitations.length > 0 ? limitations : undefined,
                metadata
            };
            
        } catch (error) {
            return {
                success: false,
                error: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
                metadata
            };
        }
    }

    /**
     * Decomposes a JOIN + aggregation query into separate detail and aggregation queries
     * Follows the same pattern as SelectQueryParser.parse() - throws on error
     * 
     * @param query The query to decompose
     * @returns The decomposed query with CTE structure
     * @throws DecompositionError if the query cannot be decomposed or formatted
     */
    decompose(query: SimpleSelectQuery): SimpleSelectQuery {
        try {
            // Phase 1: Validate query structure
            const metadata = this.extractMetadata(query);
            const validationError = this.getValidationError(query, metadata);
            if (validationError) {
                throw new DecompositionError(validationError, query);
            }
            
            // Phase 2: Perform decomposition
            const decomposed = this.performDecomposition(query);
            
            // Phase 3: Critical validation - ensure the result can be formatted
            try {
                this.formatter.format(decomposed);
            } catch (formatError) {
                throw new DecompositionError(
                    `Decomposed query cannot be formatted: ${formatError instanceof Error ? formatError.message : String(formatError)}. ` +
                    `This usually indicates complex expressions in aggregations that are not supported.`,
                    query,
                    formatError instanceof Error ? formatError : undefined
                );
            }

            return decomposed;
            
        } catch (error) {
            if (error instanceof DecompositionError) {
                throw error;
            }
            throw new DecompositionError(
                `Decomposition failed: ${error instanceof Error ? error.message : String(error)}`,
                query,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Gets validation error message without throwing (for analyze method)
     */
    private getValidationError(query: SimpleSelectQuery, metadata: DecompositionAnalysisResult['metadata']): string | null {
        if (!query.fromClause) {
            return "Query does not contain FROM clause";
        }

        if (metadata.joinCount === 0) {
            return "Query does not contain JOINs";
        }

        if (metadata.aggregationCount === 0 && !query.groupByClause) {
            return "Query does not contain GROUP BY or aggregation functions";
        }

        if (metadata.hasWindowFunctions) {
            return "Window functions are not fully supported - column references in window functions are not converted to CTE references";
        }

        return null;
    }

    /**
     * Performs the actual decomposition
     */
    private performDecomposition(query: SimpleSelectQuery): SimpleSelectQuery {
        // Extract columns needed for detail CTE
        const detailColumns = this.extractDetailColumns(query);
        
        // Build detail query (CTE)
        const detailQuery = this.buildDetailQuery(query, detailColumns);
        
        // Build aggregation query
        const aggregationQuery = this.buildAggregationQuery(query);
        
        // Create WITH clause
        const withClause = new WithClause(
            false, // not recursive
            [
                new CommonTable(
                    detailQuery,
                    this.options.detailCTEName,
                    null // not materialized
                )
            ]
        );
        
        // Combine into final query
        aggregationQuery.withClause = withClause;
        return aggregationQuery;
    }

    /**
     * Extracts metadata about the query
     */
    private extractMetadata(query: SimpleSelectQuery): DecompositionAnalysisResult['metadata'] {
        const joinCount = this.countJoins(query);
        const aggregationCount = this.countAggregationFunctions(query);
        const hasHaving = !!query.havingClause;
        const hasOrderBy = !!query.orderByClause;
        const hasWindowFunctions = this.hasWindowFunctions(query);
        const detailColumns = this.extractDetailColumnNames(query);
        
        return {
            joinCount,
            aggregationCount,
            detailColumns,
            hasHaving,
            hasOrderBy,
            hasWindowFunctions
        };
    }

    /**
     * Detects known limitations based on metadata
     */
    private detectLimitations(metadata: DecompositionAnalysisResult['metadata']): string[] {
        const limitations: string[] = [];
        
        if (metadata.hasWindowFunctions && metadata.aggregationCount > 0) {
            limitations.push("Window functions may reference original table columns instead of CTE columns");
        }
        if (metadata.hasHaving) {
            limitations.push("HAVING clause column references are not converted to CTE references");
        }
        if (metadata.hasOrderBy) {
            limitations.push("ORDER BY clause column references are not converted to CTE references");
        }
        
        return limitations;
    }

    /**
     * Counts the number of JOINs in the query
     */
    private countJoins(query: SimpleSelectQuery): number {
        return query.fromClause?.joins?.length || 0;
    }

    /**
     * Counts aggregation functions in the query
     */
    private countAggregationFunctions(query: SimpleSelectQuery): number {
        let count = 0;
        if (query.selectClause?.items) {
            for (const item of query.selectClause.items) {
                if (this.containsAggregationFunction(item.value)) {
                    count++;
                }
            }
        }
        return count;
    }

    /**
     * Checks if query contains window functions
     */
    private hasWindowFunctions(query: SimpleSelectQuery): boolean {
        if (query.selectClause?.items) {
            for (const item of query.selectClause.items) {
                if (this.containsWindowFunction(item.value)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Checks if an expression contains aggregation functions
     */
    private containsAggregationFunction(expression: ValueComponent): boolean {
        if (expression instanceof FunctionCall) {
            const funcName = this.getFunctionName(expression).toLowerCase();
            return ['count', 'sum', 'avg', 'min', 'max'].includes(funcName);
        }
        return false;
    }

    /**
     * Checks if an expression contains window functions
     */
    private containsWindowFunction(expression: ValueComponent): boolean {
        if (expression instanceof FunctionCall && expression.over) {
            return true;
        }
        // Fallback: check for common window function names
        if (expression instanceof FunctionCall) {
            const funcName = this.getFunctionName(expression).toLowerCase();
            return ['row_number', 'rank', 'dense_rank', 'lead', 'lag'].includes(funcName);
        }
        return false;
    }

    /**
     * Gets function name from FunctionCall
     */
    private getFunctionName(func: FunctionCall): string {
        const name = func.qualifiedName.name;
        if (name instanceof IdentifierString) {
            return name.name;
        } else {
            return name.value;
        }
    }

    /**
     * Extracts detail column names for metadata
     */
    private extractDetailColumnNames(query: SimpleSelectQuery): string[] {
        const columns: string[] = [];
        
        // Add GROUP BY columns
        if (query.groupByClause?.grouping) {
            for (const expr of query.groupByClause.grouping) {
                columns.push(expr.toString());
            }
        }

        // Add columns from aggregation functions
        if (query.selectClause?.items) {
            for (const item of query.selectClause.items) {
                if (this.containsAggregationFunction(item.value) && item.value instanceof FunctionCall) {
                    if (item.value.argument) {
                        columns.push(item.value.argument.toString());
                    }
                }
            }
        }

        return [...new Set(columns)]; // Remove duplicates
    }

    /**
     * Extracts columns needed for the detail CTE
     */
    private extractDetailColumns(query: SimpleSelectQuery): ColumnReference[] {
        const columns: ColumnReference[] = [];
        const columnSet = new Set<string>();

        // Add GROUP BY columns
        if (query.groupByClause?.grouping) {
            for (const expr of query.groupByClause.grouping) {
                if (expr instanceof ColumnReference) {
                    const key = this.getColumnKey(expr);
                    if (!columnSet.has(key)) {
                        columns.push(expr);
                        columnSet.add(key);
                    }
                }
            }
        }

        // Add columns from aggregation function arguments
        if (query.selectClause?.items) {
            for (const item of query.selectClause.items) {
                this.extractColumnsFromExpression(item.value, columns, columnSet);
            }
        }

        return columns;
    }

    /**
     * Extracts column references from an expression
     */
    private extractColumnsFromExpression(
        expression: ValueComponent,
        columns: ColumnReference[],
        columnSet: Set<string>
    ): void {
        if (expression instanceof FunctionCall) {
            if (expression.argument) {
                if (expression.argument instanceof ColumnReference) {
                    const key = this.getColumnKey(expression.argument);
                    if (!columnSet.has(key)) {
                        columns.push(expression.argument);
                        columnSet.add(key);
                    }
                } else if (expression.argument.toString() === '*') {
                    // Handle COUNT(*) by adding special marker
                    const starColumn = new ColumnReference(null, '*');
                    const key = this.getColumnKey(starColumn);
                    if (!columnSet.has(key)) {
                        columns.push(starColumn);
                        columnSet.add(key);
                    }
                }
            }
        } else if (expression instanceof ColumnReference) {
            const key = this.getColumnKey(expression);
            if (!columnSet.has(key)) {
                columns.push(expression);
                columnSet.add(key);
            }
        }
    }

    /**
     * Gets a unique key for a column reference
     */
    private getColumnKey(column: ColumnReference): string {
        const namespace = column.namespaces?.map(ns => ns.name).join('.') || '';
        const columnName = column.column.name;
        return namespace ? `${namespace}.${columnName}` : columnName;
    }

    /**
     * Builds the detail query (CTE content)
     */
    private buildDetailQuery(originalQuery: SimpleSelectQuery, detailColumns: ColumnReference[]): SimpleSelectQuery {
        const selectItems = detailColumns.map(col => new SelectItem(col));
        
        return new SimpleSelectQuery({
            selectClause: new SelectClause(selectItems),
            fromClause: originalQuery.fromClause,
            whereClause: originalQuery.whereClause
        });
    }

    /**
     * Builds the aggregation query that references the CTE
     */
    private buildAggregationQuery(originalQuery: SimpleSelectQuery): SimpleSelectQuery {
        // Transform SELECT items to reference CTE columns
        const transformedSelectItems = originalQuery.selectClause?.items?.map(item => {
            const transformedExpression = this.transformExpressionForCTE(item.value);
            return new SelectItem(transformedExpression, item.identifier?.name || null);
        }) || [];

        // Transform GROUP BY to reference CTE columns
        const transformedGroupBy = originalQuery.groupByClause?.grouping?.map(expr => {
            return this.transformExpressionForCTE(expr);
        });

        // Create FROM clause that references the CTE
        const cteFromClause = new FromClause(
            new SourceExpression(
                new TableSource(
                    null,
                    new IdentifierString(this.options.detailCTEName)
                ),
                null
            ),
            null
        );

        return new SimpleSelectQuery({
            selectClause: new SelectClause(transformedSelectItems),
            fromClause: cteFromClause,
            groupByClause: transformedGroupBy ? new GroupByClause(transformedGroupBy) : undefined,
            havingClause: originalQuery.havingClause, // TODO: Transform references if needed
            orderByClause: originalQuery.orderByClause // TODO: Transform references if needed
        });
    }

    /**
     * Transforms an expression to reference CTE columns instead of original table columns
     */
    private transformExpressionForCTE(expression: ValueComponent): ValueComponent {
        if (expression instanceof FunctionCall) {
            // Transform aggregation function arguments
            const transformedArg = expression.argument ? 
                (expression.argument instanceof ColumnReference ?
                    // Convert table.column to just column for CTE reference
                    new ColumnReference(null, expression.argument.column.name) :
                    expression.argument
                ) : null;

            return new FunctionCall(
                expression.qualifiedName.namespaces,
                expression.qualifiedName.name,
                transformedArg,
                expression.over,
                expression.withinGroup
            );
        } else if (expression instanceof ColumnReference) {
            // Convert table.column to just column for CTE reference
            return new ColumnReference(null, expression.column.name);
        }

        return expression;
    }
}

/**
 * Utility function to analyze a JOIN + aggregation query from SQL string (safe, no exceptions)
 * 
 * @param sql The SQL string to parse and analyze
 * @param options Decomposer options
 * @returns Analysis result with success status, error information, and metadata
 */
export function analyzeJoinAggregation(
    sql: string,
    options?: JoinDecomposerOptions
): DecompositionAnalysisResult {
    try {
        // Import using ES module syntax to avoid require issues
        const { SelectQueryParser } = eval('require("../parsers/SelectQueryParser")');
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const decomposer = new JoinAggregationDecomposer(options);
        return decomposer.analyze(query);
    } catch (error) {
        return {
            success: false,
            error: `Failed to parse SQL: ${error instanceof Error ? error.message : String(error)}`,
            metadata: {
                joinCount: 0,
                aggregationCount: 0,
                detailColumns: [],
                hasHaving: false,
                hasOrderBy: false,
                hasWindowFunctions: false
            }
        };
    }
}

/**
 * Utility function to decompose a JOIN + aggregation query from SQL string
 * 
 * @param sql The SQL string to parse and decompose
 * @param options Decomposer options
 * @returns The decomposed query
 * @throws DecompositionError if parsing or decomposition fails
 */
export function decomposeJoinAggregation(
    sql: string,
    options?: JoinDecomposerOptions
): SimpleSelectQuery {
    try {
        // Import using ES module syntax to avoid require issues
        const { SelectQueryParser } = eval('require("../parsers/SelectQueryParser")');
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const decomposer = new JoinAggregationDecomposer(options);
        return decomposer.decompose(query);
    } catch (error) {
        if (error instanceof DecompositionError) {
            throw error;
        }
        throw new DecompositionError(
            `Failed to parse SQL: ${error instanceof Error ? error.message : String(error)}`,
            new SimpleSelectQuery({ selectClause: new SelectClause([]) }),
            error instanceof Error ? error : undefined
        );
    }
}