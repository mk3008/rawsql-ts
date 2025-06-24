/**
 * rawsql-ts implementation for TODO detail retrieval
 * Uses RawSqlClient for advanced SQL capabilities with automatic data structuring
 */

import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '../../../../packages/prisma-integration/src/RawSqlClient';
import { JsonSchemaValidator } from '../../../../packages/core/src';
import { TodoDetailService } from '../interfaces/todo-service.interface';
import * as path from 'path';
import {
    TodoDetailResultWithMetrics,
    TodoDetail,
    TodoComment,
    QueryMetrics,
} from '../contracts';

export class RawSqlTodoDetailService implements TodoDetailService {
    private prisma: PrismaClient;
    private client: RawSqlClient | null = null;
    private debugMode: boolean;
    private isInitialized: boolean = false;
    private schemaPreloaded: boolean = false;
    private disableResolver: boolean; constructor(prisma: PrismaClient, options?: { debug?: boolean; preloadSchema?: boolean; disableResolver?: boolean }) {
        this.prisma = prisma;
        this.debugMode = options?.debug ?? false;
        this.disableResolver = options?.disableResolver ?? false;
        // Don't initialize RawSqlClient here - use lazy initialization        
        // By default, preload schema for optimal performance (can be disabled if needed)
        // Skip preloading if resolver is disabled
        if (options?.preloadSchema !== false && !this.disableResolver) {
            this.preloadSchemaAsync();
        }
    }

    /**
     * Asynchronously preload schema in background for production optimization
     * This reduces first-query latency without blocking constructor
     */
    private async preloadSchemaAsync(): Promise<void> {
        try {
            if (this.debugMode) {
                console.log('🚀 [Production] Pre-loading schema in background...');
            }

            await this.ensureInitialized();

            if (this.client) {
                await this.client.initializeSchema();
                this.schemaPreloaded = true;

                if (this.debugMode) {
                    console.log('✅ [Production] Schema pre-loaded successfully');
                }
            }
        } catch (error) {
            if (this.debugMode) {
                console.warn('⚠️ [Production] Schema pre-loading failed:', error);
            }
        }
    }

    /**
     * Initialize RawSqlClient only when needed (lazy initialization)
     * This prevents heavy schema parsing during service construction
     */
    private async ensureInitialized(): Promise<void> {
        if (this.isInitialized && this.client) {
            return;
        }

        if (this.debugMode) {
            console.log('🔧 Initializing rawsql-ts client (function-based lazy resolver)...');
        } const startTime = performance.now();
        // Use absolute path for cross-platform compatibility
        const sqlFilesPath = path.join(__dirname, '..', '..', 'rawsql-ts');
        this.client = new RawSqlClient(this.prisma, {
            debug: this.debugMode,
            sqlFilesPath: sqlFilesPath,
            disableResolver: this.disableResolver
        });

        // Simply initialize without forcing a query
        // The lazy resolver will handle schema loading when actually needed

        const endTime = performance.now();
        this.isInitialized = true;

        if (this.debugMode) {
            console.log(`✅ rawsql-ts client initialized in ${(endTime - startTime).toFixed(2)}ms`);
        }
    }

    /**
     * Execute the core SQL query with file-based JSON mapping
     * Uses queryOne now that the GROUP BY aggregation issue is fixed
     */
    private async executeGetTodoDetailQuery(todoId: number): Promise<TodoDetail | null> {
        // Ensure client is initialized before use
        await this.ensureInitialized();

        // Use queryOne for proper aggregation now that GROUP BY is fixed
        const result = await this.client!.queryOne<TodoDetail>('todos/getTodoDetail.sql', {
            filter: { todo_id: todoId },
        });

        if (this.debugMode && result) {
            console.log('🔍 Debug - Comments count:', result.comments?.length || 0);
        }

        return result;
    }

    /**
     * Get TODO detail by ID using rawsql-ts
     */
    async getTodoDetail(todoId: number): Promise<TodoDetailResultWithMetrics> {
        // Ensure initialization before executing query
        await this.ensureInitialized();

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
