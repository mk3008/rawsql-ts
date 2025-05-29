import { TodoSearchCriteria, Todo, TodoDetail } from './domain';

/**
 * Repository interface for Todo domain operations (Query-focused for demonstration)
 * 
 * This interface focuses purely on query operations for testing rawsql-ts capabilities.
 * All find operations can be handled through findByCriteria with appropriate criteria.
 */
export interface ITodoRepository {
    /**
     * Find todos based on search criteria
     * @param criteria Domain search criteria
     * @returns Promise resolving to array of Todo entities
     */
    findByCriteria(criteria: TodoSearchCriteria): Promise<Todo[]>;

    /**
     * Count todos matching search criteria
     * @param criteria Domain search criteria
     * @returns Promise resolving to total count
     */
    countByCriteria(criteria: TodoSearchCriteria): Promise<number>;    /**
     * Find a single todo by its unique identifier with full details (category + comments)
     * @param id Todo ID
     * @returns Promise resolving to TodoDetail with related data or null if not found
     */
    findById(id: string): Promise<TodoDetail | null>;
}

/**
 * Query building result for infrastructure implementations that need to expose SQL details
 * (This is implementation-specific and wouldn't be part of the main repository interface)
 */
export interface QueryBuildResult {
    formattedSql: string;
    params: unknown[];
}
