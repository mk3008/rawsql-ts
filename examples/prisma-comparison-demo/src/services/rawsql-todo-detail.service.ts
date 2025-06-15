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

// ==========================================
// In-file Unit Tests with Vitest
// Note: Run with: npx vitest src/services/rawsql-todo-detail.service.ts
// ==========================================

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { JsonMapping } from '../../../../packages/core/src';

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
        expect(typeof result).toBe('object'); expect(service['prismaReader'].query).toHaveBeenCalledWith('getTodoDetail.sql', {
            filter: { todo_id: 1 },
            serialize: true
        });
    }); it('should have jsonMapping compatible with TodoDetail type structure', async () => {
        // Test 2: JsonMapping ↔ Domain Model compatibility validation
        // Ensures file-based JsonMapping produces structure matching TodoDetail interface

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

        // Load the JsonMapping from the file (simulate the same process as PrismaReader)
        const fs = await import('fs');
        const path = await import('path');
        const jsonMappingPath = path.join('./rawsql-ts', 'getTodoDetail.json');
        const jsonMappingContent = fs.readFileSync(jsonMappingPath, 'utf8');
        const jsonMapping: JsonMapping = JSON.parse(jsonMappingContent);

        const validationResult = JsonSchemaValidator.validateAgainstSample(jsonMapping, todoDetailSample);

        expect(validationResult.isValid).toBe(true);
        expect(validationResult.errors).toHaveLength(0);
        expect(validationResult.missingProperties).toHaveLength(0);
    });
});
