/**
 * rawsql-ts implementation for TODO detail retrieval
 * Uses RawSqlClient for advanced SQL capabilities with automatic data structuring
 */

import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '../../../../packages/prisma-integration/src/RawSqlClient';
import { JsonSchemaValidator } from '../../../../packages/core/src';
import { TodoDetailService } from '../interfaces/todo-service.interface';
import {
    TodoDetailResultWithMetrics,
    TodoDetail,
    TodoComment,
    QueryMetrics,
} from '../contracts';

export class RawSqlTodoDetailService implements TodoDetailService {
    private prisma: PrismaClient;
    private client: RawSqlClient;
    private debugMode: boolean;

    constructor(prisma: PrismaClient, options?: { debug?: boolean }) {
        this.prisma = prisma;
        this.debugMode = options?.debug ?? false;
        this.client = new RawSqlClient(prisma, {
            debug: this.debugMode,
            sqlFilesPath: './rawsql-ts'
        });
    }

    /**
     * Initialize the RawSqlClient
     * (No longer needed - RawSqlClient uses lazy initialization)
     */
    async initialize(): Promise<void> {
        // RawSqlClient now initializes automatically when needed
        // This method is kept for backward compatibility but does nothing
    }

    /**
     * Execute the core SQL query with file-based JSON mapping
     */
    private async executeGetTodoDetailQuery(todoId: number): Promise<TodoDetail | null> {
        const result = await this.client.queryOne<TodoDetail>('todos/getTodoDetail.sql', {
            filter: { todo_id: todoId },
        });

        // Debug the query result structure
        if (this.debugMode) {
            console.log('🔍 Debug - Todo structure:', JSON.stringify(result, null, 2));
        }

        // ExecuteScalar behavior: queryOne should return the JSON object directly
        return result;
    }

    /**
     * Get TODO detail by ID using rawsql-ts
     */
    async getTodoDetail(todoId: number): Promise<TodoDetailResultWithMetrics> {
        // Enable query logging to capture SQL
        const originalLog = console.log;
        const queries: string[] = [];
        console.log = (...args: any[]) => {
            const message = args.join(' ');
            if (message.includes('prisma:query')) {
                queries.push(message);
            }
            originalLog(...args);
        };

        try {
            if (this.debugMode) {
                console.log('🔍 rawsql-ts Debug - Getting TODO detail for ID:', todoId);
            }

            // Execute query using the extracted core method
            const todoDetail = await this.executeGetTodoDetailQuery(todoId);

            if (this.debugMode) {
                console.log('✅ rawsql-ts Results:', todoDetail ? 'found' : 'not found');
            }

            if (todoDetail === null) {
                const sqlQueries = queries.length > 0 ? queries : ['rawsql-ts query executed'];

                const metrics: QueryMetrics = {
                    sqlQueries
                };

                return {
                    result: null,
                    metrics,
                };
            }

            // Extract SQL from logged queries
            const sqlQueries = queries.length > 0 ? queries : ['rawsql-ts query executed'];

            const metrics: QueryMetrics = {
                sqlQueries
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
