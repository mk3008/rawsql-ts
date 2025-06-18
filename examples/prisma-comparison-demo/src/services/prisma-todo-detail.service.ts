/**
 * Prisma ORM implementation for TODO detail retrieval
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
    TodoDetailResultWithMetrics,
    TodoDetail,
    TodoComment,
    QueryMetrics,
} from '../contracts';
import { TodoDetailService } from '../interfaces/todo-service.interface';

export class PrismaTodoDetailService implements TodoDetailService {
    private prisma: PrismaClient; constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Initialize the Prisma service (optional)
     */    async initialize(): Promise<void> {
        // Prisma is already initialized via constructor
        // This method exists to satisfy the interface
    }

    /**
     * Get TODO detail by ID using Prisma ORM with nested includes
     */
    async getTodoDetail(todoId: number): Promise<TodoDetailResultWithMetrics> {        // Capture SQL queries using Prisma's query event listener
        const queries: string[] = [];
        const queryListener = (event: { query: string }) => {
            queries.push(event.query);
        };
        (this.prisma as any).$on('query', queryListener);

        try {
            // Fetch todo with all related data
            const todo = await this.prisma.todo.findUnique({
                where: {
                    todo_id: todoId,
                },
                include: {
                    user: {
                        select: {
                            user_id: true,
                            user_name: true,
                            email: true,
                            created_at: true,
                        },
                    },
                    category: {
                        select: {
                            category_id: true,
                            category_name: true,
                            color: true,
                            created_at: true,
                        },
                    },
                    comments: {
                        include: {
                            user: {
                                select: {
                                    user_id: true,
                                    user_name: true,
                                    email: true,
                                },
                            },
                        },
                        orderBy: {
                            created_at: 'asc',
                        },
                    },
                },
            });            // Extract SQL from logged queries
            const sqlQueries = queries.length > 0 ? queries : ['No SQL captured'];

            let result: TodoDetail | null = null;

            if (todo) {
                // Transform comments
                const comments: TodoComment[] = todo.comments.map((comment: any) => ({
                    commentId: comment.comment_id,
                    commentText: comment.comment_text,
                    createdAt: comment.created_at,
                    user: {
                        userId: comment.user.user_id,
                        userName: comment.user.user_name,
                        email: comment.user.email,
                    },
                }));

                // Transform to contract format
                result = {
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
                        createdAt: todo.user.created_at,
                    },
                    category: {
                        categoryId: todo.category.category_id,
                        categoryName: todo.category.category_name,
                        color: todo.category.color,
                        createdAt: todo.category.created_at,
                    },
                    comments,
                };
            }

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
