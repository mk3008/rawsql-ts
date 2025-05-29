import { Todo, TodoSearchCriteria } from '../domain/Todo';
import { TodoRepository } from '../domain/TodoRepository';

/**
 * Use case for searching todos with dynamic criteria
 * This class encapsulates the business logic for todo search functionality
 */
export class SearchTodosUseCase {
    constructor(private readonly todoRepository: TodoRepository) { }

    /**
     * Execute the search todos use case
     * @param criteria - Search criteria for filtering todos
     * @returns Promise resolving to an array of matching todos
     */
    async execute(criteria: TodoSearchCriteria): Promise<Todo[]> {
        // Business logic can be added here (validation, transformation, etc.)
        this.validateSearchCriteria(criteria);

        const todos = await this.todoRepository.searchTodos(criteria);

        // Additional business logic can be applied here
        return this.sortTodosByPriorityAndDate(todos);
    }

    /**
     * Validate search criteria
     * @param criteria - Search criteria to validate
     * @throws Error if criteria is invalid
     */
    private validateSearchCriteria(criteria: TodoSearchCriteria): void {
        if (criteria.fromDate && criteria.toDate && criteria.fromDate > criteria.toDate) {
            throw new Error('fromDate cannot be later than toDate');
        }

        if (criteria.title && criteria.title.trim().length === 0) {
            throw new Error('title cannot be empty when provided');
        }
    }

    /**
     * Sort todos by priority (high -> medium -> low) and then by creation date (newest first)
     * @param todos - Array of todos to sort
     * @returns Sorted array of todos
     */
    private sortTodosByPriorityAndDate(todos: Todo[]): Todo[] {
        const priorityOrder = { high: 3, medium: 2, low: 1 };

        return todos.sort((a, b) => {
            // First sort by priority (high to low)
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;

            // Then sort by creation date (newest first)
            return b.createdAt.getTime() - a.createdAt.getTime();
        });
    }
}
