import { SqlComponent, SqlComponentVisitor } from '../models/SqlComponent';
import { CommonTable, SubQuerySource, TableSource } from '../models/Clause';
import { SelectClause, SelectItem } from '../models/Clause';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { CTECollector } from './CTECollector';
import { SelectableColumnCollector } from './SelectableColumnCollector';
import { SelectValueCollector } from './SelectValueCollector';
import { ColumnReference } from '../models/ValueComponent';
import { BinarySelectQuery, SelectQuery } from '../models/SelectQuery';
import { SourceExpression } from '../models/Clause';
import { TableColumnResolver } from './TableColumnResolver';

export class TableSchema {
    public name: string;
    public columns: string[];

    constructor(name: string, columns: string[]) {
        this.name = name;
        this.columns = columns;
    }
}

/**
 * A visitor that collects schema information (table names and column names) from a SQL query structure.
 */
export class SchemaCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;

    private tableSchemas: TableSchema[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();
    private commonTables: CommonTable[] = [];
    private running = false;

    constructor(private tableColumnResolver: TableColumnResolver | null = null) {
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Setup handlers for query components
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
    }

    /**
     * Collects schema information (table names and column names) from a SQL query structure.
     * This method ensures that the collected schema information is unique and sorted.
     * The resulting schemas and columns are sorted alphabetically to ensure deterministic ordering.
     *
     * @param arg The SQL query structure to analyze.
     */
    public collect(arg: SqlComponent): TableSchema[] {
        this.visit(arg);
        return this.tableSchemas;
    }

    /**
     * Main entry point for the visitor pattern.
     * Implements the shallow visit pattern to distinguish between root and recursive visits.
     *
     * This method ensures that schema information is collected uniquely and sorted.
     * The resulting schemas and columns are sorted alphabetically to ensure deterministic ordering.
     *
     * @param arg The SQL component to visit.
     */
    public visit(arg: SqlComponent): void {
        // If not a root visit, just visit the node and return
        if (this.running) {
            this.visitNode(arg);
            return;
        }

        // If this is a root visit, we need to reset the state
        this.reset();
        this.running = true;

        try {
            // Ensure the argument is a SelectQuery
            if (!(arg instanceof SimpleSelectQuery || arg instanceof BinarySelectQuery)) {
                throw new Error(`Unsupported SQL component type for schema collection. Received: ${arg.constructor.name}. Expected: SimpleSelectQuery or BinarySelectQuery.`);
            }

            // Collects Common Table Expressions (CTEs) using CTECollector
            const cteCollector = new CTECollector();
            this.commonTables = cteCollector.collect(arg);

            this.visitNode(arg);

            // Consolidate tableSchemas
            this.consolidateTableSchemas();
        } finally {
            // Regardless of success or failure, reset the root visit flag
            this.running = false;
        }
    }

    /**
     * Internal visit method used for all nodes.
     * This separates the visit flag management from the actual node visitation logic.
     */
    private visitNode(arg: SqlComponent): void {
        // Skip if we've already visited this node to prevent infinite recursion
        if (this.visitedNodes.has(arg)) {
            return;
        }

        // Mark as visited
        this.visitedNodes.add(arg);

        const handler = this.handlers.get(arg.getKind());
        if (handler) {
            handler(arg);
            return;
        }

        // If no handler found, that's ok - we only care about specific components
    }

    /**
     * Resets the state of the collector for a new root visit.
     */
    private reset(): void {
        this.tableSchemas = [];
        this.visitedNodes = new Set();
        this.commonTables = [];
    }

    /**
     * Consolidates table schemas by merging columns for tables with the same name.
     * This ensures that each table name appears only once in the final schema list,
     * with all its columns combined while removing duplicates.
     *
     * Note: The resulting schemas and columns are sorted alphabetically to ensure deterministic ordering.
     */
    private consolidateTableSchemas(): void {
        const consolidatedSchemas: Map<string, Set<string>> = new Map();

        for (const schema of this.tableSchemas) {
            if (!consolidatedSchemas.has(schema.name)) {
                consolidatedSchemas.set(schema.name, new Set(schema.columns));
            } else {
                const existingColumns = consolidatedSchemas.get(schema.name);
                schema.columns.forEach(column => existingColumns?.add(column));
            }
        }

        this.tableSchemas = Array.from(consolidatedSchemas.entries())
            .sort(([nameA], [nameB]) => nameA.localeCompare(nameB)) // Sort by table name
            .map(([name, columns]) => {
                return new TableSchema(name, Array.from(columns).sort()); // Sort columns alphabetically
            });
    }

    private handleTableSource(source: SourceExpression, queryColumns: { table: string, column: string }[], includeUnnamed: boolean): void {
        if (source.datasource instanceof TableSource) {
            const tableName = source.datasource.getSourceName();
            const cte = this.commonTables.filter((table) => table.getSourceAliasName() === tableName);
            if (cte.length > 0) {
                cte[0].query.accept(this);
            } else {
                const tableAlias = source.getAliasName() ?? tableName;
                this.processCollectTableSchema(tableName, tableAlias, queryColumns, includeUnnamed);
            }
        } else {
            throw new Error("Datasource is not an instance of TableSource");
        }
    }

    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        if (query.fromClause === null) {
            return;
        }

        // Collect columns used in the query
        const columnCollector = new SelectableColumnCollector(this.tableColumnResolver, true);
        const queryColumns = columnCollector.collect(query)
            .filter((column) => column.value instanceof ColumnReference)
            .map(column => column.value as ColumnReference)
            .map(columnRef => ({
                table: columnRef.getNamespace(),
                column: columnRef.column.name
            }));

        // Throw an error if there are columns without table names in queries with joins
        if (query.fromClause.joins !== null && query.fromClause.joins.length > 0) {
            const columnsWithoutTable = queryColumns.filter((columnRef) => columnRef.table === "").map((columnRef) => columnRef.column);
            if (columnsWithoutTable.length > 0) {
                throw new Error(`Column reference(s) without table name found in query: ${columnsWithoutTable.join(', ')}`);
            }
        }

        // Handle the main FROM clause table
        if (query.fromClause.source.datasource instanceof TableSource) {
            this.handleTableSource(query.fromClause.source, queryColumns, true);
        } else if (query.fromClause.source.datasource instanceof SubQuerySource) {
            query.fromClause.source.datasource.query.accept(this);
        }

        // Handle JOIN clause tables
        if (query.fromClause?.joins) {
            for (const join of query.fromClause.joins) {
                if (join.source.datasource instanceof TableSource) {
                    this.handleTableSource(join.source, queryColumns, false);
                } else if (join.source.datasource instanceof SubQuerySource) {
                    join.source.datasource.query.accept(this);
                }
            }
        }
    }

    private visitBinarySelectQuery(query: BinarySelectQuery): void {
        // Visit the left and right queries
        this.visitNode(query.left);
        this.visitNode(query.right);
    }

    private processCollectTableSchema(tableName: string, tableAlias: string, queryColumns: { table: string, column: string }[], includeUnnamed: boolean = false): void {
        // If a wildcard is present and no resolver is provided, throw an error
        if (this.tableColumnResolver === null) {
            const hasWildcard = queryColumns
                .filter((columnRef) => columnRef.table === tableAlias || (includeUnnamed && columnRef.table === ""))
                .filter((columnRef) => columnRef.column === "*")
                .length > 0;
            if (hasWildcard) {
                const errorMessage = tableName
                    ? `Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards. Target table: ${tableName}`
                    : "Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards.";
                throw new Error(errorMessage);
            }
        }

        let tableColumns = queryColumns
            .filter((columnRef) => columnRef.column !== "*")
            .filter((columnRef) => columnRef.table === tableAlias || (includeUnnamed && columnRef.table === ""))
            .map((columnRef) => columnRef.column);

        const tableSchema = new TableSchema(tableName, tableColumns);
        this.tableSchemas.push(tableSchema);
    }
}
