/**
 * Simple interfaces for TODO services
 * Clean and minimal API definitions
 */

import {
    TodoSearchParams,
    TodoSearchResultWithMetrics,
    TodoDetailResultWithMetrics
} from '../contracts';

/**
 * Interface for TODO search functionality
 */
export interface TodoSearchService {
    /**
     * Initialize the service (if needed)
     */
    initialize?(): Promise<void>;

    /**
     * Search TODOs with filtering, sorting, and pagination
     */
    searchTodos(params: TodoSearchParams): Promise<TodoSearchResultWithMetrics>;
}

/**
 * Interface for TODO detail functionality
 */
export interface TodoDetailService {
    /**
     * Initialize the service (if needed)
     */
    initialize?(): Promise<void>;

    /**
     * Get detailed TODO information by ID
     */
    getTodoDetail(todoId: number): Promise<TodoDetailResultWithMetrics>;
}

/**
 * Combined interface (optional - for services that do both)
 */
export interface TodoService extends TodoSearchService, TodoDetailService {
}
