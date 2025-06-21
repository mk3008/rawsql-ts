/**
 * TODO detail contracts for single record retrieval
 */

import type { QueryMetrics } from './metrics';

/**
 * TODO detail with full information
 */
export interface TodoDetail {
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
        createdAt: Date;
    };
    /** Associated category information */
    category: {
        categoryId: number;
        categoryName: string;
        color: string | null;
        createdAt: Date;
    };
    /** All comments for this TODO */
    comments: TodoComment[];
}

/**
 * TODO comment information
 */
export interface TodoComment {
    /** Comment ID */
    commentId: number;
    /** Comment text */
    commentText: string;
    /** Creation timestamp */
    createdAt: Date;
    /** Comment author information */
    commentUser: {
        userId: number;
        userName: string;
        email: string;
    };
}

/**
 * TODO detail result with metrics
 */
export interface TodoDetailResultWithMetrics {
    /** TODO detail data (null if not found) */
    result: TodoDetail | null;
    /** Query execution metrics */
    metrics: QueryMetrics;
}
