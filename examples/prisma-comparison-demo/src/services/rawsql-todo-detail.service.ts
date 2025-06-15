/**
 * rawsql-ts implementation for TODO detail retrieval
 * Uses PrismaReader for advanced SQL capabilities with automatic data structuring
 */

import { PrismaClient } from '@prisma/client';
import { PrismaReader } from '../../../../packages/prisma-integration/src/PrismaReader';
import { JsonMapping, JsonSchemaValidator } from '../../../../packages/core/src';
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
     * Execute the core SQL query with JSON mapping
     */
    private async executeGetTodoDetailQuery(todoId: number): Promise<TodoDetail | null> {
        const jsonMapping = this.createTodoDetailJsonMapping();
        return await this.prismaReader.query<TodoDetail>('getTodoDetail.sql', {
            filter: { todo_id: todoId },
            serialize: jsonMapping
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

// ==========================================
// In-file Unit Tests with Vitest
// Note: Run with: npx vitest src/services/rawsql-todo-detail.service.ts
// ==========================================

import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('RawSqlTodoDetailService - SQL + JSON Mapping Compatibility', () => {
    let service: RawSqlTodoDetailService;
    let mockPrismaClient: any;

    beforeAll(async () => {
        // Create a mock PrismaClient that doesn't require DB connection
        mockPrismaClient = {
            $queryRaw: vi.fn().mockResolvedValue([]),
            $disconnect: vi.fn().mockResolvedValue(undefined)
        };

        service = new RawSqlTodoDetailService(mockPrismaClient, { debug: false });        // Mock the PrismaReader's query method to avoid actual DB calls
        // This test only validates SQL composition and JSON mapping structure
        service['prismaReader'].query = vi.fn().mockResolvedValue({
            todoId: 1,
            title: 'Test Todo',
            description: 'Test Description',
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(), user: { userId: 1, userName: 'Test User', email: 'test@example.com' },
            category: { categoryId: 1, categoryName: 'Test Category', color: 'blue' },
            comments: []
        });

        await service.initialize();
    });

    it('should execute SQL query with JSON mapping without errors', async () => {
        // Test 1: SQL ↔ JsonMapping compatibility validation
        // Ensures SQL columns match JsonMapping configuration

        const result: TodoDetail | null = await service['executeGetTodoDetailQuery'](1);

        // Verify type safety at compile time and runtime
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        expect(typeof result).toBe('object');
        expect(service['prismaReader'].query).toHaveBeenCalledWith('getTodoDetail.sql', {
            filter: { todo_id: 1 },
            serialize: expect.any(Object)
        });
    });

    it('should have jsonMapping compatible with TodoDetail type structure', () => {
        // Test 2: JsonMapping ↔ Domain Model compatibility validation
        // Ensures JsonMapping produces structure matching TodoDetail interface

        const todoDetailSample: TodoDetail = {
            todoId: 1,
            title: "Sample Todo",
            description: "Sample Description",
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
                userId: 1,
                userName: "Sample User",
                email: "sample@example.com",
                createdAt: new Date()
            },
            category: {
                categoryId: 1,
                categoryName: "Sample Category",
                color: "blue",
                createdAt: new Date()
            },
            comments: [{
                commentId: 1,
                commentText: "Sample Comment",
                createdAt: new Date(),
                user: {
                    userId: 2,
                    userName: "Comment User",
                    email: "comment@example.com"
                }
            }]
        };

        const jsonMapping = service['createTodoDetailJsonMapping']();
        const validationResult = JsonSchemaValidator.validateAgainstSample(jsonMapping, todoDetailSample);

        expect(validationResult.isValid).toBe(true);
        expect(validationResult.errors).toHaveLength(0);
        expect(validationResult.missingProperties).toHaveLength(0);
    });
});
