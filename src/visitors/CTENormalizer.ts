import { CommonTable, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { CTECollector } from "./CTECollector";
import { TableSourceCollector } from "./TableSourceCollector";
import { CTEDisabler } from "./CTEDisabler";
import { Formatter } from "./Formatter";
import { CTENameConflictResolver } from "./CTENameConflictResolver";

/**
 * CTENormalizer is responsible for normalizing Common Table Expressions (CTEs) within SQL queries.
 * It collects all CTEs from various parts of the query and consolidates them into a single WITH clause
 * at the root level of the query.
 * 
 * This implementation uses:
 * 1. CommonTableCollector - to gather all CTEs from the query structure
 * 2. WithClauseDisabler - to remove all original WITH clauses from the query
 * 3. CTENameConflictResolver - to resolve name conflicts among CTEs and sort them properly
 */
export class CTENormalizer {
    private cteCollector: CTECollector;
    private sourceCollector: TableSourceCollector;
    private disabler: CTEDisabler;
    private formatter: Formatter;
    private nameConflictResolver: CTENameConflictResolver;

    constructor() {
        this.cteCollector = new CTECollector();
        this.sourceCollector = new TableSourceCollector(true); // selectableOnly=true to focus on FROM/JOIN tables
        this.disabler = new CTEDisabler();
        this.formatter = new Formatter();
        this.nameConflictResolver = new CTENameConflictResolver();
    }

    /**
     * Normalizes a SQL query by consolidating all CTEs into a single WITH clause
     * at the root level of the query.
     * 
     * @param query The query to normalize
     * @returns A new normalized query with all CTEs at the root level
     */
    public normalize(query: SelectQuery): SelectQuery {
        // No need to normalize if the query doesn't have any CTEs
        const allCommonTables = this.cteCollector.collect(query);

        if (allCommonTables.length === 0) {
            return query;
        }

        // Resolve name conflicts
        const uniqueCommonTables = this.nameConflictResolver.resolveNameConflicts(allCommonTables);

        // Remove all WITH clauses from the original query
        const queryWithoutCTEs = this.disabler.execute(query) as SelectQuery;

        // Create a new query with a single WITH clause at the root
        return this.addWithClauseToQuery(queryWithoutCTEs, uniqueCommonTables);
    }

    /**
     * Adds a WITH clause containing the given common tables to a query.
     * 
     * @param query The query to add the WITH clause to
     * @param commonTables The common tables to include in the WITH clause
     * @returns A new query with the WITH clause added
     */
    private addWithClauseToQuery(query: SelectQuery, commonTables: CommonTable[]): SelectQuery {
        const withClause = new WithClause(
            this.needsRecursiveWithClause(commonTables),
            commonTables
        );

        if (query instanceof SimpleSelectQuery) {
            return new SimpleSelectQuery(
                withClause,
                query.selectClause,
                query.fromClause,
                query.whereClause,
                query.groupByClause,
                query.havingClause,
                query.orderByClause,
                query.windowFrameClause,
                query.rowLimitClause,
                query.forClause
            );
        } else if (query instanceof BinarySelectQuery || query instanceof ValuesQuery) {
            // Will be implemented later. Not needed for now.
            throw new Error("Unsupported query type for CTE normalization");
        }

        throw new Error("Unsupported query type for CTE normalization");
    }

    /**
     * Checks if any of the common tables need a recursive WITH clause.
     * A recursive WITH clause is needed when a CTE references itself.
     * 
     * @param commonTables The list of CommonTables to check
     * @returns True if a recursive WITH clause is needed
     */
    private needsRecursiveWithClause(commonTables: CommonTable[]): boolean {
        // For each common table, check if it references itself
        for (const table of commonTables) {
            // Get the CTE name
            const cteName = table.alias.table.name;

            // Use TableSourceCollector to find all tables referenced in the CTE's query
            const referencedTables = this.sourceCollector.collect(table.query);

            // Check if any of the referenced tables have the same name as this CTE
            for (const referencedTable of referencedTables) {
                if (referencedTable.table.name === cteName) {
                    // Found self-reference, need a recursive WITH clause
                    return true;
                }
            }
        }

        // No self-references found
        return false;
    }
}