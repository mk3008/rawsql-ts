import { SelectClause, SelectComponent, SelectItem } from "../models/Clause";
import { BinarySelectQuery, SimpleSelectQuery, SelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import { ColumnReference, InlineQuery } from "../models/ValueComponent";

/**
 * A visitor that collects all SelectItem instances from a SQL query structure.
 * This visitor scans through select clauses and collects all the SelectItem objects.
 */
export class SelectValueCollector implements SqlComponentVisitor<void> {
    private handlers: Map<symbol, (arg: any) => void>;
    private selectItems: { name: string, value: SelectComponent }[] = [];
    private visitedNodes: Set<SqlComponent> = new Set();
    private isRootVisit: boolean = true;

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
    public getSelectItems(): { name: string, value: SelectComponent }[] {
        return this.selectItems;
    }

    /**
     * Reset the collection of SelectItems
     */
    private reset(): void {
        this.selectItems = [];
        this.visitedNodes.clear();
    }

    public collect(arg: SqlComponent): { name: string, value: SelectComponent }[] {
        // Visit the component and return the collected select items
        this.visit(arg);
        const items = this.getSelectItems();
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

    private visitSimpleSelectQuery(query: SimpleSelectQuery): void {
        // Visit the SELECT clause which contains the items we want to collect
        if (query.selectClause) {
            query.selectClause.accept(this);
        }
    }

    private visitBinarySelectQuery(query: BinarySelectQuery): void {
        // check left only
        if (query.left) {
            query.left.accept(this);
        }
    }

    private visitValuesQuery(query: ValuesQuery): void {
        // VALUES queries don't contain SelectItems, so nothing to do
    }

    private visitSelectClause(clause: SelectClause): void {
        if (!clause.items || clause.items.length === 0) {
            return; // Do nothing (no items)
        }

        // Create a map with names as keys to store unique items
        const uniqueItems = this.collectUniqueSelectItems(clause.items);

        // Convert map to array and set as result
        this.selectItems = Array.from(uniqueItems.values());
    }

    /**
     * Collects unique items from a collection of select components based on their names
     * @param items The list of SelectComponent to process
     * @returns A map of unique items keyed by name
     */
    private collectUniqueSelectItems(items: SelectComponent[]): Map<string, { name: string, value: SelectComponent }> {
        const uniqueItems = new Map<string, { name: string, value: SelectComponent }>();

        for (const item of items) {
            // For SelectItem (named selection items)
            if (item instanceof SelectItem) {
                this.processSelectItem(item, uniqueItems);
            }
            // For ColumnReference
            else if (item instanceof ColumnReference) {
                this.processColumnReference(item, uniqueItems);
            }
            // Other types are ignored as they don't have retrievable names
        }

        return uniqueItems;
    }

    /**
     * Processes a SelectItem and adds it to the unique items map
     */
    private processSelectItem(item: SelectItem, uniqueItems: Map<string, { name: string, value: SelectComponent }>): void {
        const name = item.name?.name || '';

        // Only add to map if name is not empty
        if (name) {
            uniqueItems.set(name, {
                name: name,
                value: item
            });
        }
    }

    /**
     * Processes a ColumnReference and adds it to the unique items map
     */
    private processColumnReference(item: ColumnReference, uniqueItems: Map<string, { name: string, value: SelectComponent }>): void {
        const name = item.column.name;

        uniqueItems.set(name, {
            name: name,
            value: item
        });
    }

    private visitInlineQuery(inlineQuery: InlineQuery): void {
        // Process the inline query's select query
        if (inlineQuery && inlineQuery.selectQuery) {
            inlineQuery.selectQuery.accept(this);
        }
    }
}