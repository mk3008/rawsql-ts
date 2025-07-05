/**
 * Represents a node in the SQL data flow diagram
 */
export interface DataFlowNode {
    id: string;
    label: string;
    type: NodeType;
    shape: NodeShape;
    details?: string[];
}

export type NodeType = 'table' | 'cte' | 'subquery' | 'process' | 'operation' | 'output';

export type NodeShape = 'cylinder' | 'hexagon' | 'diamond' | 'rounded' | 'rectangle' | 'circle';

/**
 * Base class for all data flow nodes
 */
export abstract class BaseDataFlowNode implements DataFlowNode {
    constructor(
        public id: string,
        public label: string,
        public type: NodeType,
        public shape: NodeShape,
        public details?: string[]
    ) {}

    abstract getMermaidRepresentation(): string;
}

/**
 * Represents a data source (table, CTE, subquery)
 */
export class DataSourceNode extends BaseDataFlowNode {
    constructor(id: string, label: string, type: 'table' | 'cte' | 'subquery') {
        super(id, label, type, 'cylinder');
    }

    getMermaidRepresentation(): string {
        return `${this.id}[(${this.label})]`;
    }

    static createTable(tableName: string): DataSourceNode {
        return new DataSourceNode(`table_${tableName}`, tableName, 'table');
    }

    static createCTE(cteName: string): DataSourceNode {
        return new DataSourceNode(`cte_${cteName}`, `CTE:${cteName}`, 'cte');
    }

    static createSubquery(alias: string): DataSourceNode {
        return new DataSourceNode(`subquery_${alias}`, `QUERY:${alias}`, 'subquery');
    }
}

/**
 * Represents a processing operation (WHERE, GROUP BY, SELECT, etc.)
 */
export class ProcessNode extends BaseDataFlowNode {
    constructor(id: string, operation: string, context: string = '') {
        const nodeId = context ? `${context}_${operation.toLowerCase().replace(/\s+/g, '_')}` : operation.toLowerCase().replace(/\s+/g, '_');
        super(nodeId, operation, 'process', 'hexagon');
    }

    getMermaidRepresentation(): string {
        return `${this.id}{{${this.label}}}`;
    }

    static createWhere(context: string): ProcessNode {
        return new ProcessNode(`${context}_where`, 'WHERE', context);
    }

    static createGroupBy(context: string): ProcessNode {
        return new ProcessNode(`${context}_group_by`, 'GROUP BY', context);
    }

    static createHaving(context: string): ProcessNode {
        return new ProcessNode(`${context}_having`, 'HAVING', context);
    }

    static createSelect(context: string): ProcessNode {
        return new ProcessNode(`${context}_select`, 'SELECT', context);
    }

    static createOrderBy(context: string): ProcessNode {
        return new ProcessNode(`${context}_order_by`, 'ORDER BY', context);
    }

    static createLimit(context: string, hasOffset: boolean = false): ProcessNode {
        const label = hasOffset ? 'LIMIT/OFFSET' : 'LIMIT';
        return new ProcessNode(`${context}_limit`, label, context);
    }
}

/**
 * Represents an operation (JOIN, UNION, etc.)
 */
export class OperationNode extends BaseDataFlowNode {
    constructor(id: string, operation: string) {
        super(id, operation, 'operation', 'diamond');
    }

    getMermaidRepresentation(): string {
        return `${this.id}{${this.label}}`;
    }

    static createJoin(joinId: string, joinType: string): OperationNode {
        let label: string;
        const normalizedType = joinType.trim().toLowerCase();
        
        if (normalizedType === 'join') {
            label = 'INNER JOIN';
        } else if (normalizedType.endsWith(' join')) {
            label = normalizedType.toUpperCase();
        } else {
            label = normalizedType.toUpperCase() + ' JOIN';
        }
        
        return new OperationNode(`join_${joinId}`, label);
    }

    static createUnion(unionId: string, unionType: string = 'UNION ALL'): OperationNode {
        return new OperationNode(`${unionType.toLowerCase().replace(/\s+/g, '_')}_${unionId}`, unionType.toUpperCase());
    }

    static createSetOperation(operationId: string, operation: string): OperationNode {
        const normalizedOp = operation.toUpperCase();
        const id = `${normalizedOp.toLowerCase().replace(/\s+/g, '_')}_${operationId}`;
        return new OperationNode(id, normalizedOp);
    }
}

/**
 * Represents the final output
 */
export class OutputNode extends BaseDataFlowNode {
    constructor(context: string = 'main') {
        const label = context === 'main' ? 'Final Result' : `${context} Result`;
        super(`${context}_output`, label, 'output', 'rounded');
    }

    getMermaidRepresentation(): string {
        return `${this.id}(${this.label})`;
    }
}