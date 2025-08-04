import { CommonTable } from "../models/Clause";
import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import { CTECollector } from "./CTECollector";
import { TableSourceCollector } from "./TableSourceCollector";
import { CTETableReferenceCollector } from "./CTETableReferenceCollector";

/**
 * Node type for distinguishing between CTE and main query nodes
 */
export type NodeType = 'CTE' | 'ROOT';

/**
 * Interface representing a dependency relationship between nodes
 */
export interface CTEEdge {
    from: string;  // Source node name (CTE name or 'MAIN_QUERY')
    to: string;    // Target node name (CTE name or 'MAIN_QUERY')
}

/**
 * Interface representing a node in the dependency graph (either CTE or main query)
 */
export interface CTENode {
    name: string;
    type: NodeType;           // 'CTE' or 'ROOT'
    cte: CommonTable | null;  // null for ROOT nodes
    dependencies: string[];   // List of node names this node depends on
    dependents: string[];     // List of node names that depend on this node
}

/**
 * Interface representing the complete CTE dependency graph including main query
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
    
    private static readonly MAIN_QUERY_NAME = 'MAIN_QUERY' as const;

    private readonly sourceCollector: TableSourceCollector;
    private readonly cteReferenceCollector: CTETableReferenceCollector;
    private readonly cteCollector: CTECollector;
    private dependencyGraph: CTEDependencyGraph | null = null;
    private cteMap: Map<string, CommonTable> = new Map();

    constructor() {
        // For analyzing CTE-to-CTE dependencies within WITH clause
        // Excludes CTEs from results to avoid circular references
        this.sourceCollector = new TableSourceCollector(false);
        
        // For analyzing main query references to CTEs  
        // Includes CTEs in results to detect CTE usage
        this.cteReferenceCollector = new CTETableReferenceCollector();
        
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
        this.dependencyGraph = this.buildDependencyGraph(ctes, query);
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
     * Gets the list of CTEs that are directly referenced by the main query
     * @returns Array of CTE names referenced by the main query
     */
    public getMainQueryDependencies(): string[] {
        this.ensureAnalyzed();
        const mainQueryNode = this.findNodeByName(CTEDependencyAnalyzer.MAIN_QUERY_NAME);
        return mainQueryNode ? [...mainQueryNode.dependencies] : [];
    }

    /**
     * Gets nodes by type (CTE or ROOT)
     * @param nodeType The type of nodes to retrieve
     * @returns Array of nodes of the specified type
     */
    public getNodesByType(nodeType: NodeType): CTENode[] {
        this.ensureAnalyzed();
        return this.dependencyGraph!.nodes.filter(n => n.type === nodeType);
    }

    /**
     * Gets the main query node
     * @returns The main query node or undefined if not found
     */
    public getMainQueryNode(): CTENode | undefined {
        this.ensureAnalyzed();
        return this.findNodeByName(CTEDependencyAnalyzer.MAIN_QUERY_NAME);
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
     * Builds the dependency graph from the given CTEs and main query
     * @param ctes Array of CommonTable objects
     * @param mainQuery The main query that may reference CTEs
     * @returns The constructed dependency graph
     */
    private buildDependencyGraph(ctes: CommonTable[], mainQuery: SimpleSelectQuery): CTEDependencyGraph {
        const nodes: CTENode[] = [];
        const edges: CTEEdge[] = [];
        const dependencyMap = new Map<string, Set<string>>();
        const dependentMap = new Map<string, Set<string>>();

        // Initialize maps for all CTEs and main query
        for (const cte of ctes) {
            const name = CTEDependencyAnalyzer.getCTEName(cte);
            dependencyMap.set(name, new Set<string>());
            dependentMap.set(name, new Set<string>());
        }
        dependencyMap.set(CTEDependencyAnalyzer.MAIN_QUERY_NAME, new Set<string>());
        dependentMap.set(CTEDependencyAnalyzer.MAIN_QUERY_NAME, new Set<string>());

        // Analyze dependencies for each CTE
        for (const cte of ctes) {
            const cteName = CTEDependencyAnalyzer.getCTEName(cte);
            
            // Find all table/CTE references in this CTE's query
            // Uses sourceCollector which excludes CTEs to get only real table dependencies
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

        // Analyze main query references to CTEs (excluding WITH clause)
        const mainQueryWithoutCTE = this.getMainQueryWithoutCTE(mainQuery);
        if (mainQueryWithoutCTE) {
            // Uses cteReferenceCollector which includes CTEs to detect CTE usage in main query
            const mainQueryReferences = this.cteReferenceCollector.collect(mainQueryWithoutCTE);
            
            for (const referencedTable of mainQueryReferences) {
                const referencedName = referencedTable.table.name;
                
                // If main query references a CTE, create dependency edge
                if (this.cteMap.has(referencedName)) {
                    dependencyMap.get(CTEDependencyAnalyzer.MAIN_QUERY_NAME)!.add(referencedName);
                    dependentMap.get(referencedName)!.add(CTEDependencyAnalyzer.MAIN_QUERY_NAME);
                    
                    edges.push({
                        from: CTEDependencyAnalyzer.MAIN_QUERY_NAME,
                        to: referencedName
                    });
                }
            }
        }

        // Create CTE nodes
        for (const cte of ctes) {
            const name = CTEDependencyAnalyzer.getCTEName(cte);
            nodes.push({
                name,
                type: 'CTE',
                cte,
                dependencies: Array.from(dependencyMap.get(name) || new Set()),
                dependents: Array.from(dependentMap.get(name) || new Set())
            });
        }

        // Create main query node
        nodes.push({
            name: CTEDependencyAnalyzer.MAIN_QUERY_NAME,
            type: 'ROOT',
            cte: null,
            dependencies: Array.from(dependencyMap.get(CTEDependencyAnalyzer.MAIN_QUERY_NAME) || new Set()),
            dependents: Array.from(dependentMap.get(CTEDependencyAnalyzer.MAIN_QUERY_NAME) || new Set())
        });

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
     * Gets the main query without the WITH clause for analyzing main query dependencies
     * @param query The complete query with WITH clause
     * @returns A query without WITH clause, or null if no main query exists
     */
    private getMainQueryWithoutCTE(query: SimpleSelectQuery): SimpleSelectQuery | null {
        if (!query.withClause) {
            // No WITH clause, return the query as-is
            return query;
        }

        // Create a copy of the query without the WITH clause
        const mainQueryCopy = new SimpleSelectQuery({
            selectClause: query.selectClause,
            fromClause: query.fromClause,
            whereClause: query.whereClause,
            groupByClause: query.groupByClause,
            havingClause: query.havingClause,
            orderByClause: query.orderByClause,
            limitClause: query.limitClause,
            offsetClause: query.offsetClause,
            fetchClause: query.fetchClause,
            forClause: query.forClause,
            windowClause: query.windowClause,
            // Intentionally skip withClause (defaults to null)
        });
        
        return mainQueryCopy;
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