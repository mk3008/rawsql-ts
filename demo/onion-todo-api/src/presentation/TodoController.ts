import { Hono } from 'hono';
import { SearchTodosUseCase } from '../application/SearchTodosUseCase';
import { TodoSearchCriteria } from '../domain/Todo';
import {
    todoSearchQuerySchema,
    TodoResponse,
    createSuccessResponse,
    createErrorResponse
} from './dto';

/**
 * Todo controller handling HTTP requests for todo operations
 * This controller follows the onion architecture by depending only on use cases
 */
export class TodoController {
    private app: Hono;

    constructor(private readonly searchTodosUseCase: SearchTodosUseCase) {
        this.app = new Hono();
        this.setupRoutes();
    }

    /**
     * Setup API routes
     */
    private setupRoutes(): void {
        // GET /todos/search - Search todos with optional query parameters
        this.app.get('/todos/search', async (c) => {
            try {
                // Extract and validate query parameters
                const queryParams = c.req.query();

                // Manual validation since we might not have zod working yet
                const searchCriteria: TodoSearchCriteria = {};

                if (queryParams.title) {
                    searchCriteria.title = queryParams.title;
                }

                if (queryParams.status) {
                    if (queryParams.status === 'pending' || queryParams.status === 'completed') {
                        searchCriteria.status = queryParams.status;
                    } else {
                        return c.json(createErrorResponse('Invalid status. Must be "pending" or "completed"'), 400);
                    }
                }

                if (queryParams.priority) {
                    if (['low', 'medium', 'high'].includes(queryParams.priority)) {
                        searchCriteria.priority = queryParams.priority as 'low' | 'medium' | 'high';
                    } else {
                        return c.json(createErrorResponse('Invalid priority. Must be "low", "medium", or "high"'), 400);
                    }
                }

                if (queryParams.fromDate) {
                    try {
                        searchCriteria.fromDate = new Date(queryParams.fromDate);
                        if (isNaN(searchCriteria.fromDate.getTime())) {
                            return c.json(createErrorResponse('Invalid fromDate format. Use ISO 8601 format'), 400);
                        }
                    } catch {
                        return c.json(createErrorResponse('Invalid fromDate format. Use ISO 8601 format'), 400);
                    }
                }

                if (queryParams.toDate) {
                    try {
                        searchCriteria.toDate = new Date(queryParams.toDate);
                        if (isNaN(searchCriteria.toDate.getTime())) {
                            return c.json(createErrorResponse('Invalid toDate format. Use ISO 8601 format'), 400);
                        }
                    } catch {
                        return c.json(createErrorResponse('Invalid toDate format. Use ISO 8601 format'), 400);
                    }
                }

                // Validate date range
                if (searchCriteria.fromDate && searchCriteria.toDate &&
                    searchCriteria.fromDate > searchCriteria.toDate) {
                    return c.json(createErrorResponse('fromDate must be before or equal to toDate'), 400);
                }

                // Execute use case
                const todos = await this.searchTodosUseCase.execute(searchCriteria);

                // Convert to response DTOs
                const todoResponses: TodoResponse[] = todos.map(todo => ({
                    id: todo.id,
                    title: todo.title,
                    description: todo.description,
                    status: todo.status,
                    priority: todo.priority,
                    createdAt: todo.createdAt.toISOString(),
                    updatedAt: todo.updatedAt.toISOString(),
                }));

                return c.json(createSuccessResponse(todoResponses));

            } catch (error) {
                console.error('Error searching todos:', error);

                if (error instanceof Error) {
                    return c.json(createErrorResponse(error.message), 400);
                }

                return c.json(createErrorResponse('Internal server error'), 500);
            }
        });

        // Health check endpoint
        this.app.get('/health', (c) => {
            return c.json(createSuccessResponse({
                status: 'healthy',
                service: 'onion-todo-api',
                version: '1.0.0'
            }));
        });

        // API documentation endpoint
        this.app.get('/docs', (c) => {
            const docs = {
                title: 'Onion Todo API',
                description: 'A demonstration of Onion Architecture using Hono, PostgreSQL, and rawsql-ts',
                endpoints: {
                    'GET /todos/search': {
                        description: 'Search todos with optional filters',
                        queryParameters: {
                            title: 'string (optional) - Filter by title (partial match)',
                            status: 'string (optional) - Filter by status (pending/completed)',
                            priority: 'string (optional) - Filter by priority (low/medium/high)',
                            fromDate: 'string (optional) - Filter todos created after this date (ISO 8601)',
                            toDate: 'string (optional) - Filter todos created before this date (ISO 8601)'
                        },
                        example: '/todos/search?title=meeting&status=pending&priority=high'
                    },
                    'GET /health': {
                        description: 'Health check endpoint'
                    }
                }
            };

            return c.json(createSuccessResponse(docs));
        });
    }

    /**
     * Get the Hono app instance
     */
    getApp(): Hono {
        return this.app;
    }
}
