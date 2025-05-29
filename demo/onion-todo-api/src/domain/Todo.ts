/**
 * Todo entity representing a task in the domain
 */
export interface Todo {
    readonly id: number;
    readonly title: string;
    readonly description: string | null;
    readonly status: TodoStatus;
    readonly priority: TodoPriority;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

/**
 * Todo status enumeration
 */
export type TodoStatus = 'pending' | 'completed';

/**
 * Todo priority enumeration
 */
export type TodoPriority = 'low' | 'medium' | 'high';

/**
 * Search criteria for filtering todos
 */
export interface TodoSearchCriteria {
    title?: string;
    status?: TodoStatus;
    priority?: TodoPriority;
    fromDate?: Date;
    toDate?: Date;
}
