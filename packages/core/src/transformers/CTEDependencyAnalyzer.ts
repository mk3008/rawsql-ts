import { CommonTable } from "../models/Clause";
import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import { CTECollector } from "./CTECollector";
import { TableSourceCollector } from "./TableSourceCollector";

/**
 * Interface representing a dependency relationship between CTEs
 */
export interface CTEEdge {
    from: string;  // Source CTE name
    to: string;    // Target CTE name
}

/**
 * Interface representing a CTE node in the dependency graph
 */
export interface CTENode {
    name: string;
    cte: CommonTable;
    dependencies: string[];    // List of CTE names this CTE depends on
    dependents: string[];      // List of CTE names that depend on this CTE
}

/**
 * Interface representing the complete CTE dependency graph
 */
export interface CTEDependencyGraph {
    nodes: CTENode[];
    edges: CTEEdge[];
}

/**
 * Analyzer for CTE dependencies in SQL queries.
 * Provides functionality to analyze dependencies, detect circular references,
 * and generate topological ordering of CTEs.
 */
export class CTEDependencyAnalyzer {
    private static readonly ERROR_MESSAGES = {
        NOT_ANALYZED: "Must call analyzeDependencies first",
        CIRCULAR_REFERENCE: "Circular reference detected in CTE"
    } as const;

    private readonly sourceCollector: TableSourceCollector;
    private readonly cteCollector: CTECollector;
    private dependencyGraph: CTEDependencyGraph | null = null;
    private cteMap: Map<string, CommonTable> = new Map();

    constructor() {
        this.sourceCollector = new TableSourceCollector(true);
        this.cteCollector = new CTECollector();
    }

    /**
     * Analyzes the dependencies between CTEs in the given query
     * @param query The query to analyze
     * @returns The dependency graph
     */
    public analyzeDependencies(query: SimpleSelectQuery): CTEDependencyGraph {
        const ctes = this.cteCollector.collect(query);
        this.buildCTEMap(ctes);
        this.dependencyGraph = this.buildDependencyGraph(ctes);
        return this.dependencyGraph;
    }

    /**
     * Gets the list of CTEs that the specified CTE depends on
     * @param cteName The name of the CTE
     * @returns Array of CTE names this CTE depends on
     */
    public getDependencies(cteName: string): string[] {
        this.ensureAnalyzed();
        const node = this.findNodeByName(cteName);
        return node ? [...node.dependencies] : [];
    }

    /**
     * Gets the list of CTEs that depend on the specified CTE
     * @param cteName The name of the CTE
     * @returns Array of CTE names that depend on this CTE
     */
    public getDependents(cteName: string): string[] {
        this.ensureAnalyzed();
        const node = this.findNodeByName(cteName);
        return node ? [...node.dependents] : [];
    }

    /**
     * Checks if there are any circular dependencies in the CTE graph
     * @returns true if circular dependencies exist, false otherwise
     */
    public hasCircularDependency(): boolean {
        this.ensureAnalyzed();
        try {
            this.getExecutionOrder();
            return false;
        } catch (error) {
            if (error instanceof Error && error.message.includes(CTEDependencyAnalyzer.ERROR_MESSAGES.CIRCULAR_REFERENCE)) {
                return true;
            }
            throw error;
        }
    }

    /**
     * Gets the topological sort order for CTE execution
     * @returns Array of CTE names in execution order
     * @throws Error if circular dependencies are detected
     */
    public getExecutionOrder(): string[] {
        this.ensureAnalyzed();

        const visited = new Set<string>();
        const visiting = new Set<string>();
        const result: string[] = [];

        // Build adjacency list from dependency graph
        const dependencyMap = new Map<string, Set<string>>();
        for (const node of this.dependencyGraph!.nodes) {
            dependencyMap.set(node.name, new Set(node.dependencies));
        }

        const visit = (nodeName: string) => {
            if (visited.has(nodeName)) return;
            if (visiting.has(nodeName)) {
                throw new Error(`${CTEDependencyAnalyzer.ERROR_MESSAGES.CIRCULAR_REFERENCE}: ${nodeName}`);
            }

            visiting.add(nodeName);

            const deps = dependencyMap.get(nodeName) || new Set<string>();
            for (const dep of deps) {
                visit(dep);
            }

            visiting.delete(nodeName);
            visited.add(nodeName);
            result.push(nodeName);
        };

        // Visit all nodes
        for (const node of this.dependencyGraph!.nodes) {
            if (!visited.has(node.name)) {
                visit(node.name);
            }
        }

        return result;
    }

    /**
     * Builds the dependency graph from the given CTEs
     * @param ctes Array of CommonTable objects
     * @returns The constructed dependency graph
     */
    private buildDependencyGraph(ctes: CommonTable[]): CTEDependencyGraph {
        const nodes: CTENode[] = [];
        const edges: CTEEdge[] = [];
        const dependencyMap = new Map<string, Set<string>>();
        const dependentMap = new Map<string, Set<string>>();

        // Initialize maps for all CTEs
        for (const cte of ctes) {
            const name = CTEDependencyAnalyzer.getCTEName(cte);
            dependencyMap.set(name, new Set<string>());
            dependentMap.set(name, new Set<string>());
        }

        // Analyze dependencies for each CTE
        for (const cte of ctes) {
            const cteName = CTEDependencyAnalyzer.getCTEName(cte);
            
            // Find all table/CTE references in this CTE's query
            const referencedTables = this.sourceCollector.collect(cte.query);
            
            for (const referencedTable of referencedTables) {
                const referencedName = referencedTable.table.name;
                
                // Only consider references to other CTEs in our collection
                if (this.cteMap.has(referencedName) && referencedName !== cteName) {
                    dependencyMap.get(cteName)!.add(referencedName);
                    dependentMap.get(referencedName)!.add(cteName);
                    
                    edges.push({
                        from: cteName,
                        to: referencedName
                    });
                }
            }
        }

        // Create nodes with dependency and dependent information
        for (const cte of ctes) {
            const name = CTEDependencyAnalyzer.getCTEName(cte);
            nodes.push({
                name,
                cte,
                dependencies: Array.from(dependencyMap.get(name) || new Set()),
                dependents: Array.from(dependentMap.get(name) || new Set())
            });
        }

        return { nodes, edges };
    }

    /**
     * Ensures that dependency analysis has been performed
     * @throws Error if analyzeDependencies has not been called
     */
    private ensureAnalyzed(): void {
        if (!this.dependencyGraph) {
            throw new Error(CTEDependencyAnalyzer.ERROR_MESSAGES.NOT_ANALYZED);
        }
    }

    /**
     * Builds the CTE name-to-object mapping for quick lookups
     * @param ctes Array of CommonTable objects
     */
    private buildCTEMap(ctes: CommonTable[]): void {
        this.cteMap.clear();
        for (const cte of ctes) {
            const name = CTEDependencyAnalyzer.getCTEName(cte);
            this.cteMap.set(name, cte);
        }
    }

    /**
     * Finds a node in the dependency graph by CTE name
     * @param cteName The name of the CTE to find
     * @returns The CTENode if found, undefined otherwise
     */
    private findNodeByName(cteName: string): CTENode | undefined {
        return this.dependencyGraph?.nodes.find(n => n.name === cteName);
    }

    /**
     * Extracts the name from a CommonTable
     * @param cte The CommonTable object
     * @returns The name of the CTE
     */
    private static getCTEName(cte: CommonTable): string {
        return cte.aliasExpression.table.name;
    }
}