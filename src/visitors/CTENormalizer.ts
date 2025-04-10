import { CommonTable, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { CommonTableCollector } from "./CommonTableCollector";
import { TableSourceCollector } from "./TableSourceCollector";
import { WithClauseDisabler } from "./WithClauseDisabler";
import { Formatter } from "./Formatter";

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
    private cteCollector: CommonTableCollector;
    private sourceCollector: TableSourceCollector;
    private disabler: WithClauseDisabler;
    private formatter: Formatter;

    constructor() {
        this.cteCollector = new CommonTableCollector();
        this.sourceCollector = new TableSourceCollector(true); // selectableOnly=true to focus on FROM/JOIN tables
        this.disabler = new WithClauseDisabler();
        this.formatter = new Formatter();
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
        const uniqueCommonTables = this.resolveNameConflicts(allCommonTables);

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
     * Resolves name conflicts among CommonTables.
     * If there are duplicate CTE names, they must have identical definitions.
     * Also sorts the tables so that:
     * 1. Recursive CTEs come first (CTEs that reference themselves)
     * 2. Then remaining tables are sorted so inner (deeper) CTEs come before outer CTEs
     * 
     * @param commonTables The list of CommonTables to check for name conflicts
     * @returns A new list of CommonTables with resolved name conflicts and proper order
     * @throws Error if there are duplicate CTE names with different definitions
     */
    private resolveNameConflicts(commonTables: CommonTable[]): CommonTable[] {
        // If empty or only one table, no conflicts to resolve
        if (commonTables.length <= 1) {
            return commonTables;
        }

        // Step 1: Resolve name conflicts
        const resolvedTables = this.resolveDuplicateNames(commonTables);

        // Step 2: Identify recursive CTEs and build dependency graph
        const { tableMap, recursiveCTEs, dependencies } = this.buildDependencyGraph(resolvedTables);

        // Step 3: Sort tables according to dependencies and recursiveness
        return this.sortCommonTables(resolvedTables, tableMap, recursiveCTEs, dependencies);
    }

    /**
     * Resolves duplicate CTE names by checking if they have identical definitions.
     * If definitions differ, throws an error.
     * 
     * @param commonTables The list of CTEs to check for duplicates
     * @returns A list of CTEs with duplicates removed
     * @throws Error if there are duplicate CTE names with different definitions
     */
    private resolveDuplicateNames(commonTables: CommonTable[]): CommonTable[] {
        // Group CTEs by their names
        const ctesByName = new Map<string, CommonTable[]>();
        for (const table of commonTables) {
            const tableName = table.alias.table.name;
            if (!ctesByName.has(tableName)) {
                ctesByName.set(tableName, []);
            }
            ctesByName.get(tableName)!.push(table);
        }

        // Resolve name duplications
        const resolvedTables: CommonTable[] = [];
        for (const [name, tables] of ctesByName.entries()) {
            if (tables.length === 1) {
                // No duplication
                resolvedTables.push(tables[0]);
                continue;
            }

            // For duplicate names, check if definitions are identical
            const definitions = tables.map(table => this.formatter.visit(table.query));
            const uniqueDefinitions = new Set(definitions);

            if (uniqueDefinitions.size === 1) {
                // If all definitions are identical, use only the first one
                resolvedTables.push(tables[0]);
            } else {
                // Error if definitions differ
                throw new Error(`CTE name conflict detected: '${name}' has multiple different definitions`);
            }
        }

        return resolvedTables;
    }

    /**
     * Builds a dependency graph of CTEs and identifies recursive CTEs.
     * 
     * @param tables The list of CTEs to analyze
     * @returns Object containing the table map, set of recursive CTEs, and dependency map
     */
    private buildDependencyGraph(tables: CommonTable[]): {
        tableMap: Map<string, CommonTable>,
        recursiveCTEs: Set<string>,
        dependencies: Map<string, Set<string>>
    } {
        // Create a map of table names for quick lookup
        const tableMap = new Map<string, CommonTable>();
        for (const table of tables) {
            tableMap.set(table.alias.table.name, table);
        }

        // Identify recursive CTEs (those that reference themselves)
        const recursiveCTEs = new Set<string>();

        // Build dependency graph: which tables reference which other tables
        const dependencies = new Map<string, Set<string>>();
        const referencedBy = new Map<string, Set<string>>();

        for (const table of tables) {
            const tableName = table.alias.table.name;

            // Check for self-references (recursive CTEs)
            const referencedTables = this.sourceCollector.collect(table.query);

            // Check if this CTE references itself
            for (const referencedTable of referencedTables) {
                if (referencedTable.table.name === tableName) {
                    recursiveCTEs.add(tableName);
                    break;
                }
            }

            // Setup dependencies
            if (!dependencies.has(tableName)) {
                dependencies.set(tableName, new Set<string>());
            }

            // Find any references to other CTEs in this table's query
            const referencedCTEs = this.cteCollector.collect(table.query);

            for (const referencedCTE of referencedCTEs) {
                const referencedName = referencedCTE.alias.table.name;

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

        return { tableMap, recursiveCTEs, dependencies };
    }

    /**
     * Sorts the CTEs using topological sort, with recursive CTEs coming first.
     * 
     * @param tables The list of CTEs to sort
     * @param tableMap Map of table names to their CommonTable objects
     * @param recursiveCTEs Set of table names that are recursive (self-referential)
     * @param dependencies Map of table dependencies
     * @returns Sorted list of CTEs
     * @throws Error if a circular reference is detected
     */
    private sortCommonTables(
        tables: CommonTable[],
        tableMap: Map<string, CommonTable>,
        recursiveCTEs: Set<string>,
        dependencies: Map<string, Set<string>>
    ): CommonTable[] {
        const recursiveResult: CommonTable[] = [];
        const nonRecursiveResult: CommonTable[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        // Topological sort function
        const visit = (tableName: string) => {
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
            // Recursive CTEs go to recursiveResult, others to nonRecursiveResult
            if (recursiveCTEs.has(tableName)) {
                recursiveResult.push(tableMap.get(tableName)!);
            } else {
                nonRecursiveResult.push(tableMap.get(tableName)!);
            }
        };

        // Process all tables
        for (const table of tables) {
            const tableName = table.alias.table.name;
            if (!visited.has(tableName)) {
                visit(tableName);
            }
        }

        // Combine the results: recursive CTEs first, then non-recursive CTEs
        return [...recursiveResult, ...nonRecursiveResult];
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