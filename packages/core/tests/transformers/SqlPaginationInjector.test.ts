import { describe, test, expect } from 'vitest';
import { SqlPaginationInjector, PaginationOptions } from '../../src/transformers/SqlPaginationInjector';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlPaginationInjector', () => {
    // Tests for parameterized pagination (new behavior)
    describe('Parameterized Pagination', () => {
        test('should inject pagination with parameter placeholders for first page', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id, name FROM users';
            const pagination: PaginationOptions = { page: 1, pageSize: 20 };
            const expectedSql = 'select "id", "name" from "users" limit :paging_limit offset :paging_offset';

            // Act
            const result = injector.inject(baseQuery, pagination);
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual({
                paging_limit: 20,
                paging_offset: 0
            });
        });

        test('should inject pagination with parameter placeholders for second page', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id, name FROM users WHERE active = true';
            const pagination: PaginationOptions = { page: 2, pageSize: 10 };
            const expectedSql = 'select "id", "name" from "users" where "active" = true limit :paging_limit offset :paging_offset';

            // Act
            const result = injector.inject(baseQuery, pagination);
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual({
                paging_limit: 10,
                paging_offset: 10
            });
        });

        test('should calculate correct offset parameters for higher page numbers', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT * FROM products';
            const pagination: PaginationOptions = { page: 5, pageSize: 25 };
            const expectedSql = 'select * from "products" limit :paging_limit offset :paging_offset';

            // Act
            const result = injector.inject(baseQuery, pagination);
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual({
                paging_limit: 25,
                paging_offset: 100
            });
        });

        test('should preserve existing ORDER BY clause with parameterized pagination', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id, name FROM users ORDER BY created_at DESC';
            const pagination: PaginationOptions = { page: 3, pageSize: 15 };
            const expectedSql = 'select "id", "name" from "users" order by "created_at" desc limit :paging_limit offset :paging_offset';

            // Act
            const result = injector.inject(baseQuery, pagination);
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual({
                paging_limit: 15,
                paging_offset: 30
            });
        });

        test('should handle complex queries with parameterized pagination', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = `
                SELECT u.id, u.name, p.title 
                FROM users u 
                JOIN posts p ON u.id = p.user_id 
                WHERE u.active = true AND p.published = true
                GROUP BY u.id, u.name, p.title
                HAVING COUNT(*) > 1
                ORDER BY u.name ASC, p.title DESC
            `;
            const pagination: PaginationOptions = { page: 2, pageSize: 50 };
            const expectedSql = 'select "u"."id", "u"."name", "p"."title" from "users" as "u" join "posts" as "p" on "u"."id" = "p"."user_id" where "u"."active" = true and "p"."published" = true group by "u"."id", "u"."name", "p"."title" having count(*) > 1 order by "u"."name", "p"."title" desc limit :paging_limit offset :paging_offset';

            // Act
            const result = injector.inject(baseQuery, pagination);
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual({
                paging_limit: 50,
                paging_offset: 50
            });
        });

        test('should handle large page numbers with correct parameter values', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id FROM users';
            const pagination: PaginationOptions = { page: 100, pageSize: 50 };
            const expectedSql = 'select "id" from "users" limit :paging_limit offset :paging_offset';

            // Act
            const result = injector.inject(baseQuery, pagination);
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual({
                paging_limit: 50,
                paging_offset: 4950
            });
        });

        test('should handle single item per page with correct parameters', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id FROM users';
            const pagination: PaginationOptions = { page: 5, pageSize: 1 };
            const expectedSql = 'select "id" from "users" limit :paging_limit offset :paging_offset';

            // Act
            const result = injector.inject(baseQuery, pagination);
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual({
                paging_limit: 1,
                paging_offset: 4
            });
        });

        test('should accept maximum allowed page size with parameter', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id FROM users';
            const pagination: PaginationOptions = { page: 1, pageSize: 1000 };
            const expectedSql = 'select "id" from "users" limit :paging_limit offset :paging_offset';

            // Act
            const result = injector.inject(baseQuery, pagination);
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual({
                paging_limit: 1000,
                paging_offset: 0
            });
        });

        test('should always include OFFSET parameter for consistent query caching', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id, name FROM users';
            const pagination: PaginationOptions = { page: 1, pageSize: 50 };
            const expectedSql = 'select "id", "name" from "users" limit :paging_limit offset :paging_offset';

            // Act
            const result = injector.inject(baseQuery, pagination);
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual({
                paging_limit: 50,
                paging_offset: 0
            });
            // Note: Always include paging_offset for consistent SQL structure and better query caching
            expect(params).toHaveProperty('paging_offset');
        });
    });

    // Existing validation tests (these should still pass)
    describe('Validation', () => {
        test('should throw error for page number less than 1', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id FROM users';
            const pagination: PaginationOptions = { page: 0, pageSize: 10 };

            // Act & Assert
            expect(() => {
                injector.inject(baseQuery, pagination);
            }).toThrow('Page number must be a positive integer (1 or greater)');
        });

        test('should throw error for negative page number', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id FROM users';
            const pagination: PaginationOptions = { page: -1, pageSize: 10 };

            // Act & Assert
            expect(() => {
                injector.inject(baseQuery, pagination);
            }).toThrow('Page number must be a positive integer (1 or greater)');
        });

        test('should throw error for page size less than 1', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id FROM users';
            const pagination: PaginationOptions = { page: 1, pageSize: 0 };

            // Act & Assert
            expect(() => {
                injector.inject(baseQuery, pagination);
            }).toThrow('Page size must be a positive integer (1 or greater)');
        });

        test('should throw error for negative page size', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id FROM users';
            const pagination: PaginationOptions = { page: 1, pageSize: -5 };

            // Act & Assert
            expect(() => {
                injector.inject(baseQuery, pagination);
            }).toThrow('Page size must be a positive integer (1 or greater)');
        });

        test('should throw error for page size exceeding maximum limit', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id FROM users';
            const pagination: PaginationOptions = { page: 1, pageSize: 1001 };

            // Act & Assert
            expect(() => {
                injector.inject(baseQuery, pagination);
            }).toThrow('Page size cannot exceed 1000 items');
        });

        test('should throw error when query already has LIMIT clause', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id, name FROM users LIMIT 10';
            const pagination: PaginationOptions = { page: 1, pageSize: 20 };

            // Act & Assert
            expect(() => {
                injector.inject(baseQuery, pagination);
            }).toThrow('Query already contains LIMIT or OFFSET clause');
        });

        test('should throw error when query already has OFFSET clause', () => {
            // Arrange
            const injector = new SqlPaginationInjector();
            const baseQuery = 'SELECT id, name FROM users OFFSET 5';
            const pagination: PaginationOptions = { page: 1, pageSize: 20 };

            // Act & Assert
            expect(() => {
                injector.inject(baseQuery, pagination);
            }).toThrow('Query already contains LIMIT or OFFSET clause');
        });
    });

    // Tests for removePagination (should remain unchanged)
    describe('RemovePagination', () => {
        test('removePagination should remove existing LIMIT and OFFSET clauses', () => {
            // Arrange
            const baseQuery = 'SELECT id, name FROM users LIMIT 20 OFFSET 10';
            const expectedSql = 'select "id", "name" from "users"';

            // Act
            const result = SqlPaginationInjector.removePagination(baseQuery);
            const formatter = new SqlFormatter();
            const { formattedSql } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
        });

        test('removePagination should preserve other clauses when removing pagination', () => {
            // Arrange
            const baseQuery = `
                SELECT u.id, u.name 
                FROM users u 
                WHERE u.active = true 
                ORDER BY u.name ASC 
                LIMIT 50 OFFSET 100
            `;
            const expectedSql = 'select "u"."id", "u"."name" from "users" as "u" where "u"."active" = true order by "u"."name"';

            // Act
            const result = SqlPaginationInjector.removePagination(baseQuery);
            const formatter = new SqlFormatter();
            const { formattedSql } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
        });

        test('removePagination should work with queries that have no pagination', () => {
            // Arrange
            const baseQuery = 'SELECT id, name FROM users WHERE active = true';
            const expectedSql = 'select "id", "name" from "users" where "active" = true';

            // Act
            const result = SqlPaginationInjector.removePagination(baseQuery);
            const formatter = new SqlFormatter();
            const { formattedSql } = formatter.format(result);

            // Assert
            expect(formattedSql).toBe(expectedSql);
        });
    });
});