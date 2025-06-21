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
     * Search TODOs with filtering, sorting, and pagination
     */
    searchTodos(params: TodoSearchParams): Promise<TodoSearchResultWithMetrics>;
}

/**
 * Interface for TODO detail functionality
 */
export interface TodoDetailService {
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
