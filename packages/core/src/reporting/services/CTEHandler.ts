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
        for (const cte of withClause.tables) {
            const cteName = cte.getSourceAliasName();
            
            // Create virtual data source node for CTE
            const cteNode = this.graph.getOrCreateCTE(cteName);
            
            // Track CTE name
            cteNames.add(cteName);
            
            // Process CTE query and connect its result to the CTE virtual data source
            const cteResultId = queryProcessor(cte.query, `cte_${cteName}`, cteNames);
            
            // Connect CTE query result to CTE virtual data source
            if (cteResultId && !this.graph.hasConnection(cteResultId, cteNode.id)) {
                this.graph.addConnection(cteResultId, cteNode.id);
            }
        }
    }
}