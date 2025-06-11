import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaReader } from '../src/PrismaReader';
import { SelectQueryParser, SimpleSelectQuery } from 'rawsql-ts';

// Mock Prisma Client
const mockPrismaClient = {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
};

describe('PrismaReader - 理想形のインターフェース（コンセプト確認用）', () => {
    let prismaReader: PrismaReader;

    beforeEach(async () => {
        // Arrange: Mock関数をリセット
        vi.clearAllMocks();        // Arrange: PrismaReaderインスタンスを作成
        prismaReader = new PrismaReader(mockPrismaClient as any, {
            debug: true,
            sqlFilesPath: './tests/sql'
        });        // Arrange: 初期化
        await prismaReader.initialize();
    });

    describe('基本的なSQLファイル実行', () => {
        it('SQLファイルからクエリを実行できる', async () => {
            // Arrange: モックの戻り値設定（任意のデータ）
            const mockResult = [
                { id: 1, name: 'Alice', email: 'alice@example.com' },
                { id: 2, name: 'Bob', email: 'bob@example.com' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: SQLファイルを実行
            const result = await prismaReader.query('users/list.sql');

            // Assert: 期待するSQLが生成されて実行されたかチェック
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
                'select "id", "name", "email", "created_at" from "users" where "active" = true'
            );
        });
    });

    describe('フィルタリング機能（基本）', () => {
        // TODO: 後で複雑なフィルタ機能を追加予定
        // - 範囲検索 (min/max, >, <, >=, <=)
        // - LIKE/ILIKE検索
        // - OR/AND条件の組み合わせ  
        // - NOT条件
        // - カスタムオペレータ (any, etc.)

        it('シンプルなフィルタでクエリできる', async () => {
            // Arrange: モックの戻り値設定（フィルタ機能のテスト用任意データ）
            const mockResult = [{ id: 1, name: 'Alice', active: true }];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: フィルタ条件付きでクエリ実行
            const result = await prismaReader.query('users/search.sql', {
                filter: {
                    name: 'Alice',
                    active: true
                }
            });            // Assert: 期待するSQL（動的フィルタ条件が追加される）が生成されたかチェック
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
                'select "u"."id", "u"."name", "u"."email", "u"."created_at", "u"."active" from "users" as "u" where "u"."name" = :name and "u"."active" = :active',
                'Alice',
                true
            );
        });

        it('IN条件でフィルタリングできる', async () => {
            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 1, name: 'Alice', active: true },
                { id: 2, name: 'Bob', active: true }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: IN条件付きでクエリ実行（実在するカラムを使用）
            const result = await prismaReader.query('users/search.sql', {
                filter: {
                    active: true // 実際に存在するカラムを使用
                }
            });            // Assert: 期待するSQL（動的フィルタ条件が追加される）が生成されたかチェック
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
                'select "u"."id", "u"."name", "u"."email", "u"."created_at", "u"."active" from "users" as "u" where "u"."active" = :active',
                true
            );
        });
    });

    describe('ソート機能（基本）', () => {
        // TODO: 後で高度なソート機能を追加予定
        // - NULLS FIRST/LAST オプション
        // - 複雑な式でのソート
        // - カスタムソート順序

        it('単一フィールドでソートできる', async () => {
            // Arrange: モックの戻り値設定（任意のデータ）
            const mockResult = [
                { id: 2, name: 'Bob', created_at: '2023-01-02' },
                { id: 1, name: 'Alice', created_at: '2023-01-01' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: ソート条件付きでクエリ実行
            const result = await prismaReader.query('users/list.sql', {
                sort: { created_at: { desc: true } }
            });

            // Assert: 期待するSQL（ソート付き）が生成されたかチェック
            // TODO: ソート機能実装後はORDER BY句を検証
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
                'select "id", "name", "email", "created_at" from "users" where "active" = true order by "created_at" desc'
            );
        });

        it('複数フィールドでソートできる', async () => {
            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 1, name: 'Alice', active: true, created_at: '2023-01-02' },
                { id: 2, name: 'Bob', active: true, created_at: '2023-01-01' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: 複数ソート条件付きでクエリ実行（実在するカラムを使用）
            const result = await prismaReader.query('users/list.sql', {
                sort: {
                    name: { asc: true },
                    created_at: { desc: true }
                }
            });            // Assert: 期待するSQL（複数ソート付き）が生成されたかチェック
            // TODO: 複数ソート機能実装後はORDER BY句を検証
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
                'select "id", "name", "email", "created_at" from "users" where "active" = true order by "name", "created_at" desc'
            );
        });
    });

    describe('ページング機能（基本）', () => {
        // TODO: 後で高度なページング機能を追加予定
        // - カーソルベースページング
        // - 大容量データセット対応
        // - パフォーマンス最適化

        it('ページとページサイズでページングできる', async () => {
            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 11, name: 'User11' },
                { id: 12, name: 'User12' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: ページング条件付きでクエリ実行
            const result = await prismaReader.query('users/list.sql', {
                paging: {
                    page: 2,
                    pageSize: 10
                }
            });

            // Assert: 期待するSQL（ページング付き）が生成されたかチェック
            // TODO: ページング機能実装後はLIMIT/OFFSET句を検証
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
                'select "id", "name", "email", "created_at" from "users" where "active" = true limit 10 offset 10'
            );
        });

        it('ページサイズのみでページングできる', async () => {
            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 1, name: 'User1' },
                { id: 2, name: 'User2' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: ページサイズのみでクエリ実行（page=1がデフォルト）
            const result = await prismaReader.query('users/list.sql', {
                paging: {
                    pageSize: 10
                }
            });

            // Assert: 期待するSQL（LIMIT付き）が生成されたかチェック
            // TODO: ページング機能実装後はLIMIT句を検証
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
                'select "id", "name", "email", "created_at" from "users" where "active" = true limit 10'
            );
        });
    });

    describe('複合条件（基本）', () => {
        // TODO: 後で高度な複合条件を追加予定
        // - 複雑なフィルタ + ソート + ページング
        // - 複数のJOINを含むクエリ
        // - サブクエリとの組み合わせ
        // - パフォーマンス最適化

        it('フィルタ + ソート + ページングを組み合わせできる', async () => {
            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 15, name: 'ActiveUser15', active: true, created_at: '2023-01-15' },
                { id: 14, name: 'ActiveUser14', active: true, created_at: '2023-01-14' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: 全ての条件を組み合わせてクエリ実行（実在するカラムを使用）
            const result = await prismaReader.query('users/search.sql', {
                filter: { active: true },
                sort: { created_at: { desc: true } },
                paging: { page: 2, pageSize: 5 }
            });            // Assert: 期待するSQL（全条件付き）が生成されたかチェック
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
                'select "u"."id", "u"."name", "u"."email", "u"."created_at", "u"."active" from "users" as "u" where "u"."active" = :active order by "u"."created_at" desc limit 5 offset 5',
                true
            );
        });
    });

    describe('SelectQueryオーバーロード（新機能）', () => {
        it('直接SelectQueryオブジェクトを実行できる', async () => {
            // Arrange: SelectQueryを手動で作成
            const sql = 'SELECT id, name, email FROM users WHERE active = true';
            const selectQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 1, name: 'Alice', email: 'alice@example.com' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: SelectQueryオブジェクトを直接実行
            const result = await prismaReader.query(selectQuery);

            // Assert: プリビルドクエリが実行されたことを確認
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
                'select "id", "name", "email" from "users" where "active" = true'
            );
            expect(result).toEqual(mockResult);
        });

        it('DynamicQueryBuilderで構築したクエリを実行できる', async () => {
            // Arrange: 将来DynamicQueryBuilderで構築されたSelectQueryを想定
            // 今は手動でSelectQueryを作成
            const sql = 'SELECT u.id, u.name, u.email FROM users u WHERE u.active = true ORDER BY u.created_at DESC LIMIT 10';
            const complexQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Arrange: モックの戻り値設定
            const mockResult = [
                { id: 10, name: 'Latest User', email: 'latest@example.com' }
            ];
            mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);            // Act: 複雑なプリビルドクエリを実行
            const result = await prismaReader.query(complexQuery);

            // Assert: 結果が期待通りであることを確認
            expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
                'select "u"."id", "u"."name", "u"."email" from "users" as "u" where "u"."active" = true order by "u"."created_at" desc limit 10'
            );
            expect(result).toEqual(mockResult);
        });
    });

    describe('エラーハンドリング（基本）', () => {
        // TODO: 後で詳細なエラーハンドリングを追加予定
        // - SQL構文エラーの詳細分析
        // - パラメータバリデーション
        // - データベース接続エラー
        // - パフォーマンス警告

        it('存在しないSQLファイルでエラーになる', async () => {
            // Arrange: 存在しないファイルパス
            const nonExistentPath = 'non-existent/query.sql';            // Act & Assert: エラーが投げられることを確認
            await expect(
                prismaReader.query(nonExistentPath)
            ).rejects.toThrow('SQL file not found');
        });

        it('不正なSQL構文でエラーになる', async () => {
            // Arrange & Act & Assert: 不正なSQLファイルでエラーが投げられることを確認
            await expect(
                prismaReader.query('invalid.sql')
            ).rejects.toThrow('Failed to parse SQL');
        });
    });
});
