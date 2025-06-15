import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaSchemaResolver } from '../src/PrismaSchemaResolver';
import { RawSqlClientOptions } from '../src/types';
import * as fs from 'fs';
import { getDMMF } from '@prisma/internals';

// Mock external dependencies
vi.mock('fs');
vi.mock('@prisma/internals');

// Mock Prisma Client
const mockPrismaClient = {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
};

describe('PrismaSchemaResolver', () => {
    let resolver: PrismaSchemaResolver;
    let options: RawSqlClientOptions;

    beforeEach(() => {
        // Arrange: Mock関数をリセット
        vi.clearAllMocks();

        // Arrange: オプション設定
        options = {
            debug: true,
            defaultSchema: 'public',
            sqlFilesPath: './tests/sql'
        };

        // Arrange: PrismaSchemaResolverインスタンスを作成
        resolver = new PrismaSchemaResolver(options);
    });

    describe('Schema Resolution', () => {
        it('should resolve schema information from schema.prisma file when available', async () => {
            // Arrange: Mock successful schema file reading
            const mockSchemaContent = `
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}
            `;

            const mockDMMF = {
                datamodel: {
                    models: [
                        {
                            name: 'User',
                            dbName: null,
                            fields: [
                                { name: 'id', type: 'Int', isId: true, isOptional: false, isList: false, isUnique: true, isGenerated: true, relationName: null },
                                { name: 'email', type: 'String', isId: false, isOptional: false, isList: false, isUnique: true, isGenerated: false, relationName: null },
                                { name: 'name', type: 'String', isId: false, isOptional: true, isList: false, isUnique: false, isGenerated: false, relationName: null }
                            ]
                        }
                    ]
                }
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
            vi.mocked(fs.readFileSync).mockReturnValue(mockSchemaContent);
            vi.mocked(getDMMF).mockResolvedValue(mockDMMF as any);

            // Act: スキーマを解析
            const schemaInfo = await resolver.resolveSchema(mockPrismaClient as any);

            // Assert: スキーマ情報が正しく取得されている
            expect(schemaInfo).toBeDefined();
            expect(schemaInfo.schemaName).toBe('public');
            expect(schemaInfo.models).toBeDefined();
            expect(Object.keys(schemaInfo.models)).toContain('User');
            expect(getDMMF).toHaveBeenCalledWith({ datamodel: mockSchemaContent });
        });

        it('should fallback to mock data when schema file is not available and in test environment', async () => {
            // Arrange: Mock schema file not found
            vi.mocked(fs.existsSync).mockReturnValue(false);
            process.env.NODE_ENV = 'test';

            // Act: スキーマを解析
            const schemaInfo = await resolver.resolveSchema(mockPrismaClient as any);

            // Assert: モックデータが使用されている
            expect(schemaInfo).toBeDefined();
            expect(schemaInfo.schemaName).toBe('public');
            expect(schemaInfo.models).toBeDefined();
            expect(Object.keys(schemaInfo.models)).toContain('User');
            expect(Object.keys(schemaInfo.models)).toContain('Post');
        });

        it('should resolve schema information from Prisma client DMMF when schema file unavailable', async () => {
            // Arrange: Mock schema file not found but client DMMF available
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const mockClientWithDMMF = {
                ...mockPrismaClient,
                _dmmf: {
                    datamodel: {
                        models: [
                            {
                                name: 'User',
                                dbName: null,
                                fields: [
                                    { name: 'id', type: 'Int', isId: true, isOptional: false, isList: false, isUnique: true, isGenerated: true, relationName: null },
                                    { name: 'email', type: 'String', isId: false, isOptional: false, isList: false, isUnique: true, isGenerated: false, relationName: null }
                                ]
                            }
                        ]
                    }
                }
            };

            // Act: スキーマを解析
            const schemaInfo = await resolver.resolveSchema(mockClientWithDMMF as any);

            // Assert: スキーマ情報が正しく取得されている
            expect(schemaInfo).toBeDefined();
            expect(schemaInfo.models).toBeDefined();
            expect(Object.keys(schemaInfo.models)).toContain('User');
        });

        it('should use custom schema name from options', async () => {
            // Arrange: カスタムスキーマ名を設定
            const customOptions = { ...options, defaultSchema: 'custom_schema' };
            const customResolver = new PrismaSchemaResolver(customOptions);

            // Mock for fallback to test data
            process.env.NODE_ENV = 'test';
            vi.mocked(fs.existsSync).mockReturnValue(false);

            // Act: スキーマを解析
            const schemaInfo = await customResolver.resolveSchema(mockPrismaClient as any);            // Assert: カスタムスキーマ名が使用されている
            expect(schemaInfo.schemaName).toBe('custom_schema');
        });

        it('should use custom schema path when provided', async () => {
            // Arrange: カスタムスキーマパスを設定
            const customOptions = {
                ...options,
                schemaPath: '/custom/path/to/schema.prisma'
            };
            const customResolver = new PrismaSchemaResolver(customOptions);

            const mockSchemaContent = `
model CustomModel {
  id Int @id @default(autoincrement())
  name String
}
            `;

            const mockDMMF = {
                datamodel: {
                    models: [
                        {
                            name: 'CustomModel',
                            dbName: null,
                            fields: [
                                { name: 'id', type: 'Int', isId: true, isOptional: false, isList: false, isUnique: true, isGenerated: true, relationName: null },
                                { name: 'name', type: 'String', isId: false, isOptional: false, isList: false, isUnique: false, isGenerated: false, relationName: null }
                            ]
                        }
                    ]
                }
            };

            // Mock fs functions to return custom schema
            vi.mocked(fs.existsSync).mockImplementation((path) =>
                path === '/custom/path/to/schema.prisma'
            );
            vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
            vi.mocked(fs.readFileSync).mockReturnValue(mockSchemaContent);
            vi.mocked(getDMMF).mockResolvedValue(mockDMMF as any);

            // Act: スキーマを解析
            const schemaInfo = await customResolver.resolveSchema(mockPrismaClient as any);

            // Assert: カスタムスキーマが使用されている
            expect(schemaInfo).toBeDefined();
            expect(Object.keys(schemaInfo.models)).toContain('CustomModel');
            expect(fs.readFileSync).toHaveBeenCalledWith('/custom/path/to/schema.prisma', 'utf-8');
        }); it('should throw error when all schema resolution methods fail in production', async () => {
            // Arrange: プロダクション環境に設定
            const originalEnv = process.env.NODE_ENV;
            const originalVitest = process.env.VITEST;
            process.env.NODE_ENV = 'production';
            delete process.env.VITEST;

            // Mock all methods to fail
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const mockClientWithoutDMMF = {
                ...mockPrismaClient
                // No DMMF properties
            };

            try {
                // Act & Assert: エラーが投げられる   
                await expect(resolver.resolveSchema(mockClientWithoutDMMF as any))
                    .rejects.toThrow('Unable to resolve Prisma schema information');
            } finally {
                // Cleanup: 環境変数をリストア
                process.env.NODE_ENV = originalEnv;
                if (originalVitest) {
                    process.env.VITEST = originalVitest;
                }
            }
        });
    });

    describe('TableColumnResolver Creation', () => {
        beforeEach(async () => {
            // Arrange: スキーマを事前に解析
            await resolver.resolveSchema(mockPrismaClient as any);
        });

        it('should create TableColumnResolver function', () => {
            // Act: TableColumnResolverを作成
            const tableColumnResolver = resolver.createTableColumnResolver();

            // Assert: 関数が返される
            expect(tableColumnResolver).toBeInstanceOf(Function);
        });

        it('should resolve column names for existing table', () => {
            // Arrange: TableColumnResolverを作成
            const tableColumnResolver = resolver.createTableColumnResolver();

            // Act: usersテーブルのカラム名を取得
            const columns = tableColumnResolver('users');

            // Assert: 期待するカラムが返される
            expect(columns).toEqual(['id', 'email', 'name']);
        });

        it('should return empty array for non-existent table', () => {
            // Arrange: TableColumnResolverを作成
            const tableColumnResolver = resolver.createTableColumnResolver();

            // Act: 存在しないテーブルのカラム名を取得
            const columns = tableColumnResolver('non_existent_table');

            // Assert: 空配列が返される
            expect(columns).toEqual([]);
        });

        it('should throw error if schema not resolved', () => {
            // Arrange: 新しいresolverインスタンス（スキーマ未解析）
            const newResolver = new PrismaSchemaResolver(options);

            // Act & Assert: エラーが投げられる
            expect(() => {
                newResolver.createTableColumnResolver();
            }).toThrow('Schema not resolved. Call resolveSchema() first.');
        });
    });

    describe('Table Information Methods', () => {
        beforeEach(async () => {
            // Arrange: スキーマを事前に解析
            await resolver.resolveSchema(mockPrismaClient as any);
        });

        it('should get all table names', () => {
            // Act: テーブル名一覧を取得
            const tableNames = resolver.getTableNames();

            // Assert: 期待するテーブル名が返される
            expect(tableNames).toEqual(['users', 'posts']);
        });

        it('should get column names for specific table', () => {
            // Act: usersテーブルのカラム名を取得
            const columns = resolver.getColumnNames('users');

            // Assert: 期待するカラムが返される
            expect(columns).toEqual(['id', 'email', 'name']);
        });

        it('should return undefined for non-existent table columns', () => {
            // Act: 存在しないテーブルのカラム名を取得
            const columns = resolver.getColumnNames('non_existent');

            // Assert: undefinedが返される
            expect(columns).toBeUndefined();
        });

        it('should check if table exists', () => {
            // Act & Assert: 存在するテーブル
            expect(resolver.hasTable('users')).toBe(true);
            expect(resolver.hasTable('posts')).toBe(true);

            // Act & Assert: 存在しないテーブル
            expect(resolver.hasTable('non_existent')).toBe(false);
        });

        it('should check if column exists in table', () => {
            // Act & Assert: 存在するカラム
            expect(resolver.hasColumn('users', 'id')).toBe(true);
            expect(resolver.hasColumn('users', 'email')).toBe(true);
            expect(resolver.hasColumn('users', 'name')).toBe(true);

            // Act & Assert: 存在しないカラム
            expect(resolver.hasColumn('users', 'non_existent')).toBe(false);

            // Act & Assert: 存在しないテーブル
            expect(resolver.hasColumn('non_existent', 'id')).toBe(false);
        });
    });

    describe('Model Information Methods', () => {
        beforeEach(async () => {
            // Arrange: スキーマを事前に解析
            await resolver.resolveSchema(mockPrismaClient as any);
        });

        it('should get all model names', () => {
            // Act: モデル名一覧を取得
            const modelNames = resolver.getModelNames();

            // Assert: 期待するモデル名が返される
            expect(modelNames).toEqual(['User', 'Post']);
        });

        it('should get model info by name', () => {
            // Act: Userモデルの情報を取得
            const userModel = resolver.getModelInfo('User');

            // Assert: モデル情報が正しく返される
            expect(userModel).toBeDefined();
            expect(userModel?.name).toBe('User');
            expect(userModel?.tableName).toBe('users');
            expect(Object.keys(userModel?.fields || {})).toContain('id');
            expect(Object.keys(userModel?.fields || {})).toContain('email');
            expect(Object.keys(userModel?.fields || {})).toContain('name');
        });

        it('should return undefined for non-existent model', () => {
            // Act: 存在しないモデルの情報を取得
            const model = resolver.getModelInfo('NonExistent');

            // Assert: undefinedが返される
            expect(model).toBeUndefined();
        });
    });

    describe('Wildcard Query Support', () => {
        beforeEach(async () => {
            // Arrange: スキーマを事前に解析
            await resolver.resolveSchema(mockPrismaClient as any);
        });

        it('should support wildcard expansion for SELECT *', () => {
            // Arrange: TableColumnResolverを作成
            const tableColumnResolver = resolver.createTableColumnResolver();

            // Act: SELECT * の対象テーブルのカラムを取得
            const usersColumns = tableColumnResolver('users');
            const postsColumns = tableColumnResolver('posts');

            // Assert: ワイルドカードを展開するのに必要な情報が取得できる
            expect(usersColumns).toEqual(['id', 'email', 'name']);
            expect(postsColumns).toEqual(['id', 'title', 'content', 'author_id']);

            // Simulate wildcard expansion
            const expandedQuery = `SELECT ${usersColumns.map(col => `"${col}"`).join(', ')} FROM users`;
            expect(expandedQuery).toBe('SELECT "id", "email", "name" FROM users');
        });

        it('should support JOIN queries with multiple tables', () => {
            // Arrange: TableColumnResolverを作成
            const tableColumnResolver = resolver.createTableColumnResolver();

            // Act: 複数テーブルのカラムを取得
            const usersColumns = tableColumnResolver('users');
            const postsColumns = tableColumnResolver('posts');

            // Assert: JOINクエリでのワイルドカード展開に必要な情報が取得できる
            expect(usersColumns).toContain('id');
            expect(usersColumns).toContain('email');
            expect(usersColumns).toContain('name');

            expect(postsColumns).toContain('id');
            expect(postsColumns).toContain('title');
            expect(postsColumns).toContain('content');
            expect(postsColumns).toContain('author_id');

            // Simulate qualified wildcard expansion for JOIN
            const qualifiedUsersColumns = usersColumns.map(col => `"u"."${col}"`);
            const qualifiedPostsColumns = postsColumns.map(col => `"p"."${col}"`);

            expect(qualifiedUsersColumns).toEqual(['"u"."id"', '"u"."email"', '"u"."name"']);
            expect(qualifiedPostsColumns).toEqual(['"p"."id"', '"p"."title"', '"p"."content"', '"p"."author_id"']);
        });
    });

    describe('Error Handling', () => {
        it('should handle methods gracefully when schema not resolved', () => {
            // Arrange: 新しいresolverインスタンス（スキーマ未解析）
            const newResolver = new PrismaSchemaResolver(options);

            // Act & Assert: 各メソッドが適切にハンドリングする
            expect(newResolver.getTableNames()).toEqual([]);
            expect(newResolver.getColumnNames('users')).toBeUndefined();
            expect(newResolver.hasTable('users')).toBe(false);
            expect(newResolver.hasColumn('users', 'id')).toBe(false);
            expect(newResolver.getModelNames()).toEqual([]);
            expect(newResolver.getModelInfo('User')).toBeUndefined();
        });
    });
});
