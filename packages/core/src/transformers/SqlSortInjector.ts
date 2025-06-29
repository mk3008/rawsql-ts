import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { SelectableColumnCollector } from "./SelectableColumnCollector";
import { OrderByClause, OrderByItem, SortDirection, NullsSortDirection } from "../models/Clause";
import { ValueComponent } from "../models/ValueComponent";
import { SelectQueryParser } from "../parsers/SelectQueryParser";

/**
 * SqlSortInjector injects sort conditions into a SelectQuery model,
 * creating ORDER BY clauses based on provided sort conditions.
 */
export class SqlSortInjector {
    private tableColumnResolver?: (tableName: string) => string[];

    constructor(tableColumnResolver?: (tableName: string) => string[]) {
        this.tableColumnResolver = tableColumnResolver;
    }

    /**
     * Removes ORDER BY clause from the given query.
     * @param query The SelectQuery to modify
     * @returns The modified SimpleSelectQuery with ORDER BY clause removed
     */
    public static removeOrderBy(query: SimpleSelectQuery | string): SimpleSelectQuery {
        // Convert string query to SimpleSelectQuery using SelectQueryParser if needed
        if (typeof query === 'string') {
            query = SelectQueryParser.parse(query) as SimpleSelectQuery;
        }

        // Check if query is SimpleSelectQuery
        if (!(query instanceof SimpleSelectQuery)) {
            throw new Error('Complex queries are not supported for ORDER BY removal');
        }

        // Create a new query without ORDER BY clause
        return new SimpleSelectQuery({
            withClause: query.withClause,
            selectClause: query.selectClause,
            fromClause: query.fromClause,
            whereClause: query.whereClause,
            groupByClause: query.groupByClause,
            havingClause: query.havingClause,
            orderByClause: null, // Remove ORDER BY
            windowClause: query.windowClause,
            limitClause: query.limitClause,
            offsetClause: query.offsetClause,
            fetchClause: query.fetchClause,
            forClause: query.forClause,
        });
    }

    /**
     * Injects sort conditions as ORDER BY clauses into the given query model.
     * Appends to existing ORDER BY clause if present.
     * @param query The SelectQuery to modify
     * @param sortConditions A record of column names and sort conditions
     * @returns The modified SimpleSelectQuery
     */
    public inject(
        query: SimpleSelectQuery | string,
        sortConditions: SortConditions
    ): SimpleSelectQuery {
        // Convert string query to SimpleSelectQuery using SelectQueryParser if needed
        if (typeof query === 'string') {
            query = SelectQueryParser.parse(query) as SimpleSelectQuery;
        }

        // Check if query is SimpleSelectQuery
        if (!(query instanceof SimpleSelectQuery)) {
            throw new Error('Complex queries are not supported for sorting');
        }

        // Collect available columns from the current query only (no upstream search)
        const collector = new SelectableColumnCollector(this.tableColumnResolver);
        const availableColumns = collector.collect(query);

        // Validate that all specified columns exist
        for (const columnName of Object.keys(sortConditions)) {
            const columnEntry = availableColumns.find(item => item.name === columnName);
            if (!columnEntry) {
                throw new Error(`Column or alias '${columnName}' not found in current query`);
            }
        }

        // Build new ORDER BY items
        const newOrderByItems: OrderByItem[] = [];

        for (const [columnName, condition] of Object.entries(sortConditions)) {
            const columnEntry = availableColumns.find(item => item.name === columnName);
            if (!columnEntry) continue; // Should not happen due to validation above

            const columnRef = columnEntry.value;

            // Validate condition
            this.validateSortCondition(columnName, condition);

            // Determine sort direction
            let sortDirection: SortDirection;
            if (condition.desc) {
                sortDirection = SortDirection.Descending;
            } else {
                sortDirection = SortDirection.Ascending; // Default to ASC
            }

            // Determine nulls position
            let nullsPosition: NullsSortDirection | null = null;
            if (condition.nullsFirst) {
                nullsPosition = NullsSortDirection.First;
            } else if (condition.nullsLast) {
                nullsPosition = NullsSortDirection.Last;
            }

            // Create OrderByItem
            const orderByItem = new OrderByItem(columnRef, sortDirection, nullsPosition);
            newOrderByItems.push(orderByItem);
        }

        // Combine with existing ORDER BY clause if present
        let finalOrderByItems: (OrderByItem | ValueComponent)[] = [];

        if (query.orderByClause) {
            // Append to existing ORDER BY
            finalOrderByItems = [...query.orderByClause.order, ...newOrderByItems];
        } else {
            // Create new ORDER BY
            finalOrderByItems = newOrderByItems;
        }

        // Create new OrderByClause
        const newOrderByClause = finalOrderByItems.length > 0
            ? new OrderByClause(finalOrderByItems)
            : null;

        // Create new query with updated ORDER BY clause
        return new SimpleSelectQuery({
            withClause: query.withClause,
            selectClause: query.selectClause,
            fromClause: query.fromClause,
            whereClause: query.whereClause,
            groupByClause: query.groupByClause,
            havingClause: query.havingClause,
            orderByClause: newOrderByClause,
            windowClause: query.windowClause,
            limitClause: query.limitClause,
            offsetClause: query.offsetClause,
            fetchClause: query.fetchClause,
            forClause: query.forClause,
        });
    }

    /**
     * Validates sort condition for a column
     */
    private validateSortCondition(columnName: string, condition: SortCondition): void {
        // Check for conflicting sort directions
        if (condition.asc && condition.desc) {
            throw new Error(`Conflicting sort directions for column '${columnName}': both asc and desc specified`);
        }

        // Check for conflicting nulls positions
        if (condition.nullsFirst && condition.nullsLast) {
            throw new Error(`Conflicting nulls positions for column '${columnName}': both nullsFirst and nullsLast specified`);
        }

        // Check if at least one option is specified
        if (!condition.asc && !condition.desc && !condition.nullsFirst && !condition.nullsLast) {
            throw new Error(`Empty sort condition for column '${columnName}': at least one sort option must be specified`);
        }
    }
}

// Type definitions
export type SortCondition = {
    asc?: boolean;
    desc?: boolean;
    nullsFirst?: boolean;
    nullsLast?: boolean;
};

export type SortConditions = {
    [columnName: string]: SortCondition;
};
