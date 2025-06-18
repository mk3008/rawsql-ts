/**
 * TODO search contracts for table format listing
 */

import type { QueryMetrics } from './metrics';

/**
 * Search conditions for TODO list query
 * All fields are optional for flexible search
 */
export interface TodoSearchConditions {
    /** Partial match for TODO title */
    title?: string;
    /** Partial match for user name */
    userName?: string;
    /** Category ID filter */
    categoryId?: number;
    /** Category color filter */
    color?: string;
    /** Completion status filter */
    completed?: boolean;
    /** Date range filter - start date */
    createdAtFrom?: Date;
    /** Date range filter - end date */
    createdAtTo?: Date;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
    /** Number of records to skip */
    offset: number;
    /** Maximum number of records to return */
    limit: number;
}

/**
 * Combined search parameters
 */
export interface TodoSearchParams {
    /** Search conditions */
    conditions: TodoSearchConditions;
    /** Pagination settings */
    pagination: PaginationParams;
}

/**
 * TODO item in list format with joined data
 */
export interface TodoListItem {
    /** TODO ID */
    todoId: number;
    /** TODO title */
    title: string;
    /** TODO description */
    description: string | null;
    /** Completion status */
    completed: boolean;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
    /** Associated user information */
    user: {
        userId: number;
        userName: string;
        email: string;
    };
    /** Associated category information */
    category: {
        categoryId: number;
        categoryName: string;
        color: string | null;
    };
    /** Comment count (list view doesn't include comment details) */
    commentCount: number;
}

/**
 * Paginated search result
 */
export interface TodoSearchResult {
    /** Array of TODO items */
    items: TodoListItem[];
    /** Current page info */
    pagination: {
        offset: number;
        limit: number;
        hasMore: boolean;
    };
}

/**
 * Search result with metrics
 */
export interface TodoSearchResultWithMetrics {
    /** Search result data */
    result: TodoSearchResult;
    /** Query execution metrics */
    metrics: QueryMetrics;
}
