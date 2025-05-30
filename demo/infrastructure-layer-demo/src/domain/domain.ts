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
