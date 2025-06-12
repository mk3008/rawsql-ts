/**
 * Prisma ORM implementation for TODO detail retrieval
 */

import { PrismaClient } from '@prisma/client';
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
     */
    async initialize(): Promise<void> {
        // Prisma is already initialized via constructor
        // This method exists to satisfy the interface
    }

    /**
     * Get TODO detail by ID using Prisma ORM with nested includes
     */
    async getTodoDetail(todoId: number): Promise<TodoDetailResultWithMetrics> {
        const startTime = Date.now();
        let queryCount = 0;
        let sqlQuery = '';

        // Enable query logging to capture SQL
        const originalLog = console.log;
        const queries: string[] = [];
        console.log = (...args: any[]) => {
            const message = args.join(' ');
            if (message.includes('prisma:query')) {
                queries.push(message);
                queryCount++;
            }
            originalLog(...args);
        };

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
            });

            const executionTime = Date.now() - startTime;

            // Extract SQL from logged queries
            sqlQuery = queries.length > 0 ? queries.join('\n') : 'No SQL captured';

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
                sqlQuery,
                executionTimeMs: executionTime,
                queryCount,
                responseSizeBytes: JSON.stringify(result).length,
            };

            return {
                result,
                metrics,
            };
        } finally {
            // Restore original console.log
            console.log = originalLog;
        }
    }
}
