/**
 * Search criteria contracts - Define how different layers communicate
 * These represent the contracts between application and infrastructure layers
 */

import { TodoStatus, TodoPriority } from '../domain/entities';

/**
 * Domain search criteria - represents business requirements
 * This is what the business layer understands and works with
 */
export interface TodoSearchCriteria {
    /** Partial title search */
    title?: string;

    /** Exact status match */
    status?: TodoStatus;

    /** Exact priority match */
    priority?: TodoPriority;

    /** Filter by category */
    categoryId?: number;

    /** Filter by category name */
    categoryName?: string;

    /** Filter by category color (hex color code) */
    categoryColor?: string;

    /** Search from this date (inclusive) */
    fromDate?: Date;

    /** Search to this date (inclusive) */
    toDate?: Date;
}

/**
 * Category search criteria
 */
export interface CategorySearchCriteria {
    /** Partial name search */
    name?: string;
}

/**
 * Comment search criteria
 */
export interface CommentSearchCriteria {
    /** Filter by todo ID */
    todoId?: number;

    /** Filter by author */
    authorName?: string;

    /** Search from this date (inclusive) */
    fromDate?: Date;

    /** Search to this date (inclusive) */
    toDate?: Date;
}
