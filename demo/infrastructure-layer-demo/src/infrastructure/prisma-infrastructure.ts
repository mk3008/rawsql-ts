/**
 * Prisma-based Todo repository implementation
 * Demonstrates enterprise-grade ORM patterns with type-safe query building
 * Provides automatic SQL generation and injection protection
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { TodoSearchCriteria } from '../contracts/search-criteria';
import { Todo, TodoDetail, TodoTableView, TodoStatus, TodoPriority, Category, TodoComment } from '../domain/entities';
import { ITodoRepository } from '../contracts/repository-interfaces';
import { SqlLogger } from '../contracts/sql-logger';

/**
 * Prisma-based Todo repository implementation using advanced ORM features
 * Demonstrates type-safe query building, automatic relation handling, and SQL injection protection
 */
export class PrismaTodoRepository implements ITodoRepository {
    private prisma: PrismaClient;
    private enableDebugLogging: boolean = false;
    private sqlLogger?: SqlLogger; constructor(enableDebugLogging: boolean = false, sqlLogger?: SqlLogger) {
        this.enableDebugLogging = enableDebugLogging;
        this.sqlLogger = sqlLogger;        // Initialize Prisma client with comprehensive configuration
        this.prisma = new PrismaClient({
            log: [
                { emit: 'event', level: 'query' },
                { emit: 'stdout', level: 'error' },
                ...(enableDebugLogging ? [
                    { emit: 'stdout', level: 'info' } as const,
                    { emit: 'stdout', level: 'warn' } as const
                ] : [])
            ],
            errorFormat: 'pretty'
        });

        // Hook into Prisma query events to capture actual SQL
        if (sqlLogger) {
            this.setupQueryLogging();
        }

        this.debugLog('🔧 Prisma client initialized with enhanced logging');
    }    /**
     * Setup Prisma query event logging to capture actual SQL
     */
    private setupQueryLogging(): void {
        if (!this.sqlLogger) return;

        // Cast to access internal $on method for query logging
        const prismaClient = this.prisma as any;

        if (prismaClient.$on) {
            prismaClient.$on('query', (e: any) => {
                this.sqlLogger!.logQuery({
                    sql: e.query,
                    params: e.params ? JSON.parse(e.params) : [],
                    executionTimeMs: parseFloat(e.duration) || 0,
                    timestamp: new Date(e.timestamp),
                    queryLabel: 'Prisma Generated SQL',
                    resultMeta: {
                        hasResults: true // Prisma queries typically return results
                    }
                });
            });
        }
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
    }    /**
     * Convert domain criteria to Prisma where clause with advanced type safety
     * Demonstrates Prisma's automatic SQL injection protection and type-safe query building
     */
    private convertToWhereClause(criteria: TodoSearchCriteria): Prisma.todoWhereInput {
        const whereClause: Prisma.todoWhereInput = {};

        // Text search with automatic SQL injection protection
        if (criteria.title) {
            whereClause.title = {
                contains: criteria.title,
                mode: 'insensitive' // Case-insensitive PostgreSQL ILIKE
            };
        }

        // Enum-based filtering with compile-time type checking
        if (criteria.status) {
            whereClause.status = criteria.status;
        }

        if (criteria.priority) {
            whereClause.priority = criteria.priority;
        }        // Direct foreign key filtering
        if (criteria.categoryId) {
            whereClause.category_id = criteria.categoryId;
        }

        // Relation-based filtering through nested where clauses
        if (criteria.categoryName || criteria.categoryColor) {
            whereClause.category = {};

            if (criteria.categoryName) {
                whereClause.category.name = {
                    contains: criteria.categoryName,
                    mode: 'insensitive'
                };
            }

            if (criteria.categoryColor) {
                whereClause.category.color = {
                    equals: criteria.categoryColor
                };
            }
        }

        // Date range filtering with automatic type conversion
        if (criteria.fromDate || criteria.toDate) {
            const dateFilter: Prisma.DateTimeFilter = {};

            if (criteria.fromDate) {
                dateFilter.gte = criteria.fromDate;
            }

            if (criteria.toDate) {
                dateFilter.lte = criteria.toDate;
            }

            whereClause.created_at = dateFilter;
        }

        this.debugLog('🔄 Generated Prisma where clause:', JSON.stringify(whereClause, null, 2));
        return whereClause;
    }    // === Core Repository Methods ===

    /**
     * Find todos matching search criteria - optimized for table display
     * Prisma approach: Type-safe query builder with automatic SQL generation
     */
    async findByCriteria(criteria: TodoSearchCriteria): Promise<TodoTableView[]> {
        this.debugLog('🔍 Executing enhanced findByCriteria with Prisma', {
            criteria,
            timestamp: new Date().toISOString()
        });

        try {
            const whereClause = this.convertToWhereClause(criteria);            // Build optimized query for table display with select-based approach
            const query = {
                where: whereClause,
                select: {
                    todo_id: true,
                    title: true,
                    description: true,
                    status: true,
                    priority: true,
                    created_at: true,
                    updated_at: true,
                    category: {
                        select: {
                            name: true,
                            color: true
                        }
                    }
                },
                orderBy: [
                    {
                        priority: 'asc' as const  // This will sort high->medium->low as they are stored as enum values
                    },
                    {
                        created_at: 'desc' as const
                    }
                ]
            };

            const todos = await this.executeWithLogging(
                () => this.prisma.todo.findMany(query),
                'findByCriteria',
                whereClause
            );

            this.debugLog(`✅ Found ${todos.length} todos with Prisma`, {
                criteriaFields: Object.keys(criteria).filter(key =>
                    criteria[key as keyof TodoSearchCriteria] !== undefined
                ),
                queryComplexity: Object.keys(whereClause).length,
                resultCount: todos.length
            });            // Map to TodoTableView for optimized table display
            return todos.map((todo, index) => {
                try {
                    return this.mapPrismaToTodoTableView(todo);
                } catch (mappingError) {
                    this.debugLog(`⚠️ Mapping warning for todo at index ${index}:`, mappingError);
                    throw new Error(`Failed to map todo data for ID: ${todo.todo_id}`);
                }
            });
        } catch (error) {
            if (error instanceof Error) {
                this.debugLog(`❌ findByCriteria failed:`, {
                    error: error.message,
                    criteria,
                    stack: error.stack?.split('\n').slice(0, 3)
                });

                // Provide more specific error messages based on error type
                if (error.message.includes('connection')) {
                    throw new Error('Database connection failed. Please try again later.');
                } else if (error.message.includes('timeout')) {
                    throw new Error('Query timed out. Consider narrowing your search criteria.');
                } else {
                    throw new Error(`Failed to find todos: ${error.message}`);
                }
            }

            throw new Error(`Unexpected error in findByCriteria: ${String(error)}`);
        }
    }    /**
     * Count todos matching search criteria
     * Prisma approach: Built-in count aggregation
     */
    async countByCriteria(criteria: TodoSearchCriteria): Promise<number> {
        this.debugLog('🔢 Executing countByCriteria with Prisma', criteria);

        try {
            const whereClause = this.convertToWhereClause(criteria);

            const count = await this.executeWithLogging(
                () => this.prisma.todo.count({ where: whereClause }),
                'countByCriteria',
                whereClause
            );

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
            } const todo = await this.executeWithLogging(
                () => this.prisma.todo.findUnique({
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
                }),
                'findById',
                { todoId }
            );

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

    /**
     * Execute Prisma query with logging support
     * SQL logging is handled by query event listener, this just provides operation context
     */
    private async executeWithLogging<T>(
        operation: () => Promise<T>,
        operationName: string,
        operationDetails?: any
    ): Promise<T> {
        const startTime = performance.now();

        this.debugLog(`🔍 Executing ${operationName}`, operationDetails);

        try {
            const result = await operation();
            const executionTime = performance.now() - startTime;

            this.debugLog(`✅ ${operationName} completed in ${executionTime.toFixed(2)}ms`);

            return result;
        } catch (error) {
            const executionTime = performance.now() - startTime;
            this.debugLog(`❌ ${operationName} failed after ${executionTime.toFixed(2)}ms:`, error);
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

    /**
     * Map Prisma result to domain TodoTableView entity (optimized for table display)
     * Flattens category information for table rendering
     */
    private mapPrismaToTodoTableView(prismaResult: any): TodoTableView {
        return {
            todo_id: prismaResult.todo_id,
            title: prismaResult.title,
            description: prismaResult.description,
            status: prismaResult.status as TodoStatus,
            priority: prismaResult.priority as TodoPriority,
            category_name: prismaResult.category?.name,
            category_color: prismaResult.category?.color,
            createdAt: prismaResult.created_at,
            updatedAt: prismaResult.updated_at
        };
    }
}
