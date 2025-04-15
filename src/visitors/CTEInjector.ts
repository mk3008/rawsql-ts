import { CommonTable, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { CTECollector } from "./CTECollector";
import { CTEBuilder } from "./CTEBuilder";

/**
 * CTEInjector accepts a SelectQuery object and an array of CommonTables,
 * and inserts Common Table Expressions into the query.
 * For BinarySelectQuery, CTEs are inserted into the left query.
 * 
 * Uses CTENameConflictResolver to resolve naming conflicts between CTEs.
 */
export class CTEInjector {
    private nameConflictResolver: CTEBuilder;
    private cteCollectolr: CTECollector;

    constructor() {
        this.nameConflictResolver = new CTEBuilder();
        this.cteCollectolr = new CTECollector();
    }

    /**
     * Inserts Common Table Expressions into a SelectQuery object.
     * 
     * @param query The query to inject CTEs into
     * @param commonTables Array of CommonTables to be inserted
     * @returns A new query with the injected CTEs
     */
    public inject(query: SelectQuery, commonTables: CommonTable[]): SelectQuery {
        // If the array is empty, return the query as is
        if (commonTables.length === 0) {
            return query;
        }

        // Collect CTEs from the query
        commonTables.push(...this.cteCollectolr.collect(query));

        // Use CTENameConflictResolver to resolve duplicates and sort in appropriate order
        const resolvedWithCaluse = this.nameConflictResolver.build(commonTables);

        // Process based on query type
        if (query instanceof SimpleSelectQuery) {
            return this.injectIntoSimpleQuery(query, resolvedWithCaluse);
        } else if (query instanceof BinarySelectQuery) {
            return this.injectIntoBinaryQuery(query, resolvedWithCaluse);
        }

        // Unsupported query type
        throw new Error("Unsupported query type");
    }

    /**
     * Inserts Common Table Expressions into a SimpleSelectQuery.
     * 
     * @param query The SimpleSelectQuery to inject CTEs into
     * @param commonTables Array of CommonTables to be inserted
     * @param needRecursive Boolean indicating if recursive WITH clause is needed
     * @returns A new SimpleSelectQuery with the injected CTEs
     */
    private injectIntoSimpleQuery(query: SimpleSelectQuery, withClause: WithClause): SimpleSelectQuery {
        // Return a new SimpleSelectQuery instance with the WithClause
        return new SimpleSelectQuery(
            withClause,
            query.selectClause,
            query.fromClause,
            query.whereClause,
            query.groupByClause,
            query.havingClause,
            query.orderByClause,
            query.windowFrameClause,
            query.rowLimitClause,
            query.forClause
        );
    }

    /**
     * Inserts Common Table Expressions into the left query of a BinarySelectQuery.
     * 
     * @param query The BinarySelectQuery to inject CTEs into
     * @param commonTables Array of CommonTables to be inserted
     * @param needRecursive Boolean indicating if recursive WITH clause is needed
     * @returns A new BinarySelectQuery with the injected CTEs
     */
    private injectIntoBinaryQuery(query: BinarySelectQuery, withClause: WithClause): BinarySelectQuery {
        // Insert CTEs into the left query
        if (query.left instanceof SimpleSelectQuery) {
            query.left = this.injectIntoSimpleQuery(query.left, withClause);
            return query;
        } else if (query.left instanceof BinarySelectQuery) {
            this.injectIntoBinaryQuery(query.left, withClause);
            return query;
        }
        throw new Error("Unsupported query type for BinarySelectQuery left side");
    }
}
