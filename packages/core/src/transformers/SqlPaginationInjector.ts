import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { LimitClause, OffsetClause } from "../models/Clause";
import { LiteralValue } from "../models/ValueComponent";
import { SelectQueryParser } from "../parsers/SelectQueryParser";

/**
 * Options for pagination injection
 */
export interface PaginationOptions {
    /** Page number (1-based) */
    page: number;
    /** Number of items per page */
    pageSize: number;
}

/**
 * SqlPaginationInjector injects pagination (LIMIT/OFFSET) into a SelectQuery model,
 * creating LIMIT and OFFSET clauses based on provided pagination options.
 */
export class SqlPaginationInjector {

    /**
     * Injects pagination as LIMIT/OFFSET clauses into the given query model.
     * @param query The SelectQuery to modify
     * @param pagination Pagination options containing page number and page size
     * @returns The modified SimpleSelectQuery with pagination applied
     */
    public inject(
        query: SimpleSelectQuery | string,
        pagination: PaginationOptions
    ): SimpleSelectQuery {
        // Validate pagination options
        this.validatePaginationOptions(pagination);

        // Convert string query to SimpleSelectQuery using SelectQueryParser if needed
        if (typeof query === 'string') {
            query = SelectQueryParser.parse(query) as SimpleSelectQuery;
        }

        // Check if query is SimpleSelectQuery
        if (!(query instanceof SimpleSelectQuery)) {
            throw new Error('Complex queries are not supported for pagination');
        }

        // Check if query already has LIMIT or OFFSET clauses
        if (query.limitClause || query.offsetClause) {
            throw new Error('Query already contains LIMIT or OFFSET clause. Use removePagination() first if you want to override existing pagination.');
        }

        // Calculate offset
        const offset = (pagination.page - 1) * pagination.pageSize;

        // Create LIMIT clause
        const limitClause = new LimitClause(
            new LiteralValue(pagination.pageSize)
        );

        // Create OFFSET clause (only if offset > 0)
        const offsetClause = offset > 0 ? new OffsetClause(
            new LiteralValue(offset)
        ) : null;

        // Create a new query with pagination clauses
        return new SimpleSelectQuery({
            withClause: query.withClause,
            selectClause: query.selectClause,
            fromClause: query.fromClause,
            whereClause: query.whereClause,
            groupByClause: query.groupByClause,
            havingClause: query.havingClause,
            orderByClause: query.orderByClause,
            windowClause: query.windowClause,
            limitClause: limitClause,
            offsetClause: offsetClause,
            fetchClause: query.fetchClause,
            forClause: query.forClause,
        });
    }

    /**
     * Removes LIMIT and OFFSET clauses from the given query.
     * @param query The SelectQuery to modify
     * @returns The modified SimpleSelectQuery with pagination removed
     */
    public static removePagination(query: SimpleSelectQuery | string): SimpleSelectQuery {
        // Convert string query to SimpleSelectQuery using SelectQueryParser if needed
        if (typeof query === 'string') {
            query = SelectQueryParser.parse(query) as SimpleSelectQuery;
        }

        // Check if query is SimpleSelectQuery
        if (!(query instanceof SimpleSelectQuery)) {
            throw new Error('Complex queries are not supported for pagination removal');
        }

        // Create a new query without LIMIT and OFFSET clauses
        return new SimpleSelectQuery({
            withClause: query.withClause,
            selectClause: query.selectClause,
            fromClause: query.fromClause,
            whereClause: query.whereClause,
            groupByClause: query.groupByClause,
            havingClause: query.havingClause,
            orderByClause: query.orderByClause,
            windowClause: query.windowClause,
            limitClause: null, // Remove LIMIT
            offsetClause: null, // Remove OFFSET
            fetchClause: query.fetchClause,
            forClause: query.forClause,
        });
    }

    /**
     * Validates pagination options
     * @param pagination Pagination options to validate
     * @throws Error if validation fails
     */
    private validatePaginationOptions(pagination: PaginationOptions): void {
        if (!pagination) {
            throw new Error('Pagination options are required');
        }

        if (typeof pagination.page !== 'number' || pagination.page < 1) {
            throw new Error('Page number must be a positive integer (1 or greater)');
        }

        if (typeof pagination.pageSize !== 'number' || pagination.pageSize < 1) {
            throw new Error('Page size must be a positive integer (1 or greater)');
        }

        // Optional: Set reasonable upper limit for page size to prevent performance issues
        if (pagination.pageSize > 1000) {
            throw new Error('Page size cannot exceed 1000 items');
        }
    }
}
