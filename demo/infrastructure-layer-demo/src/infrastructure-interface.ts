import { TodoSearchCriteria, Todo, TodoStatus, TodoPriority } from './domain';

/**
 * Repository interface for Todo domain operations
 * 
 * This interface focuses purely on business operations, not infrastructure concerns.
 * Can be implemented by any data access technology (RawSQL, Prisma, TypeORM, etc.)
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
    countByCriteria(criteria: TodoSearchCriteria): Promise<number>;

    /**
     * Find a single todo by its unique identifier
     * @param id Todo ID
     * @returns Promise resolving to Todo or null if not found
     */
    findById(id: string): Promise<Todo | null>;

    /**
     * Create a new todo
     * @param todo Todo data (without ID, timestamps will be auto-generated)
     * @returns Promise resolving to created Todo with generated ID and timestamps
     */
    create(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo>;

    /**
     * Update an existing todo
     * @param id Todo ID to update
     * @param updates Partial todo data to update
     * @returns Promise resolving to updated Todo or null if not found
     */
    update(id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>): Promise<Todo | null>;

    /**
     * Delete a todo by ID
     * @param id Todo ID to delete
     * @returns Promise resolving to boolean indicating if deletion was successful
     */
    delete(id: string): Promise<boolean>;

    /**
     * Update todo status
     * @param id Todo ID
     * @param status New status
     * @returns Promise resolving to updated Todo or null if not found
     */
    updateStatus(id: string, status: TodoStatus): Promise<Todo | null>;

    /**
     * Update todo priority
     * @param id Todo ID
     * @param priority New priority
     * @returns Promise resolving to updated Todo or null if not found
     */
    updatePriority(id: string, priority: TodoPriority): Promise<Todo | null>;

    /**
     * Find todos by status
     * @param status Todo status to filter by
     * @returns Promise resolving to array of todos with specified status
     */
    findByStatus(status: TodoStatus): Promise<Todo[]>;

    /**
     * Find todos by priority
     * @param priority Todo priority to filter by
     * @returns Promise resolving to array of todos with specified priority
     */
    findByPriority(priority: TodoPriority): Promise<Todo[]>;
}

/**
 * Query building result for infrastructure implementations that need to expose SQL details
 * (This is implementation-specific and wouldn't be part of the main repository interface)
 */
export interface QueryBuildResult {
    formattedSql: string;
    params: unknown[];
}
