import { SqlComponent, SqlComponentVisitor } from '../models/SqlComponent';
import { CommonTable, TableSource } from '../models/Clause';
import { SelectClause, SelectItem } from '../models/Clause';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { CTECollector } from './CTECollector';
import { SelectableColumnCollector } from './SelectableColumnCollector';
import { SelectValueCollector } from './SelectValueCollector';
import { ColumnReference } from '../models/ValueComponent';
import { BinarySelectQuery, SelectQuery } from '../models/SelectQuery';

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

    constructor(selectableOnly: boolean = true) {
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Setup handlers for query components
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
        //this.handlers.set(ValuesQuery.kind, (expr) => this.visitValuesQuery(expr as ValuesQuery));

        // WITH clause and common tables
        //this.handlers.set(WithClause.kind, (expr) => this.visitWithClause(expr as WithClause));
        //this.handlers.set(CommonTable.kind, (expr) => this.visitCommonTable(expr as CommonTable));

        // Handlers for FROM and JOIN components
        //this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        //this.handlers.set(JoinClause.kind, (expr) => this.visitJoinClause(expr as JoinClause));
        //this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        //this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));

        // Source components
        //this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
        //this.handlers.set(TableSource.kind, (expr) => this.visitTableSource(expr as TableSource));
        //this.handlers.set(ParenSource.kind, (expr) => this.visitParenSource(expr as ParenSource));
        //this.handlers.set(SubQuerySource.kind, (expr) => this.visitSubQuerySource(expr as SubQuerySource));
        //this.handlers.set(InlineQuery.kind, (expr) => this.visitInlineQuery(expr as InlineQuery));

        // Additional clause handlers for full scanning
        //this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));
        //this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        //this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));
        //this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        //this.handlers.set(WindowFrameClause.kind, (expr) => this.visitWindowFrameClause(expr as WindowFrameClause));
        //this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        //this.handlers.set(OffsetClause.kind, (expr) => this.visitOffsetClause(expr as OffsetClause));
        //this.handlers.set(FetchClause.kind, (expr) => this.visitFetchClause(expr as FetchClause));
        //this.handlers.set(ForClause.kind, (expr) => this.visitForClause(expr as ForClause));
        //this.handlers.set(OrderByItem.kind, (expr) => this.visitOrderByItem(expr as OrderByItem));
        //this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        //this.handlers.set(SelectItem.kind, (expr) => this.visitSelectItem(expr as SelectItem));

        // Value components that might contain table references
        //this.handlers.set(ParenExpression.kind, (expr) => this.visitParenExpression(expr as ParenExpression));
        //this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
        //this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
        //this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
        //this.handlers.set(CaseKeyValuePair.kind, (expr) => this.visitCaseKeyValuePair(expr as CaseKeyValuePair));
        //this.handlers.set(SwitchCaseArgument.kind, (expr) => this.visitSwitchCaseArgument(expr as SwitchCaseArgument));
        //this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
        //this.handlers.set(FunctionCall.kind, (expr) => this.visitFunctionCall(expr as FunctionCall));
        //this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));
        //this.handlers.set(TupleExpression.kind, (expr) => this.visitTupleExpression(expr as TupleExpression));
        //this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
    }

    public collect(arg: SqlComponent): TableSchema[] {
        this.visit(arg);
        return this.tableSchemas;
    }

    /**
     * Visits a SQL component to collect schema information.
     */
    public visit(arg: SqlComponent): void {
        // Throws an error if not a SimpleSelectQuery
        if (!(arg instanceof SimpleSelectQuery || arg instanceof BinarySelectQuery)) {
            throw new Error(`Unsupported SQL component type for schema collection. Received: ${arg.constructor.name}. Expected: SimpleSelectQuery or BinarySelectQuery.`);
        }

        // initialize schema information
        this.tableSchemas = [];
        this.visitedNodes = new Set();
        this.commonTables = [];

        // Collects Common Table Expressions (CTEs) using CTECollector
        const cteCollector = new CTECollector();
        this.commonTables = cteCollector.collect(arg);

        // Scan elements using the visitor pattern
        this.visitNode(arg);

        // Consolidate tableSchemas
        this.consolidateTableSchemas();
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

        this.tableSchemas = Array.from(consolidatedSchemas.entries()).map(([name, columns]) => {
            return new TableSchema(name, Array.from(columns));
        });
    }

    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        // このクエリで使用されている列を回収する
        const columnCollector = new SelectableColumnCollector();
        const queryColumns = columnCollector.collect(query)
            .filter((column) => column.value instanceof ColumnReference)
            .map(column => column.value as ColumnReference)
            .map(columnRef => ({
                table: columnRef.getNamespace(),
                column: columnRef.column.name
            }));

        // 表名がない列がある場合、エラーを投げる
        const columnsWithoutTable = queryColumns.filter((columnRef) => columnRef.table === "").map((columnRef) => columnRef.column);
        if (columnsWithoutTable.length > 0) {
            throw new Error(`Column reference(s) without table name found in query: ${columnsWithoutTable.join(', ')}`);
        }

        // If the table is a physical table, list it
        if (query.fromClause && query.fromClause.source.datasource instanceof TableSource) {
            const tableName = query.fromClause.source.datasource.getSourceName();
            if (!this.commonTables.some((table) => table.getSourceAliasName() === tableName)) {
                // If a physical table is included, use SelectableColumnCollector to collect columns
                const tableAlias = query.fromClause.source.getAliasName() ?? tableName;
                this.processCollectTableSchema(tableName, tableAlias, queryColumns);
            }
        }

        if (query.fromClause?.joins) {
            for (const join of query.fromClause.joins) {
                if (join.source.datasource instanceof TableSource) {
                    const tableName = join.source.datasource.getSourceName();
                    if (!this.commonTables.some((table) => table.getSourceAliasName() === tableName)) {
                        // If a physical table is included, use SelectableColumnCollector to collect columns
                        const tableAlias = join.source.getAliasName() ?? tableName;
                        this.processCollectTableSchema(tableName, tableAlias, queryColumns);
                    }
                }
            }
        }

        // Cascade into subqueries... but for the initial version, this is not implemented.
        // Subquery processing will be supported in future versions.
    }

    private visitBinarySelectQuery(query: BinarySelectQuery): void {
        // Visit the left and right queries
        this.visitNode(query.left);
        this.visitNode(query.right);
    }

    private processCollectTableSchema(tableName: string, tableAlias: string, queryColumns: { table: string, column: string }[]): void {
        const tableColumns = queryColumns.filter((columnRef) => columnRef.table === tableAlias).map((columnRef) => columnRef.column);
        const tableSchema = new TableSchema(tableName, tableColumns);
        this.tableSchemas.push(tableSchema);
    }
}
