/**
 * Domain entities - Pure business objects
 * These represent the core business concepts
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
 * Todo optimized for table/list display - flattened structure
 * This avoids the need for nested objects and provides data ready for UI rendering
 */
export interface TodoTableView {
    todo_id: number;
    title: string;
    description?: string;
    status: TodoStatus;
    priority: TodoPriority;
    category_name?: string;  // Flattened from category.name
    category_color?: string; // Useful for UI styling
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Todo with all related data (for detailed views)
 */
export interface TodoDetail extends Todo {
    category?: Category;
    comments: TodoComment[];
}
