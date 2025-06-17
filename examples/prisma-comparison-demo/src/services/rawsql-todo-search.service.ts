/**
 * rawsql-ts implementation for TODO search
 * Uses RawSqlClient for advanced SQL capabilities with dynamic filtering, sorting, and pagination
 */

import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '../../../../packages/prisma-integration/src/RawSqlClient';
import { TodoSearchService } from '../interfaces/todo-service.interface';
import {
    TodoSearchParams,
    TodoSearchResultWithMetrics,
    TodoListItem,
    QueryMetrics,
} from '../contracts';

export class RawSqlTodoSearchService implements TodoSearchService {
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
    }    /**
     * Initialize the RawSqlClient
     * (No longer needed - RawSqlClient uses lazy initialization)
     */
    async initialize(): Promise<void> {
        // RawSqlClient now initializes automatically when needed
        // This method is kept for backward compatibility but does nothing
    }

    /**
     * Search TODOs using rawsql-ts with dynamic filtering, sorting, and pagination
     */
    async searchTodos(params: TodoSearchParams): Promise<TodoSearchResultWithMetrics> {
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
            // Build dynamic filter conditions using correct operator syntax for SqlParamInjector
            // SqlParamInjector automatically ignores undefined values, so no conditional checks needed!
            const filter: Record<string, any> = {
                title: params.conditions.title ? { ilike: `%${params.conditions.title}%` } : undefined,
                completed: params.conditions.completed, // undefined is automatically ignored
                user_name: params.conditions.userName ? { ilike: `%${params.conditions.userName}%` } : undefined,
                category_id: params.conditions.categoryId,
                color: params.conditions.color
            };

            // Build sorting (simplified version without dynamic sorting for now)
            const sort: Record<string, any> = {
                created_at: { desc: true }
            };

            // Build pagination
            const paging = {
                page: Math.floor(params.pagination.offset / params.pagination.limit) + 1,
                pageSize: params.pagination.limit
            };

            if (this.debugMode) {
                console.log('🔍 rawsql-ts Debug - Executing search with:', {
                    filter,
                    sort,
                    paging
                });
            }

            // Execute query using RawSqlClient with file-based JSON serialization
            const queryResult = await this.client.queryMany<TodoListItem>('searchTodos.sql', {
                filter,
                sort,
                paging,
                allowAllUndefined: true  // Allow fetching all records when no filters are specified
            });

            // ExecuteScalar behavior: queryMany should return the JSON array directly
            const todoListItems = queryResult as TodoListItem[];

            if (this.debugMode) {
                originalLog('🔍 rawsql-ts Results:', todoListItems.length, 'items found');
            }

            // Extract SQL from logged queries
            const sqlQueries = queries.length > 0 ? queries : ['rawsql-ts query executed'];

            // Check if there are more results (simple estimation)
            const hasMore = todoListItems.length === params.pagination.limit;

            const result = {
                items: todoListItems,
                pagination: {
                    offset: params.pagination.offset,
                    limit: params.pagination.limit,
                    hasMore,
                },
            };

            const metrics: QueryMetrics = {
                sqlQueries,
                actualParameters: { filter, sort, paging } // Add actual parameters used by rawsql-ts
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
