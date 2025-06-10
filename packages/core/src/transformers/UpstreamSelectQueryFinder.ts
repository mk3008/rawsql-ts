import { SelectQuery, SimpleSelectQuery, BinarySelectQuery, ValuesQuery } from "../models/SelectQuery";
import { CommonTable, SubQuerySource, TableSource, WithClause } from "../models/Clause";
import { SelectableColumnCollector } from "./SelectableColumnCollector";
import { CTECollector } from "./CTECollector";

/**
 * UpstreamSelectQueryFinder searches upstream queries for the specified columns.
 * If a query (including its upstream CTEs or subqueries) contains all columns,
 * it returns the highest such SelectQuery. Otherwise, it searches downstream.
 * For UNION queries, it checks each branch independently.
 */
export class UpstreamSelectQueryFinder {
    private options: { ignoreCaseAndUnderscore?: boolean };
    private tableColumnResolver?: (tableName: string) => string[];
    private columnCollector: SelectableColumnCollector;

    constructor(tableColumnResolver?: (tableName: string) => string[], options?: { ignoreCaseAndUnderscore?: boolean }) {
        this.options = options || {};
        this.tableColumnResolver = tableColumnResolver;
        // Pass the tableColumnResolver instead of options to fix type mismatch.
        this.columnCollector = new SelectableColumnCollector(this.tableColumnResolver);
    }

    /**
     * Finds the highest SelectQuery containing all specified columns.
     * @param query The root SelectQuery to search.
     * @param columnNames A column name or array of column names to check for.
     * @returns An array of SelectQuery objects, or an empty array if not found.
     */
    public find(query: SelectQuery, columnNames: string | string[]): SimpleSelectQuery[] {
        // Normalize columnNames to array
        const namesArray = typeof columnNames === 'string' ? [columnNames] : columnNames;
        // Use CTECollector to collect CTEs from the root query only once and reuse
        const cteCollector = new CTECollector();
        const ctes = cteCollector.collect(query);
        const cteMap: Map<string, CommonTable> = new Map();
        for (const cte of ctes) {
            cteMap.set(cte.getSourceAliasName(), cte);
        }
        return this.findUpstream(query, namesArray, cteMap);
    }

    private handleTableSource(src: TableSource, columnNames: string[], cteMap: Map<string, CommonTable>): SimpleSelectQuery[] | null {
        // Handles the logic for TableSource in findUpstream
        const cte = cteMap.get(src.table.name);
        if (cte) {
            // Remove the current CTE name from the map to prevent infinite recursion
            const nextCteMap = new Map(cteMap);
            nextCteMap.delete(src.table.name);
            const result = this.findUpstream(cte.query, columnNames, nextCteMap);
            if (result.length === 0) {
                return null;
            }
            return result;
        }
        return null;
    }

    private handleSubQuerySource(src: SubQuerySource, columnNames: string[], cteMap: Map<string, WithClause["tables"][number]>): SimpleSelectQuery[] | null {
        // Handles the logic for SubQuerySource in findUpstream
        const result = this.findUpstream(src.query, columnNames, cteMap);
        if (result.length === 0) {
            return null;
        }
        return result;
    }

    /**
     * Processes all source branches in a FROM clause and checks if all upstream queries contain the specified columns.
     * Returns a flat array of SelectQuery if all branches are valid, otherwise null.
     */
    private processFromClauseBranches(
        fromClause: any,
        columnNames: string[],
        cteMap: Map<string, CommonTable>
    ): SimpleSelectQuery[] | null {
        const sources = fromClause.getSources();
        if (sources.length === 0) return null;

        let allBranchResults: SimpleSelectQuery[][] = [];
        let allBranchesOk = true;
        let validBranchCount = 0; // Count only filterable branches

        for (const sourceExpr of sources) {
            const src = sourceExpr.datasource;
            let branchResult: SimpleSelectQuery[] | null = null;
            if (src instanceof TableSource) {
                branchResult = this.handleTableSource(src, columnNames, cteMap);
                validBranchCount++;
            } else if (src instanceof SubQuerySource) {
                branchResult = this.handleSubQuerySource(src, columnNames, cteMap);
                validBranchCount++;
            } else if (src instanceof ValuesQuery) {
                // Skip ValuesQuery: not filterable, do not count as a valid branch
                continue;
            } else {
                allBranchesOk = false;
                break;
            }

            // If the branch result is null, 
            // it means it didn't find the required columns in this branch
            if (branchResult === null) {
                allBranchesOk = false;
                break;
            }
            allBranchResults.push(branchResult);
        }

        // Check if all valid (filterable) branches are valid and contain the required columns
        if (allBranchesOk && allBranchResults.length === validBranchCount) {
            return allBranchResults.flat();
        }
        return null;
    }

    private findUpstream(query: SelectQuery, columnNames: string[], cteMap: Map<string, CommonTable>): SimpleSelectQuery[] {
        if (query instanceof SimpleSelectQuery) {
            const fromClause = query.fromClause;
            if (fromClause) {
                const branchResult = this.processFromClauseBranches(fromClause, columnNames, cteMap);
                if (branchResult) {
                    return branchResult;
                }
            }
            const columns = this.columnCollector.collect(query).map(col => col.name);
            const normalize = (s: string) =>
                this.options.ignoreCaseAndUnderscore ? s.toLowerCase().replace(/_/g, '') : s;
            // Normalize both the columns and the required names for comparison.
            const hasAll = columnNames.every(name => columns.some(col => normalize(col) === normalize(name)));
            if (hasAll) {
                return [query];
            }
            return [];
        } else if (query instanceof BinarySelectQuery) {
            const left = this.findUpstream(query.left, columnNames, cteMap);
            const right = this.findUpstream(query.right, columnNames, cteMap);
            return [...left, ...right];
        }
        return [];
    }
}
