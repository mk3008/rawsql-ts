import { z } from 'zod';
import { TodoStatus, TodoPriority } from '../domain/Todo';

/**
 * Validation schema for todo search query parameters
 */
export const todoSearchQuerySchema = z.object({
    title: z.string().optional(),
    status: z.enum(['pending', 'completed']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
}).refine((data) => {
    // Validate date range if both dates are provided
    if (data.fromDate && data.toDate) {
        return new Date(data.fromDate) <= new Date(data.toDate);
    }
    return true;
}, {
    message: 'fromDate must be before or equal to toDate',
});

/**
 * Type for validated search query parameters
 */
export type TodoSearchQuery = z.infer<typeof todoSearchQuerySchema>;

/**
 * Response DTO for Todo API
 */
export interface TodoResponse {
    id: number;
    title: string;
    description: string | null;
    status: TodoStatus;
    priority: TodoPriority;
    createdAt: string;
    updatedAt: string;
}

/**
 * Response wrapper for API responses
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: string;
}

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Create an error API response
 */
export function createErrorResponse(error: string): ApiResponse<never> {
    return {
        success: false,
        error,
        timestamp: new Date().toISOString(),
    };
}
