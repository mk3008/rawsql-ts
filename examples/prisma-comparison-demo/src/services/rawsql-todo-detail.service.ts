/**
 * rawsql-ts implementation for TODO detail retrieval
 * Uses PrismaReader for advanced SQL capabilities with automatic data structuring
 */

import { PrismaClient } from '@prisma/client';
import { PrismaReader } from '../../../../packages/prisma-integration/src/PrismaReader';
import { TodoDetailService } from '../interfaces/todo-service.interface';
import {
    TodoDetailResultWithMetrics,
    TodoDetail,
    TodoComment,
    QueryMetrics,
} from '../contracts';

export class RawSqlTodoDetailService implements TodoDetailService {
    private prisma: PrismaClient;
    private prismaReader: PrismaReader;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
        this.prismaReader = new PrismaReader(prisma, {
            debug: true,
            sqlFilesPath: './rawsql-ts'
        });
    }

    /**
     * Initialize the PrismaReader
     */
    async initialize(): Promise<void> {
        await this.prismaReader.initialize();
    }

    /**
     * Get TODO detail by ID using rawsql-ts
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
            originalLog('🔍 rawsql-ts Debug - Getting TODO detail for ID:', todoId);

            // Execute query using PrismaReader with parameter injection
            const results = await this.prismaReader.query('getTodoDetail.sql', {
                filter: { todo_id: todoId }
            });

            originalLog('✅ rawsql-ts Results:', results.length, 'rows found');

            if (results.length === 0) {
                const executionTime = Date.now() - startTime;
                sqlQuery = queries.length > 0 ? queries[queries.length - 1] : 'rawsql-ts query executed';

                const metrics: QueryMetrics = {
                    sqlQuery,
                    executionTimeMs: executionTime,
                    queryCount,
                    responseSizeBytes: 4, // null response
                };

                return {
                    result: null,
                    metrics,
                };
            }

            // Since rawsql-ts returns flat results, we need to structure the data
            // Group comments by the main TODO record
            const firstRow = results[0];
            const todoDetail: TodoDetail = {
                todoId: Number(firstRow.todo_id),
                title: firstRow.title,
                description: firstRow.description,
                completed: firstRow.completed,
                createdAt: firstRow.created_at,
                updatedAt: firstRow.updated_at,
                user: {
                    userId: Number(firstRow.user_id),
                    userName: firstRow.user_name,
                    email: firstRow.email,
                    createdAt: firstRow.user_created_at,
                },
                category: {
                    categoryId: Number(firstRow.category_id),
                    categoryName: firstRow.category_name,
                    color: firstRow.color,
                    createdAt: firstRow.category_created_at,
                },
                comments: []
            };

            // Process comments from flat results
            const comments: TodoComment[] = [];
            const commentIds = new Set<number>();

            for (const row of results) {
                if (row.comment_id && !commentIds.has(row.comment_id)) {
                    commentIds.add(row.comment_id);
                    comments.push({
                        commentId: Number(row.comment_id),
                        commentText: row.comment_text,
                        createdAt: row.comment_created_at,
                        user: {
                            userId: Number(row.comment_user_id),
                            userName: row.comment_user_name,
                            email: row.comment_user_email,
                        },
                    });
                }
            }

            todoDetail.comments = comments.sort((a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            const executionTime = Date.now() - startTime;

            // Extract SQL from logged queries
            sqlQuery = queries.length > 0 ? queries[queries.length - 1] : 'rawsql-ts query executed';

            const metrics: QueryMetrics = {
                sqlQuery,
                executionTimeMs: executionTime,
                queryCount,
                responseSizeBytes: JSON.stringify(todoDetail).length,
            };

            return {
                result: todoDetail,
                metrics,
            };
        } finally {
            // Restore original console.log
            console.log = originalLog;
        }
    }
}
