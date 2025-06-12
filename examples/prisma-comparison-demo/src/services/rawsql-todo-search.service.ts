/**
 * rawsql-ts implementation for TODO search
 * Uses PrismaReader for advanced SQL capabilities with dynamic filtering, sorting, and pagination
 */

import { PrismaClient } from '@prisma/client';
import { PrismaReader } from '../../../../packages/prisma-integration/src/PrismaReader';
import { JsonMapping } from '../../../../packages/core/src/transformers/PostgresJsonQueryBuilder';
import { TodoSearchService } from '../interfaces/todo-service.interface';
import {
    TodoSearchParams,
    TodoSearchResultWithMetrics,
    TodoListItem,
    QueryMetrics,
} from '../contracts';

export class RawSqlTodoSearchService implements TodoSearchService {
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
     * Search TODOs using rawsql-ts with dynamic filtering, sorting, and pagination
     */
    async searchTodos(params: TodoSearchParams): Promise<TodoSearchResultWithMetrics> {
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

            originalLog('🔍 rawsql-ts Debug - Executing search with:', {
                filter,
                sort,
                paging
            });

            // Define JSON mapping for hierarchical structure
            const jsonMapping: JsonMapping = {
                rootName: 'todos',
                rootEntity: {
                    id: 't',
                    name: 'todo',
                    columns: {
                        'todoId': 'todo_id',
                        'title': 'title',
                        'description': 'description',
                        'completed': 'completed',
                        'createdAt': 'created_at',
                        'updatedAt': 'updated_at',
                        'commentCount': 'comment_count'
                    }
                },
                nestedEntities: [
                    {
                        id: 'u',
                        name: 'user',
                        parentId: 't',
                        propertyName: 'user',
                        relationshipType: 'object',
                        columns: {
                            'userId': 'user_id',
                            'userName': 'user_name',
                            'email': 'email'
                        }
                    },
                    {
                        id: 'c',
                        name: 'category',
                        parentId: 't',
                        propertyName: 'category',
                        relationshipType: 'object',
                        columns: {
                            'categoryId': 'category_id',
                            'categoryName': 'category_name',
                            'color': 'color'
                        }
                    }
                ],
                resultFormat: 'array'
            };

            // Execute query using PrismaReader with JSON serialization
            const results = await this.prismaReader.query('searchTodos.sql', {
                filter,
                sort,
                paging,
                serialize: jsonMapping
            }); originalLog('✅ rawsql-ts Results:', results.length, 'items found');

            // Extract the actual todos array from JSON aggregation result
            // PostgresJsonQueryBuilder returns: [{ "todos_array": [...] }]
            // We need to extract the inner array: [...]
            const actualResults = results.length > 0 && results[0]?.todos_array
                ? results[0].todos_array
                : [];

            originalLog('📋 Extracted todos:', actualResults.length, 'items');

            // No manual transformation needed! PostgresJsonQueryBuilder handles it automatically ✨
            const todoListItems: TodoListItem[] = actualResults;

            const executionTime = Date.now() - startTime;

            // Extract SQL from logged queries
            sqlQuery = queries.length > 0 ? queries[queries.length - 1] : 'rawsql-ts query executed';            // Check if there are more results (simple estimation)
            const hasMore = actualResults.length === params.pagination.limit;

            const result = {
                items: todoListItems,
                pagination: {
                    offset: params.pagination.offset,
                    limit: params.pagination.limit,
                    hasMore,
                },
            };

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
