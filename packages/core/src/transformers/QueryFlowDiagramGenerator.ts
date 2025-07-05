import { SelectQuery } from '../models/SelectQuery';
import { SelectQueryParser } from '../parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { BinarySelectQuery } from '../models/BinarySelectQuery';
import { DataFlowGraph } from '../reporting/models/DataFlowGraph';
import { DataSourceHandler } from '../reporting/services/DataSourceHandler';
import { JoinHandler } from '../reporting/services/JoinHandler';
import { ProcessHandler } from '../reporting/services/ProcessHandler';
import { CTEHandler } from '../reporting/services/CTEHandler';
// Base interface for Mermaid diagram options
export interface BaseMermaidOptions {
    /** Diagram title */
    title?: string;
}

export interface FlowDiagramOptions extends BaseMermaidOptions {
    /** Show detailed information (columns, conditions) */
    showDetails?: boolean;
    /** Include CTE dependencies */
    showCTEDependencies?: boolean;
    /** Direction of flow (top-down, left-right) */
    direction?: 'TD' | 'LR' | 'TB' | 'RL';
}

/**
 * QueryFlowDiagramGenerator using model-based architecture
 * Generates Mermaid diagrams from SQL queries following consistent principles
 */
export class QueryFlowDiagramGenerator {
    private graph: DataFlowGraph;
    private dataSourceHandler: DataSourceHandler;
    private joinHandler: JoinHandler;
    private processHandler: ProcessHandler;
    private cteHandler: CTEHandler;

    constructor() {
        this.graph = new DataFlowGraph();
        this.dataSourceHandler = new DataSourceHandler(this.graph);
        this.joinHandler = new JoinHandler(this.graph, this.dataSourceHandler);
        this.processHandler = new ProcessHandler(this.graph, this.dataSourceHandler);
        this.cteHandler = new CTEHandler(this.graph);
    }

    generateMermaidFlow(query: SelectQuery | string, options?: FlowDiagramOptions): string {
        // Reset state for new diagram generation
        this.graph = new DataFlowGraph();
        this.dataSourceHandler = new DataSourceHandler(this.graph);
        this.joinHandler = new JoinHandler(this.graph, this.dataSourceHandler);
        this.processHandler = new ProcessHandler(this.graph, this.dataSourceHandler);
        this.cteHandler = new CTEHandler(this.graph);
        this.joinHandler.resetJoinCounter();

        // Parse SQL if string
        const parsedQuery = typeof query === 'string'
            ? SelectQueryParser.parse(query)
            : query;

        // Process the query
        const cteNames = new Set<string>();
        this.processQuery(parsedQuery, 'main', cteNames);

        // Generate Mermaid output
        return this.graph.generateMermaid(
            options?.direction || 'TD',
            options?.title
        );
    }

    static generate(sql: string): string {
        const generator = new QueryFlowDiagramGenerator();
        return generator.generateMermaidFlow(sql);
    }

    private processQuery(
        query: SelectQuery,
        context: string,
        cteNames: Set<string>
    ): string {
        if (query instanceof SimpleSelectQuery) {
            return this.processSimpleQuery(query, context, cteNames);
        } else if (query instanceof BinarySelectQuery) {
            return this.processBinaryQuery(query, context, cteNames);
        }

        throw new Error('Unsupported query type');
    }

    private processSimpleQuery(
        query: SimpleSelectQuery,
        context: string,
        cteNames: Set<string>
    ): string {
        // Process CTEs first
        if (query.withClause) {
            this.cteHandler.processCTEs(query.withClause, cteNames, this.processQuery.bind(this));
        }

        let currentNodeId = '';

        // 1. Process FROM clause (including JOINs)
        if (query.fromClause) {
            currentNodeId = this.joinHandler.processFromClause(
                query.fromClause,
                cteNames,
                this.processQuery.bind(this)
            );
        }

        // 2-7. Process other clauses in execution order
        if (currentNodeId) {
            currentNodeId = this.processHandler.processQueryClauses(
                query,
                context,
                currentNodeId,
                cteNames,
                this.processQuery.bind(this)
            );
        }

        // Handle output node creation based on context
        return this.handleOutputNode(currentNodeId, context);
    }

    private processBinaryQuery(
        query: BinarySelectQuery,
        context: string,
        cteNames: Set<string>
    ): string {
        // Check if this is a chain of the same operation
        const parts = this.flattenBinaryChain(query, query.operator.value);

        if (parts.length > 2) {
            return this.processMultiPartOperation(parts, query.operator.value, context, cteNames);
        } else {
            return this.processSimpleBinaryOperation(query, context, cteNames);
        }
    }

    private processSimpleBinaryOperation(
        query: BinarySelectQuery,
        context: string,
        cteNames: Set<string>
    ): string {
        const leftNodeId = this.processQuery(query.left, `${context}_left`, cteNames);
        const rightNodeId = this.processQuery(query.right, `${context}_right`, cteNames);

        // Create operation node with unique ID based on context
        const operationId = context === 'main' ? 'main' : context.replace(/^cte_/, '');
        const operationNode = this.graph.createSetOperationNode(operationId, query.operator.value);

        // Connect left and right to operation
        if (leftNodeId && !this.graph.hasConnection(leftNodeId, operationNode.id)) {
            this.graph.addConnection(leftNodeId, operationNode.id);
        }
        if (rightNodeId && !this.graph.hasConnection(rightNodeId, operationNode.id)) {
            this.graph.addConnection(rightNodeId, operationNode.id);
        }

        return operationNode.id;
    }

    private processMultiPartOperation(
        parts: SelectQuery[],
        operator: string,
        context: string,
        cteNames: Set<string>
    ): string {
        const partNodes: string[] = [];
        // Use context to create unique operation ID
        const operationId = context === 'main' ? 'main' : context.replace(/^cte_/, '');
        const operationNode = this.graph.createSetOperationNode(operationId, operator);

        // Process each part with numbered naming
        for (let i = 0; i < parts.length; i++) {
            const partContext = `${context}_part${i + 1}`;
            const partNodeId = this.processQuery(parts[i], partContext, cteNames);
            partNodes.push(partNodeId);
        }

        // Connect all parts to operation
        for (const partNodeId of partNodes) {
            if (partNodeId && !this.graph.hasConnection(partNodeId, operationNode.id)) {
                this.graph.addConnection(partNodeId, operationNode.id);
            }
        }

        return operationNode.id;
    }

    private handleOutputNode(currentNodeId: string, context: string): string {
        // Simple principle: Only create output node for main query
        // All other contexts return their processing result directly
        if (context === 'main') {
            const outputNode = this.graph.createOutputNode(context);
            if (currentNodeId) {
                this.graph.addConnection(currentNodeId, outputNode.id);
            }
            return outputNode.id;
        }
        
        return currentNodeId;
    }

    /**
     * Flattens a binary operation chain into individual parts
     */
    private flattenBinaryChain(query: BinarySelectQuery, operator: string): SelectQuery[] {
        const parts: SelectQuery[] = [];

        const collectParts = (q: SelectQuery) => {
            if (q instanceof BinarySelectQuery && q.operator.value === operator) {
                collectParts(q.left);
                collectParts(q.right);
            } else {
                parts.push(q);
            }
        };

        collectParts(query);
        return parts;
    }
}