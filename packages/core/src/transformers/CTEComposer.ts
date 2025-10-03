import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import type { SelectQuery } from "../models/SelectQuery";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { SqlTokenizer } from "../parsers/SqlTokenizer";
import { WithClauseParser } from "../parsers/WithClauseParser";
import { CTENormalizer } from "./CTENormalizer";
import { CTEDisabler } from "./CTEDisabler";
import { SqlFormatter, SqlFormatterOptions } from "./SqlFormatter";
import { SqlSchemaValidator } from "../utils/SqlSchemaValidator";
import { CommonTable, SourceAliasExpression } from "../models/Clause";
import { CTEDependencyAnalyzer } from "./CTEDependencyAnalyzer";

/**
 * Interface representing an edited CTE with simplified structure
 * @public
 */
export interface EditedCTE {
    /** Name of the CTE */
    name: string;
    /** SQL query for this CTE, may contain WITH clause from editing */
    query: string;
}

/**
 * Options for CTEComposer extending SqlFormatterOptions
 * @public
 */
export interface CTEComposerOptions extends SqlFormatterOptions {
    /** Whether to validate the composed query against a schema */
    validateSchema?: boolean;
    /** Table to columns mapping for schema validation (required if validateSchema is true) */
    schema?: Record<string, string[]>;
}

/**
 * Composes edited CTEs back into a unified SQL query
 * 
 * Takes CTEs that were individually edited after decomposition and reconstructs them
 * into a proper WITH clause structure. This completes the CTE debugging workflow:
 * 1. Use CTEQueryDecomposer to break down complex CTEs
 * 2. Edit individual CTEs to fix issues  
 * 3. Use CTEComposer to reconstruct the unified query
 * 
 * @example
 * ```typescript
 * // After decomposing and editing CTEs
 * const composer = new CTEComposer({ 
 *   preset: 'postgres',
 *   validateSchema: true,
 *   schema: { users: ['id', 'name', 'active'] }
 * });
 * 
 * const editedCTEs = [
 *   { name: 'base_data', query: 'select * from users where active = true' },
 *   { name: 'filtered_data', query: 'select * from base_data where region = "US"' }
 * ];
 * 
 * const composedSQL = composer.compose(editedCTEs, 'select * from filtered_data');
 * // Dependencies are automatically analyzed and sorted
 * // Result: "with base_data as (...), filtered_data as (...) select * from filtered_data"
 * ```
 * 
 * @public
 */
export class CTEComposer {
    private readonly formatter: SqlFormatter;
    private readonly options: CTEComposerOptions;
    private readonly dependencyAnalyzer: CTEDependencyAnalyzer;
    private knownCTENames: string[] = [];

    /**
     * Creates a new CTEComposer instance
     * @param options - Configuration options extending SqlFormatterOptions
     */
    constructor(options: CTEComposerOptions = {}) {
        this.options = options;
        this.formatter = new SqlFormatter(options);
        this.dependencyAnalyzer = new CTEDependencyAnalyzer();
    }

    public removeWithClauses(input: string): string  {
        return this.removeWithClauseText(input);
    }

    private removeWithClauseText(sql: string): string {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexmes();

        if (lexemes.length === 0) {
            return sql;
        }

        const withIndex = lexemes.findIndex((lexeme) => lexeme.value.toLowerCase() === "with");
        if (withIndex !== 0) {
            return sql;
        }

        let parseResult;
        try {
            parseResult = WithClauseParser.parseFromLexeme(lexemes, withIndex);
        } catch {
            return sql;
        }

        let startPos = this.findTokenPosition(sql, lexemes[withIndex].value, 0);
        if (startPos === sql.length) {
            return sql;
        }

        let searchPos = startPos + lexemes[withIndex].value.length;
        for (let i = withIndex + 1; i < parseResult.newIndex; i++) {
            const token = lexemes[i].value;
            const tokenPos = this.findTokenPosition(sql, token, searchPos);
            if (tokenPos === sql.length) {
                return sql;
            }
            searchPos = tokenPos + token.length;
        }

        const endPos = parseResult.newIndex < lexemes.length
            ? this.findTokenPosition(sql, lexemes[parseResult.newIndex].value, searchPos)
            : sql.length;

        if (endPos === sql.length && parseResult.newIndex < lexemes.length) {
            return sql;
        }

        let prefix = sql.slice(0, startPos);
        if (prefix.trim().length === 0) {
            prefix = "";
        }

        return prefix + sql.slice(endPos);
    }

    private findTokenPosition(sql: string, value: string, fromIndex: number): number {
        const lowerSql = sql.toLowerCase();
        const lowerValue = value.toLowerCase();
        let searchIndex = fromIndex;
        while (searchIndex <= sql.length) {
            const found = lowerSql.indexOf(lowerValue, searchIndex);
            if (found === -1) {
                return sql.length;
            }
            return found;
        }
        return sql.length;
    }

    /**
     * Compose edited CTEs and root query into a unified SQL query
     * 
     * This method:
     * 1. Extracts pure SELECT queries from edited CTEs (removes any WITH clauses)
     * 2. Builds a temporary query to analyze dependencies automatically
     * 3. Sorts CTEs by dependency order using topological sort
     * 4. Validates schema if options.validateSchema is enabled
     * 5. Applies formatter options for consistent output
     * 6. Constructs the final WITH clause with proper recursive handling
     * 
     * @param editedCTEs - Array of edited CTEs with name and query only
     * @param rootQuery - The main query that uses the CTEs (without WITH clause)
     * @returns Composed SQL query with properly structured WITH clause
     * @throws Error if schema validation fails or circular dependencies are detected
     * 
     * @example
     * ```typescript
     * const editedCTEs = [
     *   { name: 'base_data', query: 'select * from users where active = true' },
     *   { name: 'filtered_data', query: 'select * from base_data where region = "US"' }
     * ];
     * 
     * const result = composer.compose(editedCTEs, 'select count(*) from filtered_data');
     * // Dependencies automatically analyzed and sorted
     * // Result: "with base_data as (...), filtered_data as (...) select count(*) from filtered_data"
     * ```
     */
    public compose(editedCTEs: EditedCTE[], rootQuery: string): string {
        if (editedCTEs.length === 0) {
            return rootQuery;
        }

        // Set known CTE names for WITH clause filtering
        this.knownCTENames = editedCTEs.map(cte => cte.name);

        // Extract pure queries and detect recursion
        const pureQueries = editedCTEs.map(cte => ({
            name: cte.name,
            query: this.extractPureQuery(cte.query)
        }));

        // Build temporary query to analyze dependencies
        const tempQuery = this.buildTempQueryForAnalysis(pureQueries, rootQuery);
        
        // Analyze dependencies
        const dependencyGraph = this.dependencyAnalyzer.analyzeDependencies(tempQuery);
        
        // Sort CTEs by dependencies
        const sortedCTEs = this.sortCTEsByDependencies(pureQueries, dependencyGraph);
        
        // Check for recursive CTEs by analyzing original queries
        const isRecursive = this.detectRecursiveFromOriginalQueries(editedCTEs);
        
        // Special handling for recursive CTEs: Current implementation preserves recursive CTEs as-is
        // This is expected behavior for now as recursive CTEs require complex handling
        
        // Build WITH clause with sorted CTEs
        const cteDefinitions = sortedCTEs.map(cte => {
            return `${cte.name} as (${cte.query})`;
        });

        const withKeyword = isRecursive ? "with recursive" : "with";
        const composedQuery = `${withKeyword}\n${cteDefinitions.join("\n, ")}\n${rootQuery}`;
        
        // Validate schema if requested
        if (this.options.validateSchema && this.options.schema) {
            this.validateComposedQuery(composedQuery);
        }
        
        // Apply formatting if options specify it
        return this.formatFinalQuery(composedQuery);
    }

    /**
     * Extract pure SELECT query from a query that may contain WITH clause
     * If query contains WITH with known CTEs, extract main SELECT and ignore old definitions
     * If query contains WITH with unknown CTEs, preserve entire query
     * @param query The query that may contain WITH clause  
     * @returns Pure SELECT query without WITH clause, or entire query if it contains new sub-CTEs
     */
    private extractPureQuery(query: string): string {
        // Simple regex to check if query starts with WITH
        const withPattern = /^\s*with\s+/i;
        
        if (!withPattern.test(query)) {
            return query;
        }

        // Check if this is a recursive CTE by looking for "WITH RECURSIVE"
        const recursivePattern = /^\s*with\s+recursive\s+/i;
        if (recursivePattern.test(query)) {
            // For recursive CTEs, preserve the entire query as-is
            return query;
        }

        // Parse the query to check what CTEs are defined in the WITH clause
        try {
            const parsed = SelectQueryParser.parse(query).toSimpleQuery();
            
            if (parsed.withClause && parsed.withClause.tables) {
                // Check if WITH clause contains only known CTEs from our composition
                const knownCTENames = this.getKnownCTENames();
                const withCTENames = parsed.withClause.tables.map(cte => this.getCTEName(cte));
                
                // If all CTEs in WITH clause are known (old definitions), extract main SELECT
                const hasOnlyKnownCTEs = withCTENames.every(name => knownCTENames.includes(name));
                
                if (hasOnlyKnownCTEs) {
                    // Remove WITH clause and format just the main query
                    const queryWithoutWith = new SimpleSelectQuery({
                        selectClause: parsed.selectClause,
                        fromClause: parsed.fromClause,
                        whereClause: parsed.whereClause,
                        groupByClause: parsed.groupByClause,
                        havingClause: parsed.havingClause,
                        orderByClause: parsed.orderByClause,
                        windowClause: parsed.windowClause,
                        limitClause: parsed.limitClause,
                        offsetClause: parsed.offsetClause,
                        fetchClause: parsed.fetchClause,
                        forClause: parsed.forClause,
                        withClause: undefined // withClause removed
                    });
                    
                    return this.formatter.format(queryWithoutWith).formattedSql;
                }
            }
        } catch (error) {
            // If parsing fails, fall through to preserve entire query
        }

        // If query contains WITH clause with unknown CTEs, preserve it like a recursive CTE
        // This handles the case where user edited a CTE and added new sub-CTEs
        return query;
    }

    /**
     * Get list of known CTE names from current composition context
     */
    private getKnownCTENames(): string[] {
        // This will be set during composition to track known CTE names
        return this.knownCTENames || [];
    }


    /**
     * Extract CTE name from CommonTable
     */
    private getCTEName(cte: CommonTable): string {
        return cte.aliasExpression.table.name;
    }

    /**
     * Extract CTE definition using regex as fallback
     */
    private extractCTEWithRegex(query: string, cteName: string): string {
        // More robust regex to extract CTE definition
        // Pattern: cteName as (...) accounting for nested parentheses
        const ctePattern = new RegExp(`${cteName}\\s+as\\s*\\(`, 'i');
        const match = query.match(ctePattern);
        
        if (!match) {
            return query;
        }
        
        // Find the start of the CTE definition (after "as (")
        const startIndex = match.index! + match[0].length;
        
        // Use parentheses counting to find the end of the CTE definition
        let parenCount = 1;
        let endIndex = startIndex;
        
        while (endIndex < query.length && parenCount > 0) {
            const char = query[endIndex];
            if (char === '(') {
                parenCount++;
            } else if (char === ')') {
                parenCount--;
            }
            endIndex++;
        }
        
        if (parenCount === 0) {
            // Extract the content between parentheses
            const cteDefinition = query.substring(startIndex, endIndex - 1).trim();
            return cteDefinition;
        }
        
        return query;
    }

    /**
     * Build a temporary query for dependency analysis
     */
    private buildTempQueryForAnalysis(pureQueries: {name: string, query: string}[], rootQuery: string): SimpleSelectQuery {
        const cteDefinitions = pureQueries.map(cte => `${cte.name} as (${cte.query})`);
        const tempSql = `with ${cteDefinitions.join(", ")} ${rootQuery}`;
        
        try {
            return SelectQueryParser.parse(tempSql) as SimpleSelectQuery;
        } catch (error) {
            throw new Error(`Failed to parse temporary query for dependency analysis: ${error}`);
        }
    }

    /**
     * Sort CTEs by dependencies using dependency graph
     */
    private sortCTEsByDependencies(
        pureQueries: {name: string, query: string}[], 
        dependencyGraph: { nodes: any[] }
    ): {name: string, query: string}[] {
        // Create a map for quick lookup
        const queryMap = new Map<string, string>();
        pureQueries.forEach(cte => queryMap.set(cte.name, cte.query));

        // Return CTEs in dependency order
        return dependencyGraph.nodes.map(node => ({
            name: node.name,
            query: queryMap.get(node.name) || ""
        })).filter(cte => cte.query !== "");
    }

    /**
     * Detect if any CTEs are recursive by analyzing original queries
     */
    private detectRecursiveFromOriginalQueries(editedCTEs: EditedCTE[]): boolean {
        // Check if any of the original queries contain "with recursive"
        return editedCTEs.some(cte => {
            const queryLower = cte.query.toLowerCase();
            return queryLower.includes('with recursive');
        });
    }

    /**
     * Detect if any CTEs are recursive
     */
    private detectRecursiveCTEs(query: SimpleSelectQuery): boolean {
        if (!query.withClause) return false;
        
        // Check if the query text contains "recursive"
        const queryText = this.formatter.format(query).formattedSql.toLowerCase();
        return queryText.includes('with recursive');
    }

    /**
     * Validate the composed query against schema
     */
    private validateComposedQuery(composedQuery: string): void {
        try {
            const parsed = SelectQueryParser.parse(composedQuery) as SimpleSelectQuery;
            
            // Convert schema to TableSchema format
            const tableSchemas = Object.entries(this.options.schema!).map(([name, columns]) => ({
                name,
                columns
            }));
            
            SqlSchemaValidator.validate(parsed, tableSchemas);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Schema validation failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Apply formatting to the final query
     */
    private formatFinalQuery(composedQuery: string): string {
        const parsed = SelectQueryParser.parse(composedQuery).toSimpleQuery();
        const f = new SqlFormatter({ ...this.formatter, withClauseStyle: 'cte-oneline'});
        return this.formatter.format(parsed).formattedSql;
    }
}
