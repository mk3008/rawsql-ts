import { CommonTable, CTEQuery, FromClause, JoinClause, ParenSource, ReturningClause, SelectItem, SourceExpression, SubQuerySource, TableSource } from "../models/Clause";
import { InsertQuery } from "../models/InsertQuery";
import { DeleteQuery } from "../models/DeleteQuery";
import { MergeQuery } from "../models/MergeQuery";
import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { SqlComponent } from "../models/SqlComponent";
import { UpdateQuery } from "../models/UpdateQuery";
import { ColumnReference, ValueComponent } from "../models/ValueComponent";
import { CTECollector } from "./CTECollector";
import { TableColumnResolver } from "./TableColumnResolver";

export interface SelectOutputColumn {
    name: string;
    value: ValueComponent;
    outputIndex: number;
}

type RawSelectOutputColumn = Omit<SelectOutputColumn, "outputIndex">;

/**
 * Collects SELECT output columns without collapsing duplicate output names.
 *
 * This collector is intended for callers that need stable SELECT-list positions.
 * It keeps output order and assigns outputIndex after supported wildcard expansion.
 */
export class SelectOutputCollector {
    private commonTableCollector = new CTECollector();
    private commonTables: CommonTable[];

    constructor(
        private tableColumnResolver: TableColumnResolver | null = null,
        initialCommonTables: CommonTable[] | null = null
    ) {
        this.commonTables = initialCommonTables ?? [];
    }

    public collect(arg: SqlComponent): SelectOutputColumn[] {
        const rawColumns = this.collectRaw(arg);
        return rawColumns.map((item, outputIndex) => ({
            ...item,
            outputIndex
        }));
    }

    private collectRaw(arg: SqlComponent): RawSelectOutputColumn[] {
        if (arg instanceof SimpleSelectQuery) {
            return this.collectSimpleSelectQuery(arg);
        }

        if (arg instanceof SourceExpression) {
            return this.collectSourceExpression(arg.getAliasName(), arg);
        }

        if (arg instanceof FromClause) {
            return this.collectFromClause(arg, true);
        }

        return [];
    }

    private collectSimpleSelectQuery(query: SimpleSelectQuery): RawSelectOutputColumn[] {
        const previousCommonTables = this.commonTables;
        if (this.commonTables.length === 0) {
            this.commonTables = this.commonTableCollector.collect(query);
        }

        try {
            const outputs: RawSelectOutputColumn[] = [];
            for (const item of query.selectClause.items) {
                outputs.push(...this.collectSelectItem(item, query.fromClause));
            }
            return outputs;
        } finally {
            this.commonTables = previousCommonTables;
        }
    }

    private collectSelectItem(item: SelectItem, fromClause: FromClause | null): RawSelectOutputColumn[] {
        if (item.identifier) {
            return [{ name: item.identifier.name, value: item.value }];
        }

        if (!(item.value instanceof ColumnReference)) {
            return [];
        }

        const columnName = item.value.column.name;
        if (columnName === "*") {
            return this.expandWildcard(item.value, fromClause);
        }

        return [{ name: columnName, value: item.value }];
    }

    private expandWildcard(value: ColumnReference, fromClause: FromClause | null): RawSelectOutputColumn[] {
        if (!fromClause) {
            return [];
        }

        if (value.namespaces === null) {
            return this.collectFromClause(fromClause, true);
        }

        const sourceName = value.getNamespace();
        if (fromClause.getSourceAliasName() === sourceName) {
            return this.collectFromClause(fromClause, false);
        }

        const join = fromClause.joins?.find(item => this.getJoinSourceName(item) === sourceName);
        return join ? this.collectJoinClause(join) : [];
    }

    private collectFromClause(clause: FromClause, joinCascade: boolean): RawSelectOutputColumn[] {
        const outputs = this.collectSourceExpression(clause.getSourceAliasName(), clause.source);

        if (clause.joins && joinCascade) {
            for (const join of clause.joins) {
                outputs.push(...this.collectJoinClause(join));
            }
        }

        return outputs;
    }

    private collectJoinClause(clause: JoinClause): RawSelectOutputColumn[] {
        return this.collectSourceExpression(this.getJoinSourceName(clause), clause.source);
    }

    private getJoinSourceName(clause: JoinClause): string | null {
        return clause.source.getAliasName();
    }

    private collectSourceExpression(sourceName: string | null, source: SourceExpression): RawSelectOutputColumn[] {
        if (source.aliasExpression?.columns) {
            return source.aliasExpression.columns.map(column => ({
                name: column.name,
                value: new ColumnReference(sourceName ? [sourceName] : null, column.name)
            }));
        }

        const cte = this.findCommonTable(source);
        if (cte) {
            const innerCommonTables = this.commonTables.filter(item => item.getSourceAliasName() !== cte.getSourceAliasName());
            const innerOutputs = this.collectCteQuery(cte.query, innerCommonTables);
            return this.qualifyOutputs(innerOutputs, sourceName);
        }

        if (source.datasource instanceof TableSource) {
            return this.collectTableSource(sourceName, source.datasource);
        }

        if (source.datasource instanceof SubQuerySource) {
            const innerOutputs = this.collectNestedSelectQuery(source.datasource.query);
            return this.qualifyOutputs(innerOutputs, sourceName);
        }

        if (source.datasource instanceof ParenSource) {
            return [];
        }

        return [];
    }

    private findCommonTable(source: SourceExpression): CommonTable | null {
        if (!(source.datasource instanceof TableSource)) {
            return null;
        }

        const tableName = source.datasource.getSourceName();
        return this.commonTables.find(item => item.getSourceAliasName() === tableName) ?? null;
    }

    private collectTableSource(sourceName: string | null, source: TableSource): RawSelectOutputColumn[] {
        if (!this.tableColumnResolver) {
            return [];
        }

        const tableName = source.getSourceName();
        const qualifier = sourceName ?? tableName;
        return this.tableColumnResolver(tableName).map(column => ({
            name: column,
            value: new ColumnReference([qualifier], column)
        }));
    }

    private collectNestedSelectQuery(query: SelectQuery): RawSelectOutputColumn[] {
        const collector = new SelectOutputCollector(this.tableColumnResolver, this.commonTables);
        return collector.collect(query).map(({ name, value }) => ({ name, value }));
    }

    private collectCteQuery(query: CTEQuery, commonTables: CommonTable[]): RawSelectOutputColumn[] {
        if (this.isSelectQuery(query)) {
            const collector = new SelectOutputCollector(this.tableColumnResolver, commonTables);
            return collector.collect(query).map(({ name, value }) => ({ name, value }));
        }

        return this.collectReturningOutputs(query);
    }

    private collectReturningOutputs(query: CTEQuery): RawSelectOutputColumn[] {
        if (!(query instanceof InsertQuery || query instanceof UpdateQuery || query instanceof DeleteQuery || query instanceof MergeQuery)) {
            return [];
        }

        if (!query.returningClause) {
            return [];
        }

        return this.extractReturningOutputs(query.returningClause);
    }

    private extractReturningOutputs(clause: ReturningClause): RawSelectOutputColumn[] {
        const outputs: RawSelectOutputColumn[] = [];
        for (const item of clause.items) {
            const name = item.identifier?.name ?? this.extractSelectItemName(item);
            if (name) {
                outputs.push({ name, value: item.value });
            }
        }
        return outputs;
    }

    private extractSelectItemName(item: SelectItem): string | null {
        if (item.identifier) {
            return item.identifier.name;
        }
        if (item.value instanceof ColumnReference) {
            return item.value.column.name;
        }
        return null;
    }

    private qualifyOutputs(outputs: RawSelectOutputColumn[], sourceName: string | null): RawSelectOutputColumn[] {
        return outputs.map(item => ({
            name: item.name,
            value: new ColumnReference(sourceName ? [sourceName] : null, item.name)
        }));
    }

    private isSelectQuery(query: CTEQuery): query is SelectQuery {
        return "__selectQueryType" in query && (query as SelectQuery).__selectQueryType === "SelectQuery";
    }
}
