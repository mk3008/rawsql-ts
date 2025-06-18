/**
 * Prisma ORM implementation for TODO search
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
    TodoSearchParams,
    TodoSearchResultWithMetrics,
    TodoListItem,
    QueryMetrics,
} from '../contracts';
import { TodoSearchService } from '../interfaces/todo-service.interface';

export class PrismaTodoSearchService implements TodoSearchService {
    private prisma: PrismaClient; constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Initialize the Prisma service (optional)
     */
    async initialize(): Promise<void> {
        // Prisma is already initialized via constructor
        // This method exists to satisfy the interface
    }    /**
     * Search TODOs using Prisma ORM with include and where conditions
     */
    async searchTodos(params: TodoSearchParams): Promise<TodoSearchResultWithMetrics> {        // Build where conditions
        const where: Prisma.TodoWhereInput = {};

        if (params.conditions.title) {
            where.title = {
                contains: params.conditions.title,
                mode: 'insensitive',
            };
        }

        if (params.conditions.completed !== undefined) {
            where.completed = params.conditions.completed;
        }

        if (params.conditions.categoryId) {
            where.category_id = params.conditions.categoryId;
        }

        if (params.conditions.color) {
            where.category = {
                color: params.conditions.color,
            };
        }

        if (params.conditions.userName) {
            where.user = {
                user_name: {
                    contains: params.conditions.userName,
                    mode: 'insensitive',
                },
            };
        }

        if (params.conditions.createdAtFrom || params.conditions.createdAtTo) {
            where.created_at = {};
            if (params.conditions.createdAtFrom) {
                where.created_at.gte = params.conditions.createdAtFrom;
            }
            if (params.conditions.createdAtTo) {
                where.created_at.lte = params.conditions.createdAtTo;
            }
        }

        // Capture SQL queries using Prisma's query event listener
        const queries: string[] = [];
        const queryListener = (event: { query: string }) => {
            queries.push(event.query);
        };
        (this.prisma as any).$on('query', queryListener);

        try {
            // Fetch todos with related data + one extra to check hasMore
            const todos = await this.prisma.todo.findMany({
                where,
                include: {
                    user: {
                        select: {
                            user_id: true,
                            user_name: true,
                            email: true,
                        },
                    },
                    category: {
                        select: {
                            category_id: true,
                            category_name: true,
                            color: true,
                        },
                    },
                    _count: {
                        select: {
                            comments: true,
                        },
                    },
                },
                orderBy: [
                    { created_at: 'desc' },
                    { todo_id: 'desc' },
                ],
                skip: params.pagination.offset,
                take: params.pagination.limit + 1, // +1 to check hasMore
            });

            // Determine if there are more results
            const hasMore = todos.length > params.pagination.limit;
            const items = hasMore ? todos.slice(0, -1) : todos;      // Transform to contract format
            const todoListItems: TodoListItem[] = items.map((todo: any) => ({
                todoId: todo.todo_id,
                title: todo.title,
                description: todo.description,
                completed: todo.completed,
                createdAt: todo.created_at,
                updatedAt: todo.updated_at,
                user: {
                    userId: todo.user.user_id,
                    userName: todo.user.user_name,
                    email: todo.user.email,
                },
                category: {
                    categoryId: todo.category.category_id,
                    categoryName: todo.category.category_name,
                    color: todo.category.color,
                },
                commentCount: todo._count.comments,
            }));

            // Extract SQL from logged queries
            const sqlQueries = queries.length > 0 ? queries : ['No SQL captured'];

            const result = {
                items: todoListItems,
                pagination: {
                    offset: params.pagination.offset,
                    limit: params.pagination.limit,
                    hasMore,
                },
            };

            const metrics: QueryMetrics = {
                sqlQueries
            }; return {
                result,
                metrics,
            };
        } finally {
            // Remove the query listener to prevent memory leaks
            // Note: Prisma doesn't have an $off method, but listeners are automatically cleaned up
            // when the Prisma instance is disposed or the connection is closed
        }
    }
}
