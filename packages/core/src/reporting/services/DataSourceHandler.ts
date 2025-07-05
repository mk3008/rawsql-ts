import { TableSource, SubQuerySource } from '../../models/Clause';
import { SourceExpression } from '../../models/Clause';
import { DataFlowGraph } from '../models/DataFlowGraph';
import { DataSourceNode } from '../models/DataFlowNode';

/**
 * Handles the processing of data sources (tables, CTEs, subqueries)
 */
export class DataSourceHandler {
    constructor(private graph: DataFlowGraph) {}

    /**
     * Processes a source expression and returns the node ID
     */
    processSource(
        sourceExpr: SourceExpression,
        cteNames: Set<string>,
        queryProcessor: (query: any, context: string, cteNames: Set<string>) => string
    ): string {
        if (sourceExpr.datasource instanceof TableSource) {
            return this.processTableSource(sourceExpr.datasource, cteNames);
        } else if (sourceExpr.datasource instanceof SubQuerySource) {
            return this.processSubquerySource(sourceExpr, cteNames, queryProcessor);
        }
        
        throw new Error('Unsupported source type');
    }

    /**
     * Processes a table source (including CTE references)
     */
    private processTableSource(tableSource: TableSource, cteNames: Set<string>): string {
        const tableName = tableSource.getSourceName();
        
        if (cteNames.has(tableName)) {
            // Reference to existing CTE
            const cteNode = this.graph.getOrCreateCTE(tableName);
            return cteNode.id;
        } else {
            // Regular table
            const tableNode = this.graph.getOrCreateTable(tableName);
            return tableNode.id;
        }
    }

    /**
     * Processes a subquery source
     */
    private processSubquerySource(
        sourceExpr: SourceExpression,
        cteNames: Set<string>,
        queryProcessor: (query: any, context: string, cteNames: Set<string>) => string
    ): string {
        const alias = sourceExpr.aliasExpression?.table.name || 'subquery';
        
        // Create virtual data source node for named subquery
        const subqueryNode = this.graph.getOrCreateSubquery(alias);
        
        // Process subquery content and connect its result to the subquery virtual data source
        const subqueryResultId = queryProcessor(
            (sourceExpr.datasource as SubQuerySource).query,
            `subquery_${alias}_internal`,
            cteNames
        );

        // Connect subquery result to subquery virtual data source
        if (subqueryResultId && !this.graph.hasConnection(subqueryResultId, subqueryNode.id)) {
            this.graph.addConnection(subqueryResultId, subqueryNode.id);
        }

        return subqueryNode.id;
    }

    /**
     * Extracts table node IDs from a FROM clause for WHERE subqueries
     */
    extractTableNodeIds(fromClause: any, cteNames: Set<string>): string[] {
        const tableNodeIds: string[] = [];
        const sourceExpr = fromClause.source;

        // Process main source
        if (sourceExpr.datasource instanceof TableSource) {
            const tableName = sourceExpr.datasource.getSourceName();
            
            if (cteNames.has(tableName)) {
                const cteNode = this.graph.getOrCreateCTE(tableName);
                tableNodeIds.push(cteNode.id);
            } else {
                const tableNode = this.graph.getOrCreateTable(tableName);
                tableNodeIds.push(tableNode.id);
            }
        }

        // Process JOINs
        if (fromClause.joins && fromClause.joins.length > 0) {
            for (const join of fromClause.joins) {
                const joinSourceExpr = join.source;
                if (joinSourceExpr.datasource instanceof TableSource) {
                    const tableName = joinSourceExpr.datasource.getSourceName();
                    
                    if (cteNames.has(tableName)) {
                        const cteNode = this.graph.getOrCreateCTE(tableName);
                        tableNodeIds.push(cteNode.id);
                    } else {
                        const tableNode = this.graph.getOrCreateTable(tableName);
                        tableNodeIds.push(tableNode.id);
                    }
                }
            }
        }

        return tableNodeIds;
    }
}