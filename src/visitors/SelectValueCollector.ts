import { SelectClause, SelectComponent, SelectItem } from "../models/Clause";
import { BinarySelectQuery, SimpleSelectQuery, SelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { ColumnReference, InlineQuery } from "../models/ValueComponent";

/**
 * A visitor that collects all SelectItem instances from a SQL query structure.
 * This visitor scans through select clauses and collects all the SelectItem objects.
 */
export class SelectComponentCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private selectItems: { name: string, value: SelectComponent }[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();

    constructor() {
        this.handlers = new Map<symbol, (arg: any) => void>();

        // Setup handlers for query types that contain SelectItems
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSimpleSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
        this.handlers.set(ValuesQuery.kind, (expr) => this.visitValuesQuery(expr as ValuesQuery));

        // The core handler for select clauses
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));

        // For handling subqueries that may contain select items
        this.handlers.set(InlineQuery.kind, (expr) => this.visitInlineQuery(expr as InlineQuery));
    }

    /**
     * Get all collected SelectItems as an array of objects with name and value properties
     * @returns An array of objects with name (string) and value (SelectComponent) properties
     */
    getSelectItems(): { name: string, value: SelectComponent }[] {
        return this.selectItems;
    }

    /**
     * Reset the collection of SelectItems
     */
    reset(): void {
        this.selectItems = [];
        this.visitedNodes.clear();
    }

    /**
     * Main entry point for the visitor pattern
     */
    visit(arg: SqlComponent): void {
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

    visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        // Visit the SELECT clause which contains the items we want to collect
        if (query.selectClause) {
            query.selectClause.accept(this);
        }
    }

    visitBinarySelectQuery(query: BinarySelectQuery): void {
        // check left only
        if (query.left) {
            query.left.accept(this);
        }
    }

    visitValuesQuery(query: ValuesQuery): void {
        // VALUES queries don't contain SelectItems, so nothing to do
    }

    visitSelectClause(clause: SelectClause): void {
        if (clause.items) {
            for (const item of clause.items) {
                if (item instanceof SelectItem) {
                    const sitem = item as SelectItem;
                    this.selectItems.push({
                        name: sitem.name?.name || '',
                        value: item
                    });
                } else if (item instanceof ColumnReference) {
                    // Handle ColumnReference if needed
                    const citem = item as ColumnReference;
                    this.selectItems.push({
                        name: citem.column.name,
                        value: item
                    });
                }
                // Ignore items that don't have a retrievable name
            }
        }
    }

    visitInlineQuery(inlineQuery: InlineQuery): void {
        // Process the inline query's select query
        if (inlineQuery && inlineQuery.selectQuery) {
            inlineQuery.selectQuery.accept(this);
        }
    }
}