import { CommonTable, FromClause, JoinClause, ParenSource, SelectClause, SelectItem, SourceExpression, SubQuerySource, TableSource } from "../models/Clause";
import { BinarySelectQuery, SimpleSelectQuery, SelectQuery, ValuesQuery } from "../models/SelectQuery";
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

    constructor(tableColumnResolver: TableColumnResolver | null = null, initialCommonTables: CommonTable[] | null = null) {
        this.tableColumnResolver = tableColumnResolver ?? null;
        this.commonTableCollector = new CTECollector();
        this.commonTables = [];
        this.initialCommonTables = initialCommonTables;

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

        // full wildcard
        if (this.selectValues.some(item => item.value instanceof ColumnReference && item.value.namespaces === null)) {
            if (query.fromClause) {
                this.processFromClause(query.fromClause, true);
            }
            // remove wildcard
            this.selectValues = this.selectValues.filter(item => item.name !== '*');
            return;
        };

        // table wildcard
        const wildSourceNames = wildcards.filter(item => item.value instanceof ColumnReference && item.value.namespaces)
            .map(item => (item.value as ColumnReference).getNamespace());

        if (query.fromClause) {
            const fromSourceName = query.fromClause.getSourceAliasName();
            if (fromSourceName && wildSourceNames.includes(fromSourceName)) {
                this.processFromClause(query.fromClause, false);
            }
            if (query.fromClause.joins) {
                for (const join of query.fromClause.joins) {
                    const joinSourceName = join.getSourceAliasName();
                    if (joinSourceName && wildSourceNames.includes(joinSourceName)) {
                        this.processJoinClause(join);
                    }
                }
            }
        }
        // remove wildcard
        this.selectValues = this.selectValues.filter(item => item.name !== '*');
        return;
    }

    private processFromClause(clause: FromClause, joinCascade: boolean): void {
        if (clause) {
            const fromSourceName = clause.getSourceAliasName();
            this.processSourceExpression(fromSourceName, clause.source);

            if (clause.joins && joinCascade) {
                for (const join of clause.joins) {
                    this.processJoinClause(join);
                }
            }
        }
        return;
    }

    private processJoinClause(clause: JoinClause): void {
        const sourceName = clause.getSourceAliasName();
        this.processSourceExpression(sourceName, clause.source);
    }

    private processSourceExpression(sourceName: string | null, source: SourceExpression) {
        // check common table
        const commonTable = this.commonTables.find(item => item.aliasExpression.table.name === sourceName);
        if (commonTable) {
            // Exclude this CTE from consideration to prevent self-reference
            const innerCommonTables = this.commonTables.filter(item => item.aliasExpression.table.name !== sourceName);

            const innerCollector = new SelectValueCollector(this.tableColumnResolver, innerCommonTables);
            const innerSelected = innerCollector.collect(commonTable.query);
            innerSelected.forEach(item => {
                this.addSelectValueAsUnique(item.name, new ColumnReference(sourceName ? [sourceName] : null, item.name));
            });
        } else {
            const innerCollector = new SelectValueCollector(this.tableColumnResolver, this.commonTables);
            const innerSelected = innerCollector.collect(source);
            innerSelected.forEach(item => {
                this.addSelectValueAsUnique(item.name, new ColumnReference(sourceName ? [sourceName] : null, item.name));
            });
        }
    }

    private visitSelectClause(clause: SelectClause): void {
        for (const item of clause.items) {
            this.processSelectItem(item);
        }
    }

    private processSelectItem(item: SelectItem): void {
        if (item.identifier) {
            this.addSelectValueAsUnique(item.identifier.name, item.value);
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
                this.addSelectValueAsUnique(columnName, item.value);
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
                this.addSelectValueAsUnique(column.name, new ColumnReference(sourceName ? [sourceName] : null, column.name));
            });
            return;
        } else if (source.datasource instanceof TableSource) {
            if (this.tableColumnResolver) {
                const sourceName = source.datasource.getSourceName();
                this.tableColumnResolver(sourceName).forEach(column => {
                    this.addSelectValueAsUnique(column, new ColumnReference([sourceName], column));
                });
            }
            return;
        } else if (source.datasource instanceof SubQuerySource) {
            const sourceName = source.getAliasName();
            const innerCollector = new SelectValueCollector(this.tableColumnResolver, this.commonTables);
            const innerSelected = innerCollector.collect(source.datasource.query);
            innerSelected.forEach(item => {
                this.addSelectValueAsUnique(item.name, new ColumnReference(sourceName ? [sourceName] : null, item.name));
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
}
