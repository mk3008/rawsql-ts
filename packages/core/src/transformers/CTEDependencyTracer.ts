import { SelectQuery, SimpleSelectQuery, BinarySelectQuery } from "../models/SelectQuery";
import { CommonTable, CTEQuery, ReturningClause, SelectItem } from "../models/Clause";
import { InsertQuery } from "../models/InsertQuery";
import { UpdateQuery } from "../models/UpdateQuery";
import { DeleteQuery } from "../models/DeleteQuery";
import { ColumnReference } from "../models/ValueComponent";
import { CTECollector } from "./CTECollector";
import { SelectableColumnCollector } from "./SelectableColumnCollector";
import { TableSourceCollector } from "./TableSourceCollector";

/**
 * CTE dependency tree node for visualization
 */
export interface CTENode {
    name: string;
    columns: string[];
    dependencies: string[];
    dependents: string[];
    query: CTEQuery;
    level: number; // Depth in dependency tree
}

/**
 * CTE dependency graph for debugging complex queries
 */
export interface CTEGraph {
    nodes: Map<string, CTENode>;
    rootNodes: string[]; // CTEs that don't depend on others
    leafNodes: string[]; // CTEs that aren't used by others
}

/**
 * Debug utility for visualizing CTE dependencies and column search paths
 */
export class CTEDependencyTracer {
    private columnCollector: SelectableColumnCollector;
    private silent: boolean;

    constructor(options?: { silent?: boolean }) {
        this.columnCollector = new SelectableColumnCollector();
        this.silent = options?.silent ?? false;
    }

    /**
     * Build complete CTE dependency graph
     */
    public buildGraph(query: SelectQuery): CTEGraph {
        const cteCollector = new CTECollector();
        const ctes = cteCollector.collect(query);

        const nodes = new Map<string, CTENode>();

        // First pass: Create all nodes
        ctes.forEach(cte => {
            const cteName = cte.getSourceAliasName();
            let columns: string[] = [];

            try {
                if (this.isSelectQuery(cte.query)) {
                    const columnRefs = this.columnCollector.collect(cte.query);
                    columns = columnRefs.map(col => col.name);
                } else {
                    columns = this.extractReturningColumns(cte.query);
                }
            } catch (error) {
                if (!this.silent) {
                    console.warn(`Failed to collect columns for CTE ${cteName}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            nodes.set(cteName, {
                name: cteName,
                columns,
                dependencies: [],
                dependents: [],
                query: cte.query,
                level: 0
            });
        });

        // Second pass: Build dependencies
        ctes.forEach(cte => {
            const cteName = cte.getSourceAliasName();
            const node = nodes.get(cteName)!;

            // Find all CTEs referenced in this CTE's query
            const referencedCTEs = this.findReferencedCTEs(cte.query, nodes);
            node.dependencies = referencedCTEs;

            // Update dependents
            referencedCTEs.forEach(depName => {
                const depNode = nodes.get(depName);
                if (depNode && !depNode.dependents.includes(cteName)) {
                    depNode.dependents.push(cteName);
                }
            });
        });

        // Third pass: Calculate levels
        this.calculateLevels(nodes);

        // Identify root and leaf nodes
        const rootNodes: string[] = [];
        const leafNodes: string[] = [];

        nodes.forEach((node, name) => {
            if (node.dependencies.length === 0) {
                rootNodes.push(name);
            }
            if (node.dependents.length === 0) {
                leafNodes.push(name);
            }
        });

        return { nodes, rootNodes, leafNodes };
    }

    /**
     * Trace column search path through CTE dependencies
     */
    public traceColumnSearch(query: SelectQuery, columnName: string): {
        searchPath: string[];
        foundIn: string[];
        notFoundIn: string[];
        graph: CTEGraph;
    } {
        const graph = this.buildGraph(query);
        const searchPath: string[] = [];
        const foundIn: string[] = [];
        const notFoundIn: string[] = [];

        // Start from main query
        searchPath.push('MAIN_QUERY');

        let mainColumns: string[] = [];
        try {
            // SelectableColumnCollector only supports SimpleSelectQuery
            if (query instanceof SimpleSelectQuery) {
                const columnRefs = this.columnCollector.collect(query);
                mainColumns = columnRefs.map(col => col.name);
            } else if (query instanceof BinarySelectQuery) {
                // For UNION/INTERSECT/EXCEPT queries, collect from all branches
                const leftColumns = query.left instanceof SimpleSelectQuery
                    ? this.columnCollector.collect(query.left).map(col => col.name)
                    : [];
                const rightColumns = query.right instanceof SimpleSelectQuery
                    ? this.columnCollector.collect(query.right).map(col => col.name)
                    : [];

                // Combine and deduplicate columns from both branches
                const allColumns = [...leftColumns, ...rightColumns];
                mainColumns = [...new Set(allColumns)];
            }
        } catch (error) {
            if (!this.silent) {
                console.warn(`Failed to collect columns from main query: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (mainColumns.some(col => col.toLowerCase() === columnName.toLowerCase())) {
            foundIn.push('MAIN_QUERY');
        } else {
            notFoundIn.push('MAIN_QUERY');
        }

        // Search through CTEs in dependency order (leaf to root)
        const visited = new Set<string>();
        const searchOrder = this.getSearchOrder(graph);

        searchOrder.forEach(cteName => {
            if (visited.has(cteName)) return;
            visited.add(cteName);

            searchPath.push(cteName);
            const node = graph.nodes.get(cteName)!;

            if (node.columns.some(col => col.toLowerCase() === columnName.toLowerCase())) {
                foundIn.push(cteName);
            } else {
                notFoundIn.push(cteName);
            }
        });

        return { searchPath, foundIn, notFoundIn, graph };
    }

    /**
     * Print visual representation of CTE dependency graph
     */
    public printGraph(graph: CTEGraph): void {
        if (this.silent) return;

        console.log('\n=== CTE Dependency Graph ===');

        // Group by levels
        const levels = new Map<number, string[]>();
        graph.nodes.forEach((node, name) => {
            const level = node.level;
            if (!levels.has(level)) {
                levels.set(level, []);
            }
            levels.get(level)!.push(name);
        });

        // Print level by level
        const maxLevel = Math.max(...Array.from(levels.keys()));
        for (let level = 0; level <= maxLevel; level++) {
            const nodesAtLevel = levels.get(level) || [];
            if (nodesAtLevel.length > 0) {
                console.log(`\nLevel ${level}:`);
                nodesAtLevel.forEach(name => {
                    const node = graph.nodes.get(name)!;
                    console.log(`  ${name} (${node.columns.length} cols)`);
                    if (node.dependencies.length > 0) {
                        console.log(`    depends on: ${node.dependencies.join(', ')}`);
                    }
                });
            }
        }
    }

    /**
     * Print column search trace
     */
    public printColumnTrace(columnName: string, trace: ReturnType<typeof this.traceColumnSearch>): void {
        if (this.silent) return;

        console.log(`\n=== Column Search Trace for "${columnName}" ===`);
        console.log(`Search path: ${trace.searchPath.join(' → ')}`);
        console.log(`Found in: ${trace.foundIn.length > 0 ? trace.foundIn.join(', ') : 'NONE'}`);
        console.log(`Not found in: ${trace.notFoundIn.join(', ')}`);

        if (trace.foundIn.length > 0) {
            console.log('\n--- Details of CTEs containing the column ---');
            trace.foundIn.forEach(cteName => {
                if (cteName === 'MAIN_QUERY') return;
                const node = trace.graph.nodes.get(cteName);
                if (node) {
                    console.log(`${cteName}:`);
                    console.log(`  All columns: ${node.columns.join(', ')}`);
                    console.log(`  Dependencies: ${node.dependencies.length > 0 ? node.dependencies.join(', ') : 'none'}`);
                }
            });
        }
    }

    /**
     * Find CTEs that are actually referenced in the given query.
     * Uses TableSourceCollector to properly identify table references from the AST.
     */
    private findReferencedCTEs(query: CTEQuery, allCTEs: Map<string, CTENode>): string[] {
        // Use TableSourceCollector to get all table references from the query
        const tableCollector = new TableSourceCollector();
        const tableSources = tableCollector.collect(query);

        const referenced: string[] = [];

        // Check each table source to see if it matches a CTE name
        for (const source of tableSources) {
            const tableName = source.table.name;
            if (tableName && allCTEs.has(tableName)) {
                if (!referenced.includes(tableName)) {
                    referenced.push(tableName);
                }
            }
        }

        return referenced;
    }

    private extractReturningColumns(query: CTEQuery): string[] {
        // Writable CTEs expose columns via RETURNING, if present.
        if (query instanceof InsertQuery || query instanceof UpdateQuery || query instanceof DeleteQuery) {
            return this.extractColumnsFromItems(query.returningClause);
        }
        return [];
    }

    private extractColumnsFromItems(returningClause: ReturningClause | null): string[] {
        if (!returningClause) {
            return [];
        }

        const columns: string[] = [];
        for (const item of returningClause.items) {
            const name = item.identifier?.name ?? this.extractColumnName(item);
            if (name) {
                columns.push(name);
            }
        }
        return columns;
    }

    private extractColumnName(item: SelectItem): string | null {
        if (item.identifier) {
            return item.identifier.name;
        }
        if (item.value instanceof ColumnReference) {
            return item.value.column.name;
        }
        return null;
    }

    private isSelectQuery(query: CTEQuery): query is SelectQuery {
        return '__selectQueryType' in query && (query as SelectQuery).__selectQueryType === 'SelectQuery';
    }

    private calculateLevels(nodes: Map<string, CTENode>): void {
        const visited = new Set<string>();

        const calculateLevel = (nodeName: string): number => {
            if (visited.has(nodeName)) {
                return nodes.get(nodeName)!.level;
            }

            visited.add(nodeName);
            const node = nodes.get(nodeName)!;

            if (node.dependencies.length === 0) {
                node.level = 0;
                return 0;
            }

            let maxDepLevel = -1;
            node.dependencies.forEach(depName => {
                const depLevel = calculateLevel(depName);
                maxDepLevel = Math.max(maxDepLevel, depLevel);
            });

            node.level = maxDepLevel + 1;
            return node.level;
        };

        nodes.forEach((_, name) => calculateLevel(name));
    }

    private getSearchOrder(graph: CTEGraph): string[] {
        // Return CTEs in order from leaf to root (level descending)
        const ordered: string[] = [];

        const levels = new Map<number, string[]>();
        graph.nodes.forEach((node, name) => {
            const level = node.level;
            if (!levels.has(level)) {
                levels.set(level, []);
            }
            levels.get(level)!.push(name);
        });

        const maxLevel = Math.max(...Array.from(levels.keys()));
        for (let level = maxLevel; level >= 0; level--) {
            const nodesAtLevel = levels.get(level) || [];
            ordered.push(...nodesAtLevel);
        }

        return ordered;
    }
}
