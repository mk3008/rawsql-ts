import { CommonTable, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { CommonTableCollector } from "./CommonTableCollector";
import { WithClauseDisabler } from "./WithClauseDisabler";

/**
 * CTENormalizer is responsible for normalizing Common Table Expressions (CTEs) within SQL queries.
 * It collects all CTEs from various parts of the query and consolidates them into a single WITH clause
 * at the root level of the query.
 * 
 * This implementation uses:
 * 1. CommonTableCollector - to gather all CTEs from the query structure
 * 2. WithClauseDisabler - to remove all original WITH clauses from the query
 */
export class CTENormalizer {
    private collector: CommonTableCollector;
    private disabler: WithClauseDisabler;

    constructor() {
        this.collector = new CommonTableCollector();
        this.disabler = new WithClauseDisabler();
    }

    /**
     * Normalizes a SQL query by consolidating all CTEs into a single WITH clause
     * at the root level of the query.
     * 
     * @param query The query to normalize
     * @returns A new normalized query with all CTEs at the root level
     */
    normalize(query: SelectQuery): SelectQuery {
        // No need to normalize if the query doesn't have any CTEs
        this.collector.reset();
        query.accept(this.collector);
        const allCommonTables = this.collector.getCommonTables();

        if (allCommonTables.length === 0) {
            return query;
        }

        // Resolve name conflicts
        const uniqueCommonTables = this.resolveNameConflicts(allCommonTables);

        // Remove all WITH clauses from the original query
        this.disabler.reset();
        const queryWithoutCTEs = this.disabler.visit(query) as SelectQuery;

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
     * Resolves name conflicts among CommonTables by renaming duplicates.
     * 
     * @param commonTables The list of CommonTables to check for name conflicts
     * @returns A new list of CommonTables with resolved name conflicts
     */
    private resolveNameConflicts(commonTables: CommonTable[]): CommonTable[] {
        // Will be implemented later. Not needed for now.
        return commonTables;
    }

    /**
     * Checks if any of the common tables need a recursive WITH clause.
     * 
     * @param commonTables The list of CommonTables to check
     * @returns True if a recursive WITH clause is needed
     */
    private needsRecursiveWithClause(commonTables: CommonTable[]): boolean {
        // For now, we'll assume no recursion is needed
        // A more sophisticated implementation would analyze the query structure
        return false;
    }
}