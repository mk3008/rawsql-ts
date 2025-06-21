import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaSchemaResolver } from '@msugiura/rawsql-prisma';

/**
 * Integration tests for PrismaSchemaResolver using real Prisma environment
 * 
 * These tests use the actual schema.prisma file and PrismaClient instance
 * from the prisma-comparison-demo project, providing realistic testing
 * without mocking external dependencies.
 */
describe('PrismaSchemaResolver Integration Tests', () => {
    let prisma: PrismaClient;
    let resolver: PrismaSchemaResolver;

    beforeAll(async () => {
        // Initialize real PrismaClient
        prisma = new PrismaClient();

        // Create resolver with debug enabled for better visibility
        resolver = new PrismaSchemaResolver({
            debug: true,
            defaultSchema: 'public'
        });
    });

    describe('Schema Resolution', () => {
        it('should successfully resolve schema from real Prisma environment', async () => {
            const schemaInfo = await resolver.resolveSchema(prisma);

            expect(schemaInfo).toBeDefined();
            expect(schemaInfo.models).toBeDefined();
            expect(schemaInfo.schemaName).toBe('public');

            // Check that we have the expected models from schema.prisma
            expect(schemaInfo.models).toHaveProperty('User');
            expect(schemaInfo.models).toHaveProperty('Category');
            expect(schemaInfo.models).toHaveProperty('Todo');

            console.log('✅ Successfully resolved schema with models:', Object.keys(schemaInfo.models));
        });

        it('should extract correct database provider', async () => {
            const schemaInfo = await resolver.resolveSchema(prisma);

            expect(schemaInfo.databaseProvider).toBe('postgresql');
        });
    });

    describe('Model Information', () => {
        beforeAll(async () => {
            // Ensure schema is resolved
            await resolver.resolveSchema(prisma);
        });

        it('should get all model names', () => {
            const modelNames = resolver.getModelNames();

            expect(modelNames).toContain('User');
            expect(modelNames).toContain('Category');
            expect(modelNames).toContain('Todo');
            expect(modelNames).toContain('TodoComment');
            expect(modelNames.length).toBeGreaterThanOrEqual(4);
        });

        it('should get model info by name', () => {
            const userModel = resolver.getModelInfo('User');

            expect(userModel).toBeDefined();
            expect(userModel?.name).toBe('User');
            expect(userModel?.tableName).toBe('user'); // @@map("user")
            expect(userModel?.fields).toBeDefined();
            expect(userModel?.relations).toBeDefined();
        });

        it('should return undefined for non-existent model', () => {
            const nonExistentModel = resolver.getModelInfo('NonExistentModel');

            expect(nonExistentModel).toBeUndefined();
        });
    });

    describe('Table Information', () => {
        beforeAll(async () => {
            await resolver.resolveSchema(prisma);
        });

        it('should get all table names', () => {
            const tableNames = resolver.getTableNames();

            expect(tableNames).toContain('user');
            expect(tableNames).toContain('category');
            expect(tableNames).toContain('todo');
            expect(tableNames).toContain('todo_comment');
        });

        it('should check if table exists', () => {
            expect(resolver.hasTable('user')).toBe(true);
            expect(resolver.hasTable('category')).toBe(true);
            expect(resolver.hasTable('nonexistent_table')).toBe(false);
        });

        it('should get column names for existing table', () => {
            const userColumns = resolver.getColumnNames('user');

            expect(userColumns).toBeDefined();
            expect(userColumns).toContain('user_id');
            expect(userColumns).toContain('user_name');
            expect(userColumns).toContain('email');
            expect(userColumns).toContain('created_at');
        });

        it('should return undefined for non-existent table columns', () => {
            const nonExistentColumns = resolver.getColumnNames('nonexistent_table');

            expect(nonExistentColumns).toBeUndefined();
        });

        it('should check if column exists in table', () => {
            expect(resolver.hasColumn('user', 'user_id')).toBe(true);
            expect(resolver.hasColumn('user', 'email')).toBe(true);
            expect(resolver.hasColumn('user', 'nonexistent_column')).toBe(false);
            expect(resolver.hasColumn('nonexistent_table', 'any_column')).toBe(false);
        });
    });

    describe('TableColumnResolver Creation', () => {
        beforeAll(async () => {
            await resolver.resolveSchema(prisma);
        });

        it('should create TableColumnResolver function', () => {
            const tableColumnResolver = resolver.createTableColumnResolver();

            expect(typeof tableColumnResolver).toBe('function');
        });

        it('should resolve column names for existing table', () => {
            const tableColumnResolver = resolver.createTableColumnResolver();
            const userColumns = tableColumnResolver('user');

            expect(Array.isArray(userColumns)).toBe(true);
            expect(userColumns).toContain('user_id');
            expect(userColumns).toContain('user_name');
            expect(userColumns).toContain('email');
        });

        it('should return empty array for non-existent table', () => {
            const tableColumnResolver = resolver.createTableColumnResolver();
            const nonExistentColumns = tableColumnResolver('nonexistent_table');

            expect(Array.isArray(nonExistentColumns)).toBe(true);
            expect(nonExistentColumns.length).toBe(0);
        });

        it('should throw error if schema not resolved', () => {
            const newResolver = new PrismaSchemaResolver({ debug: false });

            expect(() => {
                newResolver.createTableColumnResolver();
            }).toThrow('Schema not resolved. Call resolveSchema() first.');
        });
    });

    describe('Field and Relation Analysis', () => {
        beforeAll(async () => {
            await resolver.resolveSchema(prisma);
        });

        it('should correctly parse User model fields', () => {
            const userModel = resolver.getModelInfo('User');

            expect(userModel?.fields).toBeDefined();

            // Check user_id field (primary key)
            const userIdField = userModel?.fields['user_id'];
            expect(userIdField?.isId).toBe(true);
            expect(userIdField?.type).toBe('Int');
            expect(userIdField?.columnName).toBe('user_id');

            // Check email field (unique)
            const emailField = userModel?.fields['email'];
            expect(emailField?.isUnique).toBe(true);
            expect(emailField?.type).toBe('String');
        });

        it('should correctly parse User model relations', () => {
            const userModel = resolver.getModelInfo('User');

            expect(userModel?.relations).toBeDefined();

            // User has one-to-many relation with Todo
            const todosRelation = userModel?.relations['todos'];
            expect(todosRelation?.type).toBe('one-to-many');
            expect(todosRelation?.modelName).toBe('Todo');
            expect(todosRelation?.isList).toBe(true);
        });

        it('should correctly identify primary keys', () => {
            const userModel = resolver.getModelInfo('User');

            expect(userModel?.primaryKey).toEqual(['user_id']);
        });

        it('should correctly identify unique constraints', () => {
            const userModel = resolver.getModelInfo('User');

            expect(userModel?.uniqueConstraints).toBeDefined();
            expect(userModel?.uniqueConstraints).toContainEqual(['email']);
        });
    });
});
