import { WithClause } from '../../models/Clause';
import { DataFlowGraph } from '../models/DataFlowGraph';
import { DataSourceNode } from '../models/DataFlowNode';

/**
 * Handles the processing of Common Table Expressions (CTEs)
 */
export class CTEHandler {
    constructor(private graph: DataFlowGraph) {}

    /**
     * Processes all CTEs in a WITH clause
     */
    processCTEs(
        withClause: WithClause,
        cteNames: Set<string>,
        queryProcessor: (query: any, context: string, cteNames: Set<string>) => string
    ): void {
        // First pass: Create all CTE nodes and add names to tracking set
        for (let i = 0; i < withClause.tables.length; i++) {
            const cte = withClause.tables[i];
            const cteName = cte.getSourceAliasName();
            
            // Create virtual data source node for CTE
            const cteNode = this.graph.getOrCreateCTE(cteName);
            
            // Track CTE name (this allows recursive references)
            cteNames.add(cteName);
            
            // Check if this is a recursive CTE
            // In WITH RECURSIVE, only the first CTE is recursive
            const isRecursive = withClause.recursive && i === 0;
            if (isRecursive) {
                // Add recursive annotation to the CTE node
                cteNode.addAnnotation('recursive');
            }
        }
        
        // Second pass: Process CTE queries now that all names are available
        for (let i = 0; i < withClause.tables.length; i++) {
            const cte = withClause.tables[i];
            const cteName = cte.getSourceAliasName();
            const cteNode = this.graph.getOrCreateCTE(cteName);
            
            // Process CTE query and connect its result to the CTE virtual data source
            const cteResultId = queryProcessor(cte.query, `cte_${cteName}`, cteNames);
            
            // Connect CTE query result to CTE virtual data source
            if (cteResultId && !this.graph.hasConnection(cteResultId, cteNode.id)) {
                // Add RECURSIVE label for first CTE in WITH RECURSIVE clause
                const isRecursive = withClause.recursive && i === 0;
                const label = isRecursive ? 'RECURSIVE' : undefined;
                this.graph.addConnection(cteResultId, cteNode.id, label);
            }
        }
    }
    
    /**
     * Detects if a query contains recursive references to a CTE
     */
    private detectRecursiveReference(query: any, cteName: string): boolean {
        // Simple heuristic: check if the query string contains the CTE name
        // In a real implementation, you'd parse the query structure
        const queryStr = query.toString().toLowerCase();
        return queryStr.includes(cteName.toLowerCase());
    }
}