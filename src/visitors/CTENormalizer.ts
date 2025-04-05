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
     * Also sorts the tables so that inner (deeper) CTEs come before outer CTEs.
     * 
     * @param commonTables The list of CommonTables to check for name conflicts
     * @returns A new list of CommonTables with resolved name conflicts and proper order
     */
    private resolveNameConflicts(commonTables: CommonTable[]): CommonTable[] {
        // Create a map of table names for quick lookup
        const tableMap = new Map<string, CommonTable>();
        for (const table of commonTables) {
            tableMap.set(table.name.table.name, table);
        }

        // Build dependency graph: which tables reference which other tables
        const dependencies = new Map<string, Set<string>>();
        const referencedBy = new Map<string, Set<string>>();

        for (const table of commonTables) {
            const tableName = table.name.table.name;
            if (!dependencies.has(tableName)) {
                dependencies.set(tableName, new Set<string>());
            }

            // Find any references to other CTEs in this table's query
            // 既存のcollectorインスタンスを再利用してメモリ効率とパフォーマンスを改善
            this.collector.reset();
            table.query.accept(this.collector);
            const referencedTables = this.collector.getCommonTables();

            for (const referencedTable of referencedTables) {
                const referencedName = referencedTable.name.table.name;

                // Only consider references to tables in our collection
                if (tableMap.has(referencedName)) {
                    dependencies.get(tableName)!.add(referencedName);

                    // Add the reverse relationship
                    if (!referencedBy.has(referencedName)) {
                        referencedBy.set(referencedName, new Set<string>());
                    }
                    referencedBy.get(referencedName)!.add(tableName);
                }
            }
        }

        // Sort tables so inner CTEs come before outer CTEs
        // This uses a topological sort
        const result: CommonTable[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        function visit(tableName: string) {
            if (visited.has(tableName)) return;
            if (visiting.has(tableName)) {
                throw new Error(`Circular reference detected in CTE: ${tableName}`);
            }

            visiting.add(tableName);

            // Process dependencies first (inner CTEs)
            const deps = dependencies.get(tableName) || new Set<string>();
            for (const dep of deps) {
                visit(dep);
            }

            visiting.delete(tableName);
            visited.add(tableName);

            // Add this table after its dependencies
            result.push(tableMap.get(tableName)!);
        }

        // Process all tables
        for (const table of commonTables) {
            visit(table.name.table.name);
        }

        return result;
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