/**
 * Prisma-based Todo repository implementation
 * Demonstrates the differences between raw SQL and ORM approaches
 * Uses existing database schema - works with established PostgreSQL tables
 */

import { PrismaClient } from '@prisma/client';
import { TodoSearchCriteria } from '../contracts/search-criteria';
import { Todo, TodoDetail, TodoStatus, TodoPriority } from '../domain/entities';
import { ITodoRepository } from '../contracts/repository-interfaces';

/**
 * Prisma-based Todo repository implementation using Prisma ORM
 * Comparison with RawSQL approach for different architectural patterns
 */
export class PrismaTodoRepository implements ITodoRepository {
    private prisma: PrismaClient;
    private enableDebugLogging: boolean = false;

    constructor(enableDebugLogging: boolean = false) {
        this.enableDebugLogging = enableDebugLogging;

        // Initialize Prisma client with optional logging
        this.prisma = new PrismaClient({
            log: enableDebugLogging ? ['query', 'info', 'warn', 'error'] : ['error'],
        });
    }

    /**
     * Toggle debug logging on/off
     */
    public setDebugLogging(enabled: boolean): void {
        this.enableDebugLogging = enabled;
    }

    /**
     * Unified debug logging method
     */
    private debugLog(message: string, data?: any): void {
        if (this.enableDebugLogging) {
            console.log(message);
            if (data !== undefined) console.log(data);
        }
    }

    /**
     * Convert domain criteria to Prisma where clause
     * This replaces the SQL parameter injection approach with Prisma's type-safe query building
     */
    private convertToWhereClause(criteria: TodoSearchCriteria): any {
        const whereClause: any = {};

        // Text search - Prisma handles SQL injection automatically
        if (criteria.title) {
            whereClause.title = {
                contains: criteria.title,
                mode: 'insensitive' // Case-insensitive search
            };
        }

        // Direct field matching - type-safe enum handling
        if (criteria.status) {
            whereClause.status = criteria.status;
        }

        if (criteria.priority) {
            whereClause.priority = criteria.priority;
        }

        if (criteria.categoryId) {
            whereClause.category_id = criteria.categoryId;
        }

        // Category name search via relation
        if (criteria.categoryName) {
            whereClause.category = {
                name: {
                    contains: criteria.categoryName,
                    mode: 'insensitive'
                }
            };
        }

        // Date range filtering - Prisma handles date conversion
        if (criteria.fromDate || criteria.toDate) {
            whereClause.created_at = {};

            if (criteria.fromDate) {
                whereClause.created_at.gte = criteria.fromDate;
            }

            if (criteria.toDate) {
                whereClause.created_at.lte = criteria.toDate;
            }
        }

        this.debugLog('🔄 Prisma where clause:', whereClause);
        return whereClause;
    }

    // === Core Repository Methods ===

    /**
     * Find todos matching search criteria
     * Prisma approach: Type-safe query builder with automatic SQL generation
     */
    async findByCriteria(criteria: TodoSearchCriteria): Promise<Todo[]> {
        this.debugLog('🔍 Executing findByCriteria with Prisma', criteria);

        try {
            const whereClause = this.convertToWhereClause(criteria);

            const todos = await this.prisma.todo.findMany({
                where: whereClause,
                include: {
                    category: true // Optional: include category data
                },
                orderBy: {
                    created_at: 'desc'
                }
            });

            this.debugLog(`✅ Found ${todos.length} todos with Prisma`);

            // Map Prisma result to domain entities
            return todos.map(todo => this.mapPrismaToTodo(todo));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.debugLog('❌ findByCriteria error:', error);
            throw new Error(`Failed to find todos: ${errorMessage}`);
        }
    }

    /**
     * Count todos matching search criteria
     * Prisma approach: Built-in count aggregation
     */
    async countByCriteria(criteria: TodoSearchCriteria): Promise<number> {
        this.debugLog('🔢 Executing countByCriteria with Prisma', criteria);

        try {
            const whereClause = this.convertToWhereClause(criteria);

            const count = await this.prisma.todo.count({
                where: whereClause
            });

            this.debugLog(`✅ Count result: ${count} todos`);
            return count;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.debugLog('❌ countByCriteria error:', error);
            throw new Error(`Failed to count todos: ${errorMessage}`);
        }
    }

    /**
     * Find a single todo by its unique identifier with full details
     * Prisma approach: Single query with nested includes for relations
     */
    async findById(id: string): Promise<TodoDetail | null> {
        this.debugLog('🎯 Executing findById with Prisma', { id });

        try {
            const todoId = parseInt(id, 10);
            if (isNaN(todoId)) {
                throw new Error('Invalid todo ID format');
            }

            const todo = await this.prisma.todo.findUnique({
                where: {
                    todo_id: todoId
                },
                include: {
                    category: true,
                    comments: {
                        orderBy: {
                            created_at: 'asc'
                        }
                    }
                }
            });

            if (!todo) {
                this.debugLog('❌ Todo not found');
                return null;
            }

            this.debugLog('✅ Found todo with details');
            return this.mapPrismaToTodoDetail(todo);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.debugLog('❌ findById error:', error);
            throw new Error(`Failed to find todo by ID: ${errorMessage}`);
        }
    }

    // === Additional Prisma-specific Methods ===

    /**
     * Test database connection - Prisma approach
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return true;
        } catch (error) {
            this.debugLog('❌ Connection test failed:', error);
            return false;
        }
    }

    /**
     * Close Prisma connection
     */
    async close(): Promise<void> {
        await this.prisma.$disconnect();
    }

    /**
     * Get database schema info - Prisma introspection alternative
     */
    async getDatabaseInfo(): Promise<any> {
        try {
            const tableInfo = await this.prisma.$queryRaw`
                SELECT table_name, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
            `;
            return tableInfo;
        } catch (error) {
            this.debugLog('❌ Database info query failed:', error);
            throw error;
        }
    }

    // === Private Helper Methods ===

    /**
     * Map Prisma Todo result to domain Todo entity
     * Prisma returns database field names directly, so minimal mapping needed
     */
    private mapPrismaToTodo(prismaResult: any): Todo {
        return {
            todo_id: prismaResult.todo_id,
            title: prismaResult.title,
            description: prismaResult.description,
            status: prismaResult.status as TodoStatus,
            priority: prismaResult.priority as TodoPriority,
            categoryId: prismaResult.category_id,
            createdAt: prismaResult.created_at,
            updatedAt: prismaResult.updated_at
        };
    }

    /**
     * Map Prisma detailed result to domain TodoDetail entity
     * Handles nested relations automatically loaded by Prisma
     */
    private mapPrismaToTodoDetail(prismaResult: any): TodoDetail {
        return {
            todo_id: prismaResult.todo_id,
            title: prismaResult.title,
            description: prismaResult.description,
            status: prismaResult.status as TodoStatus,
            priority: prismaResult.priority as TodoPriority,
            categoryId: prismaResult.category_id,
            createdAt: prismaResult.created_at,
            updatedAt: prismaResult.updated_at,
            category: prismaResult.category ? {
                category_id: prismaResult.category.category_id,
                name: prismaResult.category.name,
                description: prismaResult.category.description,
                color: prismaResult.category.color,
                createdAt: prismaResult.category.created_at
            } : undefined,
            comments: prismaResult.comments?.map((comment: any) => ({
                todo_comment_id: comment.todo_comment_id,
                todoId: comment.todo_id,
                content: comment.content,
                authorName: comment.author_name,
                createdAt: comment.created_at
            })) || []
        };
    }

    // === Demo Utility Methods for Comparison ===

    /**
     * Show generated SQL (for comparison with rawsql-ts approach)
     * Note: Prisma doesn't expose the exact SQL easily, this is a workaround
     */
    async showGeneratedQuery(criteria: TodoSearchCriteria): Promise<void> {
        const whereClause = this.convertToWhereClause(criteria);

        console.log('🔍 Prisma Query Object (TypeScript):');
        console.log(JSON.stringify({
            where: whereClause,
            include: {
                category: true
            },
            orderBy: {
                created_at: 'desc'
            }
        }, null, 2));

        console.log('\n📝 Note: Prisma abstracts away the SQL generation');
        console.log('   Enable query logging to see actual SQL queries');
        console.log('   Set log: ["query"] in PrismaClient constructor');
    }

    /**
     * Raw SQL execution example (showing Prisma can do both approaches)
     */
    async executeRawSQLExample(criteria: TodoSearchCriteria): Promise<any[]> {
        this.debugLog('🔧 Executing raw SQL via Prisma for comparison');

        try {
            // Example: Prisma can also execute raw SQL when needed
            const rawQuery = `
                SELECT t.*, c.name as category_name, c.color as category_color
                FROM todo t
                LEFT JOIN category c ON t.category_id = c.category_id
                WHERE ($1::text IS NULL OR t.title ILIKE $1)
                  AND ($2::text IS NULL OR t.status = $2)
                  AND ($3::text IS NULL OR t.priority = $3)
                ORDER BY t.created_at DESC
                LIMIT 100
            `;

            const titleParam = criteria.title ? `%${criteria.title}%` : null;

            const result = await this.prisma.$queryRawUnsafe(
                rawQuery,
                titleParam,
                criteria.status || null,
                criteria.priority || null
            );

            this.debugLog('✅ Raw SQL executed via Prisma');
            return result as any[];
        } catch (error) {
            this.debugLog('❌ Raw SQL execution error:', error);
            throw error;
        }
    }
}
