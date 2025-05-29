import { Todo, TodoSearchCriteria } from './Todo';

/**
 * Repository interface for Todo entities
 * This interface defines the contract for data access operations
 */
export interface TodoRepository {
    /**
     * Search todos based on the provided criteria
     * @param criteria - Search criteria for filtering todos
     * @returns Promise resolving to an array of matching todos
     */
    searchTodos(criteria: TodoSearchCriteria): Promise<Todo[]>;
}
