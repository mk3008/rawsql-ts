/**
 * rawsql-ts implementation for TODO detail retrieval
 * Uses PrismaReader for advanced SQL capabilities with automatic data structuring
 */

import { PrismaClient } from '@prisma/client';
import { PrismaReader } from '../../../../packages/prisma-integration/src/PrismaReader';
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
    private prismaReader: PrismaReader;
    private debugMode: boolean;

    constructor(prisma: PrismaClient, options?: { debug?: boolean }) {
        this.prisma = prisma;
        this.debugMode = options?.debug ?? false;
        this.prismaReader = new PrismaReader(prisma, {
            debug: this.debugMode,
            sqlFilesPath: './rawsql-ts'
        });
    }

    /**
     * Initialize the PrismaReader
     */
    async initialize(): Promise<void> {
        await this.prismaReader.initialize();
    }    /**
     * Execute the core SQL query with file-based JSON mapping
     */
    private async executeGetTodoDetailQuery(todoId: number): Promise<TodoDetail | null> {
        return await this.prismaReader.query<TodoDetail>('getTodoDetail.sql', {
            filter: { todo_id: todoId },
            serialize: true
        });
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
