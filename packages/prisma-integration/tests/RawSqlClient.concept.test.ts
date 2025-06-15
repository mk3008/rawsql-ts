import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RawSqlClient } from '../src/RawSqlClient';
import { SelectQueryParser, SimpleSelectQuery } from 'rawsql-ts';

// Mock Prisma Client
const mockPrismaClient = {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
};

describe('RawSqlClient - 理想形のインターフェース（コンセプト確認用）', () => {
    let client: RawSqlClient;

    beforeEach(async () => {
        // Arrange: Mock関数をリセット
        vi.clearAllMocks();

        // Arrange: RawSqlClientインスタンスを作成
        client = new RawSqlClient(mockPrismaClient as any, {
            debug: true,
            sqlFilesPath: './tests/sql'
        });

        // Note: RawSqlClient uses lazy initialization, so no manual initialization needed
    });

    describe('基本的なSQLファイル実行', () => {
        it('SQLファイルからクエリを実行できる', async () => {
            // Arrange: モックの戻り値設定（任意のデータ）
            const mockResult = [
                { id: 1, name: 'Alice', email: 'alice@example.com' },
                { id: 2, name: 'Bob', email: 'bob@example.com' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

            // Act: SQLファイルを実行
            const result = await client.query('users/list.sql');

            // Assert: 結果が取得できること
            expect(result).toEqual(mockResult);
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        });
    });

    describe('動的フィルタリング', () => {
        it('filter条件付きでSQLを実行できる', async () => {
            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

            // Act: フィルタ条件付きでSQLファイルを実行
            const result = await client.query('users/search.sql', {
                filter: {
                    status: 'active',
                    name: { ilike: '%alice%' }
                }
            });

            // Assert: 結果が取得できること
            expect(result).toEqual(mockResult);
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        });

        it('複数のfilter条件を組み合わせて実行できる', async () => {
            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 1, name: 'Alice', email: 'alice@example.com', created_at: '2024-01-01T00:00:00Z' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

            // Act: 複数条件でフィルタリング
            const result = await client.query('users/search.sql', {
                filter: {
                    name: { ilike: '%alice%' },
                    created_at: { '>=': '2024-01-01' },
                    status: { in: ['active', 'pending'] }
                }
            });

            // Assert: 結果が取得できること
            expect(result).toEqual(mockResult);
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        });
    });

    describe('ソート機能', () => {
        it('sort条件付きでSQLを実行できる', async () => {
            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 2, name: 'Bob', created_at: '2024-02-01T00:00:00Z' },
                { id: 1, name: 'Alice', created_at: '2024-01-01T00:00:00Z' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

            // Act: ソート条件付きでSQLファイルを実行
            const result = await client.query('users/list.sql', {
                sort: {
                    created_at: { desc: true },
                    name: { asc: true }
                }
            });

            // Assert: 結果が取得できること
            expect(result).toEqual(mockResult);
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        });
    });

    describe('ページネーション機能', () => {
        it('paging条件付きでSQLを実行できる', async () => {
            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 11, name: 'User11', email: 'user11@example.com' },
                { id: 12, name: 'User12', email: 'user12@example.com' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

            // Act: ページネーション付きでSQLファイルを実行
            const result = await client.query('users/list.sql', {
                paging: {
                    page: 2,
                    pageSize: 10
                }
            });

            // Assert: 結果が取得できること
            expect(result).toEqual(mockResult);
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        });
    });

    describe('JSON serialization', () => {
        it('serialize条件付きでSQLを実行できる', async () => {
            // Arrange: モックの戻り値設定（階層化されたJSON）
            const mockResult = [
                {
                    id: 1,
                    name: 'Alice',
                    email: 'alice@example.com',
                    profile: {
                        title: 'Software Engineer',
                        bio: 'Passionate developer'
                    },
                    posts: [
                        { id: 1, title: 'Hello World' },
                        { id: 2, title: 'TypeScript Tips' }
                    ]
                }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: JSON serialization付きでSQLファイルを実行
            const result = await client.query('users/list.sql', {
                serialize: {
                    rootName: 'user',
                    rootEntity: {
                        id: 'user',
                        name: 'User',
                        columns: { id: 'id', name: 'name', email: 'email' }
                    },
                    nestedEntities: [
                        {
                            id: 'profile',
                            name: 'Profile',
                            parentId: 'user',
                            propertyName: 'profile',
                            relationshipType: 'object',
                            columns: { title: 'profile_title', bio: 'profile_bio' }
                        }
                    ]
                }
            });

            // Assert: 結果が取得できること
            expect(result).toEqual(mockResult);
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        });

        it('serialize=trueで自動JSONマッピング読み込みができる', async () => {
            // Arrange: モックの戻り値設定
            const mockResult = [
                {
                    id: 1,
                    name: 'Alice',
                    email: 'alice@example.com'
                }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

            // Act: 自動JSONマッピング読み込み
            const result = await client.query('users/search.sql', {
                filter: { status: 'active' },
                serialize: true  // Auto-load JSON mapping file
            });

            // Assert: 結果が取得できること
            expect(result).toEqual(mockResult);
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        });
    });

    describe('SelectQuery object実行', () => {
        it('SelectQueryオブジェクトを直接実行できる', async () => {
            // Arrange: SelectQueryオブジェクトを作成
            const sqlText = 'SELECT id, name, email FROM users WHERE active = true';
            const selectQuery = SelectQueryParser.parse(sqlText);

            const mockResult = [
                { id: 1, name: 'Alice', email: 'alice@example.com' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

            // Act: SelectQueryオブジェクトを実行
            const result = await client.query(selectQuery);

            // Assert: 結果が取得できること
            expect(result).toEqual(mockResult);
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        });

        it('複雑なSelectQueryオブジェクトを実行できる', async () => {
            // Arrange: 複雑なSelectQueryオブジェクトを作成
            const sqlText = `
                SELECT u.id, u.name, u.email, p.title as profile_title
                FROM users u
                LEFT JOIN profiles p ON u.id = p.user_id
                WHERE u.active = true
                ORDER BY u.created_at DESC
            `;
            const complexQuery = SelectQueryParser.parse(sqlText);

            const mockResult = [
                { id: 1, name: 'Alice', email: 'alice@example.com', profile_title: 'Engineer' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

            // Act: 複雑なSelectQueryオブジェクトを実行
            const result = await client.query(complexQuery);

            // Assert: 結果が取得できること
            expect(result).toEqual(mockResult);
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        });
    });

    describe('エラーハンドリング', () => {
        it('存在しないSQLファイルでエラーが発生する', async () => {
            // Arrange: 存在しないファイルパス
            const nonExistentPath = 'non-existent/file.sql';

            // Act & Assert: エラーが発生することを確認
            await expect(
                client.query(nonExistentPath)
            ).rejects.toThrow();
        });

        it('不正なSQLでエラーが発生する', async () => {
            // Arrange: データベースエラーをモック
            mockPrismaClient.$queryRawUnsafe.mockRejectedValue(new Error('SQL syntax error'));

            // Act & Assert: エラーが発生することを確認
            await expect(
                client.query('invalid.sql')
            ).rejects.toThrow('SQL syntax error');
        });
    });
});
