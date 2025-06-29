import { CommonTable, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { CTECollector } from "./CTECollector";
import { TableSourceCollector } from "./TableSourceCollector";
import { CTEDisabler } from "./CTEDisabler";
import { Formatter } from "./Formatter";
import { CTEBuilder } from "./CTEBuilder";
import { CTEInjector } from "./CTEInjector";

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
    /**
     * Private constructor to prevent instantiation of this utility class.
     */
    private constructor() {
        // This class is not meant to be instantiated.
    }
    /**
     * Normalizes a SQL query by consolidating all CTEs into a single WITH clause
     * at the root level of the query.
     * 
     * @param query The query to normalize
     * @returns A new normalized query with all CTEs at the root level
     */
    public static normalize(query: SelectQuery): SelectQuery {
        // No need to normalize if the query doesn't have any CTEs
        const cteCollector = new CTECollector();
        const allCommonTables = cteCollector.collect(query);

        if (allCommonTables.length === 0) {
            return query;
        }

        // Remove all WITH clauses from the original query
        const cteDisabler = new CTEDisabler();
        cteDisabler.execute(query);

        const injector = new CTEInjector();
        return injector.inject(query, allCommonTables);
    }
}