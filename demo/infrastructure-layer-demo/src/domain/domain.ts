/**
 * Domain layer types - Business logic focused, database agnostic
 * Demonstrates 1:N relationships with Categories and Comments
 */

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TodoPriority = 'low' | 'medium' | 'high';

/**
 * Category entity - represents todo categorization
 */
export interface Category {
    category_id: number;
    name: string;
    description?: string;
    color?: string; // Hex color code
    createdAt: Date;
}

/**
 * Todo entity with category relationship (N:1)
 */
export interface Todo {
    todo_id: number;
    title: string;
    description?: string;
    status: TodoStatus;
    priority: TodoPriority;
    categoryId?: number;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Todo with populated category (for display purposes)
 */
export interface TodoWithCategory extends Todo {
    category?: Category;
}

/**
 * Comment entity - belongs to a todo (N:1)
 */
export interface TodoComment {
    todo_comment_id: number;
    todoId: number;
    content: string;
    authorName: string;
    createdAt: Date;
}

/**
 * Todo with all related data (for detailed views)
 */
export interface TodoDetail extends Todo {
    category?: Category;
    comments: TodoComment[];
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

    /** Filter by category */
    categoryId?: number;

    /** Filter by category name */
    categoryName?: string;

    /** Search from this date (inclusive) */
    fromDate?: Date;

    /** Search to this date (inclusive) */
    toDate?: Date;
}

/**
 * Category search criteria
 */
export interface CategorySearchCriteria {
    /** Partial name search */
    name?: string;
}

/**
 * Comment search criteria
 */
export interface CommentSearchCriteria {
    /** Filter by todo ID */
    todoId?: number;

    /** Filter by author */
    authorName?: string;

    /** Search from this date (inclusive) */
    fromDate?: Date;

    /** Search to this date (inclusive) */
    toDate?: Date;
}

/**
 * Example domain criteria for demonstration (updated for 1:N relationships)
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

    // Category filter by ID
    { categoryId: 1 }, // Work category

    // Category filter by name
    { categoryName: 'Personal' },

    // Date range search
    {
        fromDate: new Date('2025-05-20'),
        toDate: new Date('2025-05-30')
    },

    // Single date boundary
    { fromDate: new Date('2025-05-25') },

    // Complex multi-field search with category
    {
        title: 'project',
        status: 'pending',
        priority: 'high',
        categoryName: 'Work',
        fromDate: new Date('2025-05-01')
    },

    // Work-related high priority tasks
    {
        categoryName: 'Work',
        priority: 'high',
        status: 'pending'
    }
];

/**
 * Example category search criteria
 */
export const exampleCategorySearchCriteria: CategorySearchCriteria[] = [
    {},
    { name: 'Work' },
    { name: 'Personal' }
];

/**
 * Example comment search criteria
 */
export const exampleCommentSearchCriteria: CommentSearchCriteria[] = [
    {},
    { todoId: 1 },
    { authorName: 'Alice Johnson' },
    { fromDate: new Date('2025-05-28') }
];
