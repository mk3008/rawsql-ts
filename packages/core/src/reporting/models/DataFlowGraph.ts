import { BaseDataFlowNode, DataSourceNode, ProcessNode, OperationNode, OutputNode } from './DataFlowNode';
import { DataFlowConnection, DataFlowEdgeCollection } from './DataFlowEdge';

/**
 * Represents the complete data flow graph for a SQL query
 */
export class DataFlowGraph {
    private nodes = new Map<string, BaseDataFlowNode>();
    private edges = new DataFlowEdgeCollection();

    addNode(node: BaseDataFlowNode): void {
        this.nodes.set(node.id, node);
    }

    addEdge(edge: DataFlowConnection): void {
        this.edges.add(edge);
    }

    addConnection(from: string, to: string, label?: string): void {
        this.edges.addConnection(from, to, label);
    }

    hasNode(nodeId: string): boolean {
        return this.nodes.has(nodeId);
    }

    hasConnection(from: string, to: string): boolean {
        return this.edges.hasConnection(from, to);
    }

    getNode(nodeId: string): BaseDataFlowNode | undefined {
        return this.nodes.get(nodeId);
    }

    getAllNodes(): BaseDataFlowNode[] {
        return Array.from(this.nodes.values());
    }

    getAllEdges(): DataFlowConnection[] {
        return this.edges.getAll();
    }

    /**
     * Generates the complete Mermaid flowchart syntax
     */
    generateMermaid(direction: string = 'TD', title?: string): string {
        let mermaid = `flowchart ${direction}\n`;

        // Add title if provided
        if (title) {
            mermaid += `    %% ${title}\n`;
        }

        // Add nodes
        const nodeLines = Array.from(this.nodes.values())
            .map(node => `    ${node.getMermaidRepresentation()}`)
            .join('\n');
        
        if (nodeLines) {
            mermaid += nodeLines + '\n';
        }

        // Add blank line between nodes and edges if both exist
        if (this.nodes.size > 0 && this.edges.getAll().length > 0) {
            mermaid += '\n';
        }

        // Add edges
        const edgeRepresentation = this.edges.getMermaidRepresentation();
        if (edgeRepresentation) {
            mermaid += `    ${edgeRepresentation}\n`;
        }

        return mermaid;
    }

    /**
     * Creates or gets a table node
     */
    getOrCreateTable(tableName: string): DataSourceNode {
        const nodeId = `table_${tableName}`;
        let node = this.nodes.get(nodeId) as DataSourceNode;
        
        if (!node) {
            node = DataSourceNode.createTable(tableName);
            this.addNode(node);
        }
        
        return node;
    }

    /**
     * Creates or gets a CTE node
     */
    getOrCreateCTE(cteName: string): DataSourceNode {
        const nodeId = `cte_${cteName}`;
        let node = this.nodes.get(nodeId) as DataSourceNode;
        
        if (!node) {
            node = DataSourceNode.createCTE(cteName);
            this.addNode(node);
        }
        
        return node;
    }

    /**
     * Creates or gets a subquery node
     */
    getOrCreateSubquery(alias: string): DataSourceNode {
        const nodeId = `subquery_${alias}`;
        let node = this.nodes.get(nodeId) as DataSourceNode;
        
        if (!node) {
            node = DataSourceNode.createSubquery(alias);
            this.addNode(node);
        }
        
        return node;
    }

    /**
     * Creates a process node
     */
    createProcessNode(type: string, context: string): ProcessNode {
        let node: ProcessNode;
        
        switch (type.toLowerCase()) {
            case 'where':
                node = ProcessNode.createWhere(context);
                break;
            case 'group by':
                node = ProcessNode.createGroupBy(context);
                break;
            case 'having':
                node = ProcessNode.createHaving(context);
                break;
            case 'select':
                node = ProcessNode.createSelect(context);
                break;
            case 'order by':
                node = ProcessNode.createOrderBy(context);
                break;
            case 'limit':
                node = ProcessNode.createLimit(context, false);
                break;
            case 'limit/offset':
                node = ProcessNode.createLimit(context, true);
                break;
            default:
                node = new ProcessNode(context, type);
        }
        
        this.addNode(node);
        return node;
    }

    /**
     * Creates a JOIN operation node
     */
    createJoinNode(joinId: string, joinType: string): OperationNode {
        const node = OperationNode.createJoin(joinId, joinType);
        this.addNode(node);
        return node;
    }

    /**
     * Creates a set operation node (UNION, EXCEPT, etc.)
     */
    createSetOperationNode(operationId: string, operation: string): OperationNode {
        const node = OperationNode.createSetOperation(operationId, operation);
        this.addNode(node);
        return node;
    }

    /**
     * Creates an output node
     */
    createOutputNode(context: string = 'main'): OutputNode {
        const node = new OutputNode(context);
        this.addNode(node);
        return node;
    }
}