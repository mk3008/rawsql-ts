import { TodoSearchCriteria, CategorySearchCriteria, CommentSearchCriteria } from '../contracts/search-criteria';

/**
 * Example domain criteria for demonstration (updated for 1:N relationships)
 * This file contains sample search criteria used across various demos
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
