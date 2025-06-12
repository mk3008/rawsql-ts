/**
 * rawsql-ts implementation for TODO detail retrieval
 * Uses PrismaReader for advanced SQL capabilities with automatic data structuring
 */

import { PrismaClient } from '@prisma/client';
import { PrismaReader } from '../../../../packages/prisma-integration/src/PrismaReader';
import { JsonMapping } from '../../../../packages/core/src';
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
    private debugMode: boolean;

    constructor(prisma: PrismaClient, options?: { debug?: boolean }) {
        this.prisma = prisma;
        this.debugMode = options?.debug ?? false;
        this.prismaReader = new PrismaReader(prisma, {
            debug: this.debugMode,
            sqlFilesPath: './rawsql-ts'
        });
    }    /**
     * Initialize the PrismaReader
     */
    async initialize(): Promise<void> {
        await this.prismaReader.initialize();
    }

    /**
     * Create JSON mapping configuration for TODO detail serialization
     */
    private createTodoDetailJsonMapping(): JsonMapping {
        return {
            rootName: "todo",
            rootEntity: {
                id: "todo",
                name: "Todo",
                columns: {
                    "todoId": "todo_id",
                    "title": "title",
                    "description": "description",
                    "completed": "completed",
                    "createdAt": "created_at",
                    "updatedAt": "updated_at"
                }
            },
            nestedEntities: [
                // User relationship (object)
                {
                    id: "user",
                    name: "User",
                    parentId: "todo",
                    propertyName: "user",
                    relationshipType: "object",
                    columns: {
                        "userId": "user_id",
                        "userName": "user_name",
                        "email": "email",
                        "createdAt": "user_created_at"
                    }
                },
                // Category relationship (object)
                {
                    id: "category",
                    name: "Category",
                    parentId: "todo",
                    propertyName: "category",
                    relationshipType: "object",
                    columns: {
                        "categoryId": "category_id",
                        "categoryName": "category_name",
                        "color": "color",
                        "createdAt": "category_created_at"
                    }
                },
                // Comments relationship (array)
                {
                    id: "comments",
                    name: "Comment",
                    parentId: "todo",
                    propertyName: "comments",
                    relationshipType: "array",
                    columns: {
                        "commentId": "comment_id",
                        "commentText": "comment_text",
                        "createdAt": "comment_created_at"
                    }
                },
                // Comment user relationship (object)
                {
                    id: "comment_user",
                    name: "CommentUser",
                    parentId: "comments",
                    propertyName: "user",
                    relationshipType: "object",
                    columns: {
                        "userId": "comment_user_id",
                        "userName": "comment_user_name",
                        "email": "comment_user_email"
                    }
                }
            ],
            useJsonb: true,
            resultFormat: "single"
        };
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
        }; try {
            if (this.debugMode) {
                console.log('🔍 rawsql-ts Debug - Getting TODO detail for ID:', todoId);
            }            // Execute query using PrismaReader with parameter injection and JSON serialization
            const jsonMapping = this.createTodoDetailJsonMapping();
            const results = await this.prismaReader.query('getTodoDetail.sql', {
                filter: { todo_id: todoId },
                serialize: jsonMapping
            }); if (this.debugMode) {
                console.log('✅ rawsql-ts Results:', results.length, 'rows found');
            }

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

            // With JSON serialization, PrismaReader returns structured data directly
            const todoDetail = results[0] as TodoDetail;

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
