import { CommonTable, CTEQuery, FromClause, JoinClause, ParenSource, ReturningClause, SelectClause, SelectItem, SourceExpression, SubQuerySource, TableSource } from "../models/Clause";
import { BinarySelectQuery, SimpleSelectQuery, SelectQuery, ValuesQuery } from "../models/SelectQuery";
import { InsertQuery } from "../models/InsertQuery";
import { UpdateQuery } from "../models/UpdateQuery";
import { DeleteQuery } from "../models/DeleteQuery";
import { MergeQuery } from "../models/MergeQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { ColumnReference, InlineQuery, LiteralValue, ValueComponent } from "../models/ValueComponent";
import { CTECollector } from "./CTECollector";
import { TableColumnResolver } from "./TableColumnResolver";

/**
 * A visitor that collects all SelectItem instances from a SQL query structure.
 * This visitor scans through select clauses and collects all the SelectItem objects.
 * It can also resolve wildcard selectors (table.* or *) using a provided table column resolver.
 */
export class SelectValueCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private selectValues: { name: string, value: ValueComponent }[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();
    private isRootVisit: boolean = true;
    private tableColumnResolver: TableColumnResolver | null;
    private commonTableCollector: CTECollector;
    private commonTables: CommonTable[];
    public initialCommonTables: CommonTable[] | null;
    private preserveDuplicateSelectItems: boolean;

    constructor(tableColumnResolver: TableColumnResolver | null = null, initialCommonTables: CommonTable[] | null = null, preserveDuplicateSelectItems: boolean = false) {
        this.tableColumnResolver = tableColumnResolver ?? null;
        this.commonTableCollector = new CTECollector();
        this.commonTables = [];
        this.initialCommonTables = initialCommonTables;
        this.preserveDuplicateSelectItems = preserveDuplicateSelectItems;

        this.handlers = new Map<symbol, (arg: any) => void>();

        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
    }

    /**
     * Get all collected SelectItems as an array of objects with name and value properties
     * @returns An array of objects with name (string) and value (ValueComponent) properties
     */
    public getValues(): { name: string, value: ValueComponent }[] {
        return this.selectValues;
    }

    /**
     * Reset the collection of SelectItems
     */
    private reset(): void {
        this.selectValues = [];
        this.visitedNodes.clear();
        if (this.initialCommonTables) {
            this.commonTables = this.initialCommonTables;
        } else {
            this.commonTables = [];
        }
    }

    public collect(arg: SqlComponent): { name: string, value: ValueComponent }[] {
        // Visit the component and return the collected select items
        this.visit(arg);
        const items = this.getValues();
        this.reset(); // Reset after collection
        return items;
    }

    /**
     * Main entry point for the visitor pattern.
     * Implements the shallow visit pattern to distinguish between root and recursive visits.
     */
    public visit(arg: SqlComponent): void {
        // If not a root visit, just visit the node and return
        if (!this.isRootVisit) {
            this.visitNode(arg);
            return;
        }

        // If this is a root visit, we need to reset the state
        this.reset();
        this.isRootVisit = false;

        try {
            this.visitNode(arg);
        } finally {
            // Regardless of success or failure, reset the root visit flag
            this.isRootVisit = true;
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
    }

    /**
     * Process a SimpleSelectQuery to collect data and store the current context
     */
    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        if (this.commonTables.length === 0 && this.initialCommonTables === null) {
            this.commonTables = this.commonTableCollector.collect(query);
        }

        if (query.selectClause) {
            query.selectClause.accept(this);
        }

        // no wildcard 
        const wildcards = this.selectValues.filter(item => item.name === '*');
        if (wildcards.length === 0) {
            return;
        }

        const expandedValues: { name: string, value: ValueComponent }[] = [];
        for (const item of this.selectValues) {
            if (item.name !== '*' || !(item.value instanceof ColumnReference)) {
                expandedValues.push(item);
                continue;
            }

            expandedValues.push(...this.expandWildcardValue(item.value, query.fromClause));
        }

        this.selectValues = expandedValues;
    }

    private processFromClause(clause: FromClause, joinCascade: boolean): void {
        for (const item of this.collectFromClauseValues(clause, joinCascade)) {
            this.addSelectValue(item.name, item.value);
        }
        return;
    }

    private processJoinClause(clause: JoinClause): void {
        for (const item of this.collectJoinClauseValues(clause)) {
            this.addSelectValue(item.name, item.value);
        }
    }

    private processSourceExpression(sourceName: string | null, source: SourceExpression) {
        for (const item of this.collectSourceExpressionValues(sourceName, source)) {
            this.addSelectValue(item.name, item.value);
        }
    }

    private expandWildcardValue(value: ColumnReference, fromClause: FromClause | null): { name: string, value: ValueComponent }[] {
        if (!fromClause) {
            return [];
        }

        if (value.namespaces === null) {
            return this.collectFromClauseValues(fromClause, true);
        }

        const sourceName = value.getNamespace();
        if (fromClause.getSourceAliasName() === sourceName) {
            return this.collectFromClauseValues(fromClause, false);
        }

        if (!fromClause.joins) {
            return [];
        }

        const join = fromClause.joins.find(item => this.getJoinSourceName(item) === sourceName);
        return join ? this.collectJoinClauseValues(join) : [];
    }

    private collectFromClauseValues(clause: FromClause, joinCascade: boolean): { name: string, value: ValueComponent }[] {
        const values = this.collectSourceExpressionValues(clause.getSourceAliasName(), clause.source);

        if (clause.joins && joinCascade) {
            for (const join of clause.joins) {
                values.push(...this.collectJoinClauseValues(join));
            }
        }

        return values;
    }

    private collectJoinClauseValues(clause: JoinClause): { name: string, value: ValueComponent }[] {
        return this.collectSourceExpressionValues(this.getJoinSourceName(clause), clause.source);
    }

    private getJoinSourceName(clause: JoinClause): string | null {
        return clause.source.getAliasName();
    }

    private collectSourceExpressionValues(sourceName: string | null, source: SourceExpression): { name: string, value: ValueComponent }[] {
        // check common table
        const tableSourceName = source.datasource instanceof TableSource ? source.datasource.getSourceName() : null;
        const commonTable = tableSourceName
            ? this.commonTables.find(item => item.aliasExpression.table.name === tableSourceName)
            : null;

        if (commonTable) {
            // Exclude this CTE from consideration to prevent self-reference
            const innerCommonTables = this.commonTables.filter(item => item.aliasExpression.table.name !== commonTable.aliasExpression.table.name);

            const innerSelected = this.collectValuesFromCteQuery(commonTable.query, innerCommonTables);
            return innerSelected.map(item => ({
                name: item.name,
                value: new ColumnReference(sourceName ? [sourceName] : null, item.name)
            }));
        }

        const innerCollector = new SelectValueCollector(this.tableColumnResolver, this.commonTables, true);
        const innerSelected = innerCollector.collect(source);
        return innerSelected.map(item => ({
            name: item.name,
            value: new ColumnReference(sourceName ? [sourceName] : null, item.name)
        }));
    }

    private visitSelectClause(clause: SelectClause): void {
        for (const item of clause.items) {
            this.processSelectItem(item);
        }
    }

    private processSelectItem(item: SelectItem): void {
        if (item.identifier) {
            this.addSelectValueFromSelectItem(item.identifier.name, item.value);
        }
        else if (item.value instanceof ColumnReference) {            // Handle column reference
            // columnName can be '*'
            const columnName = item.value.column.name;
            if (columnName === '*') {
                // Force add without checking duplicates
                this.selectValues.push({ name: columnName, value: item.value });
            }
            else {
                // Add with duplicate checking
                this.addSelectValueFromSelectItem(columnName, item.value);
            }
        }
    }

    private visitSourceExpression(source: SourceExpression): void {
        // Column aliases have the highest priority if present
        // For physical tables, use external function to get column names
        // For subqueries, instantiate a new collector and get column names from the subquery
        // For parenthesized expressions, treat them the same as subqueries

        if (source.aliasExpression && source.aliasExpression.columns) {
            const sourceName = source.getAliasName();
            source.aliasExpression.columns.forEach(column => {
                this.addSelectValueFromSelectItem(column.name, new ColumnReference(sourceName ? [sourceName] : null, column.name));
            });
            return;
        } else if (source.datasource instanceof TableSource) {
            if (this.tableColumnResolver) {
                const sourceName = source.datasource.getSourceName();
                this.tableColumnResolver(sourceName).forEach(column => {
                    this.addSelectValueFromSelectItem(column, new ColumnReference([sourceName], column));
                });
            }
            return;
        } else if (source.datasource instanceof SubQuerySource) {
            const sourceName = source.getAliasName();
            const innerCollector = new SelectValueCollector(this.tableColumnResolver, this.commonTables, true);
            const innerSelected = innerCollector.collect(source.datasource.query);
            innerSelected.forEach(item => {
                this.addSelectValueFromSelectItem(item.name, new ColumnReference(sourceName ? [sourceName] : null, item.name));
            });
            return;
        } else if (source.datasource instanceof ParenSource) {
            return this.visit(source.datasource.source);
        }
    }

    private visitFromClause(clause: FromClause): void {
        if (clause) {
            this.processFromClause(clause, true);
        }
    }

    private addSelectValueAsUnique(name: string, value: ValueComponent): void {
        // Check if a select value with the same name already exists before adding
        if (!this.selectValues.some(item => item.name === name)) {
            this.selectValues.push({ name, value });
        }
    }

    private addSelectValue(name: string, value: ValueComponent): void {
        this.selectValues.push({ name, value });
    }

    private addSelectValueFromSelectItem(name: string, value: ValueComponent): void {
        if (this.preserveDuplicateSelectItems) {
            this.addSelectValue(name, value);
            return;
        }

        this.addSelectValueAsUnique(name, value);
    }

    private collectValuesFromCteQuery(query: CTEQuery, commonTables: CommonTable[]): { name: string, value: ValueComponent }[] {
        if (this.isSelectQuery(query)) {
            const innerCollector = new SelectValueCollector(this.tableColumnResolver, commonTables, true);
            return innerCollector.collect(query);
        }

        // Writable CTEs expose their output via RETURNING.
        return this.collectValuesFromReturning(query);
    }

    private collectValuesFromReturning(query: CTEQuery): { name: string, value: ValueComponent }[] {
        if (!(query instanceof InsertQuery || query instanceof UpdateQuery || query instanceof DeleteQuery || query instanceof MergeQuery)) {
            return [];
        }

        if (!query.returningClause) {
            return [];
        }

        return this.extractValuesFromReturningClause(query.returningClause);
    }

    private extractValuesFromReturningClause(clause: ReturningClause): { name: string, value: ValueComponent }[] {
        const values: { name: string, value: ValueComponent }[] = [];

        for (const item of clause.items) {
            const name = item.identifier?.name ?? this.extractSelectItemName(item);
            if (name) {
                values.push({ name, value: item.value });
            }
        }

        return values;
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

    private isSelectQuery(query: CTEQuery): query is SelectQuery {
        return '__selectQueryType' in query && (query as SelectQuery).__selectQueryType === 'SelectQuery';
    }
}
