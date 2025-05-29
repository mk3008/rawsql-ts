import { TodoSearchCriteria, Todo } from './domain';

/**
 * Infrastructure layer interface for Todo operations
 * Defines the contract for different infrastructure implementations
 */
export interface ITodoInfrastructureService {
    /**
     * Test infrastructure connection
     * @returns Promise resolving to connection status
     */
    testConnection(): Promise<boolean>;

    /**
     * Close infrastructure resources
     */
    close(): Promise<void>;

    /**
     * Search todos based on criteria
     * @param criteria Domain search criteria
     * @returns Promise resolving to array of Todo entities
     */
    searchTodos(criteria: TodoSearchCriteria): Promise<Todo[]>;

    /**
     * Get total count of todos matching criteria
     * @param criteria Domain search criteria
     * @returns Promise resolving to count
     */
    countTodos(criteria: TodoSearchCriteria): Promise<number>;
}

/**
 * Query building result for infrastructure implementations
 */
export interface QueryBuildResult {
    formattedSql: string;
    params: unknown[];
}
