/**
 * Represents an edge (connection) in the SQL data flow diagram
 */
export interface DataFlowEdge {
    from: string;
    to: string;
    label?: string;
}

/**
 * Represents a connection between nodes in the data flow
 */
export class DataFlowConnection implements DataFlowEdge {
    constructor(
        public from: string,
        public to: string,
        public label?: string
    ) {}

    getMermaidRepresentation(): string {
        const arrow = this.label ? ` -->|${this.label}| ` : ' --> ';
        return `${this.from}${arrow}${this.to}`;
    }

    static create(from: string, to: string, label?: string): DataFlowConnection {
        return new DataFlowConnection(from, to, label);
    }

    static createWithNullability(from: string, to: string, isNullable: boolean): DataFlowConnection {
        const label = isNullable ? 'NULLABLE' : 'NOT NULL';
        return new DataFlowConnection(from, to, label);
    }
}

/**
 * Collection of edges with utilities for managing connections
 */
export class DataFlowEdgeCollection {
    private edges: DataFlowConnection[] = [];
    private connectionSet = new Set<string>();

    add(edge: DataFlowConnection): void {
        const key = `${edge.from}->${edge.to}`;
        if (!this.connectionSet.has(key)) {
            this.edges.push(edge);
            this.connectionSet.add(key);
        }
    }

    addConnection(from: string, to: string, label?: string): void {
        this.add(DataFlowConnection.create(from, to, label));
    }

    addJoinConnection(from: string, to: string, isNullable: boolean): void {
        this.add(DataFlowConnection.createWithNullability(from, to, isNullable));
    }

    hasConnection(from: string, to: string): boolean {
        return this.connectionSet.has(`${from}->${to}`);
    }

    getAll(): DataFlowConnection[] {
        return [...this.edges];
    }

    getMermaidRepresentation(): string {
        return this.edges.map(edge => edge.getMermaidRepresentation()).join('\n    ');
    }
}