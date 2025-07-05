import { FromClause, JoinClause } from '../../models/Clause';
import { DataFlowGraph } from '../models/DataFlowGraph';
import { OperationNode } from '../models/DataFlowNode';
import { DataSourceHandler } from './DataSourceHandler';

/**
 * Handles the processing of JOIN operations
 */
export class JoinHandler {
    private joinIdCounter = 0;

    constructor(
        private graph: DataFlowGraph,
        private dataSourceHandler: DataSourceHandler
    ) {}

    /**
     * Resets the join ID counter for deterministic IDs
     */
    resetJoinCounter(): void {
        this.joinIdCounter = 0;
    }

    /**
     * Gets the next join ID
     */
    private getNextJoinId(): string {
        return String(++this.joinIdCounter);
    }

    /**
     * Processes a FROM clause with JOINs and returns the final node ID
     */
    processFromClause(
        fromClause: FromClause,
        cteNames: Set<string>,
        queryProcessor: (query: any, context: string, cteNames: Set<string>) => string
    ): string {
        // Process main source
        const mainSourceId = this.dataSourceHandler.processSource(
            fromClause.source,
            cteNames,
            queryProcessor
        );

        // Process JOINs if they exist
        if (fromClause.joins && fromClause.joins.length > 0) {
            return this.processJoins(fromClause.joins, mainSourceId, cteNames, queryProcessor);
        }

        return mainSourceId;
    }

    /**
     * Processes a series of JOINs sequentially
     */
    private processJoins(
        joins: JoinClause[],
        currentNodeId: string,
        cteNames: Set<string>,
        queryProcessor: (query: any, context: string, cteNames: Set<string>) => string
    ): string {
        let resultNodeId = currentNodeId;

        for (const join of joins) {
            const joinNodeId = this.dataSourceHandler.processSource(
                join.source,
                cteNames,
                queryProcessor
            );

            // Create join operation node
            const joinOpId = this.getNextJoinId();
            const joinNode = this.graph.createJoinNode(joinOpId, join.joinType.value);

            // Get nullability labels for the JOIN
            const { leftLabel, rightLabel } = this.getJoinNullabilityLabels(join.joinType.value);

            // Connect current source and join source to join operation with nullability labels
            if (resultNodeId && !this.graph.hasConnection(resultNodeId, joinNode.id)) {
                this.graph.addConnection(resultNodeId, joinNode.id, leftLabel);
            }
            if (joinNodeId && !this.graph.hasConnection(joinNodeId, joinNode.id)) {
                this.graph.addConnection(joinNodeId, joinNode.id, rightLabel);
            }

            resultNodeId = joinNode.id;
        }

        return resultNodeId;
    }

    /**
     * Gets nullability labels for JOIN edges based on JOIN type
     */
    private getJoinNullabilityLabels(joinType: string): { leftLabel: string, rightLabel: string } {
        switch (joinType.toLowerCase()) {
            case 'left join':
                return { leftLabel: 'NOT NULL', rightLabel: 'NULLABLE' };
            case 'right join':
                return { leftLabel: 'NULLABLE', rightLabel: 'NOT NULL' };
            case 'inner join':
            case 'join':
                return { leftLabel: 'NOT NULL', rightLabel: 'NOT NULL' };
            case 'full join':
            case 'full outer join':
                return { leftLabel: 'NULLABLE', rightLabel: 'NULLABLE' };
            case 'cross join':
                return { leftLabel: 'NOT NULL', rightLabel: 'NOT NULL' };
            default:
                // Default to no nullability info for unknown join types
                return { leftLabel: '', rightLabel: '' };
        }
    }
}