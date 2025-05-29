/**
 * Domain layer types - Business logic focused, database agnostic
 */

export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type TodoPriority = 'low' | 'medium' | 'high';

/**
 * Todo entity - represents business domain object
 */
export interface Todo {
    id: number;
    title: string;
    description?: string;
    status: TodoStatus;
    priority: TodoPriority;
    createdAt: Date;
    updatedAt: Date;
}

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

    /** Search from this date (inclusive) */
    fromDate?: Date;

    /** Search to this date (inclusive) */
    toDate?: Date;
}

/**
 * Example domain criteria for demonstration
 */
export const exampleCriteria: TodoSearchCriteria[] = [
    // Empty criteria - should return all records
    {},

    // Title search only
    { title: 'project' },

    // Status filter only
    { status: 'pending' },

    // Priority filter only
    { priority: 'high' },

    // Date range search
    {
        fromDate: new Date('2025-05-20'),
        toDate: new Date('2025-05-30')
    },

    // Single date boundary
    { fromDate: new Date('2025-05-25') },

    // Complex multi-field search
    {
        title: 'project',
        status: 'pending',
        priority: 'high',
        fromDate: new Date('2025-05-01')
    }
];
