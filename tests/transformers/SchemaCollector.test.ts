import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SchemaCollector } from '../../src/transformers/SchemaCollector';
import { TableColumnResolver } from '../../src/transformers/TableColumnResolver';

// Test cases for SchemaCollector

describe('SchemaCollector', () => {
    test('collects schema information from simple SELECT query', () => {
        // Arrange
        const sql = `SELECT u.id, u.name FROM users as u`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
    });

    test('collects schema information from query with JOIN clause', () => {
        // Arrange
        const sql = `SELECT u.id, u.name, o.order_id FROM users u JOIN orders o ON u.id = o.user_id`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(2);
        expect(schemaInfo[0].name).toBe('orders'); // Adjusted order due to sorting
        expect(schemaInfo[0].columns).toEqual(['order_id', 'user_id']); // Adjusted order due to sorting
        expect(schemaInfo[1].name).toBe('users'); // Adjusted order due to sorting
        expect(schemaInfo[1].columns).toEqual(['id', 'name']); // Adjusted order due to sorting
    });

    test('collects schema information from UNION query', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name FROM users as u
            UNION
            SELECT customers.id, customers.email FROM customers
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(2);
        expect(schemaInfo[0].name).toBe('customers'); // Adjusted order due to sorting
        expect(schemaInfo[0].columns).toEqual(['email', 'id']); // Adjusted order due to sorting
        expect(schemaInfo[1].name).toBe('users'); // Adjusted order due to sorting
        expect(schemaInfo[1].columns).toEqual(['id', 'name']); // Adjusted order due to sorting
    });

    test('merges schema information for the same table referenced multiple times in UNION query', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name FROM users as u
            UNION
            SELECT u.id, u.email FROM users as u
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['email', 'id', 'name']); // Adjusted order due to sorting
    });

    test('collects schema information from three UNION queries', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name FROM users as u
            UNION
            SELECT u.id, u.email FROM users as u
            UNION
            SELECT u.id, u.address FROM users as u
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['address', 'email', 'id', 'name']); // Adjusted order due to sorting
    });

    test('collects schema information from CTE used in FROM clause', () => {
        // Arrange
        const sql = `
            WITH cte_users AS (
                SELECT id, name FROM users
            )
            SELECT cte_users.id, cte_users.name FROM cte_users
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
    });

    test('handles queries with omitted table names for columns when there is only one table', () => {
        // Arrange
        const sql = `
            SELECT id, name FROM users
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
    });

    test('collects schema information from CTE used in JOIN clause', () => {
        // Arrange
        const sql = `
            WITH cte_orders AS (
                SELECT order_id, user_id FROM orders
            )
            SELECT u.id, u.name, cte_orders.order_id FROM users u
            JOIN cte_orders ON u.id = cte_orders.user_id
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(2);
        expect(schemaInfo[0].name).toBe('orders'); // Adjusted order due to sorting
        expect(schemaInfo[0].columns).toEqual(['order_id', 'user_id']); // Adjusted order due to sorting
        expect(schemaInfo[1].name).toBe('users'); // Adjusted order due to sorting
        expect(schemaInfo[1].columns).toEqual(['id', 'name']); // Adjusted order due to sorting
    });

    test('collects schema information from subquery in FROM clause', () => {
        // Arrange
        const sql = `
            SELECT sq.id, sq.name FROM (
                SELECT id, name FROM users
            ) AS sq
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
    });

    test('collects schema information from subquery in JOIN clause', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name, sq.total FROM users u
            JOIN (
                SELECT user_id, SUM(amount) as total FROM orders GROUP BY user_id
            ) AS sq ON u.id = sq.user_id
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(2);
        expect(schemaInfo[0].name).toBe('orders'); // Adjusted order due to sorting
        expect(schemaInfo[0].columns).toEqual(['amount', 'user_id']); // Adjusted order due to sorting
        expect(schemaInfo[1].name).toBe('users'); // Adjusted order due to sorting
        expect(schemaInfo[1].columns).toEqual(['id', 'name']); // Adjusted order due to sorting
    });

    test('collects schema information from complex multi-join query', () => {
        // Arrange
        // This test checks that all tables in a multi-join query are detected and their columns are collected
        const sql = `
            SELECT
                posts.post_id,
                posts.title,
                users.name AS author_name,
                comments.content AS comment_content,
                comment_users.name AS comment_author_name,
                categories.name AS category_name
            FROM posts
            JOIN users
                ON posts.user_id = users.user_id
            JOIN post_categories
                ON posts.post_id = post_categories.post_id
            JOIN categories
                ON post_categories.category_id = categories.category_id
            LEFT JOIN comments
                ON comments.post_id = posts.post_id
            LEFT JOIN users AS comment_users
                ON comments.user_id = comment_users.user_id
            WHERE categories.name = 'Tech';
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        // Should collect all involved tables
        const tableNames = schemaInfo.map(s => s.name).sort();
        expect(tableNames).toEqual([
            'categories',
            'comments',
            'post_categories',
            'posts',
            'users',
        ].sort());

        // Check that at least the expected columns are present for each table
        // (Order and presence may depend on parser implementation)
        const posts = schemaInfo.find(s => s.name === 'posts');
        if (!posts) throw new Error('posts table not found');
        expect(posts.columns).toEqual(expect.arrayContaining(['post_id', 'title', 'user_id']));

        const users = schemaInfo.find(s => s.name === 'users');
        if (!users) throw new Error('users table not found');
        expect(users.columns).toEqual(expect.arrayContaining(['user_id', 'name']));

        const comments = schemaInfo.find(s => s.name === 'comments');
        if (!comments) throw new Error('comments table not found');
        expect(comments.columns).toEqual(expect.arrayContaining(['post_id', 'user_id', 'content']));

        const postCategories = schemaInfo.find(s => s.name === 'post_categories');
        if (!postCategories) throw new Error('post_categories table not found');
        expect(postCategories.columns).toEqual(expect.arrayContaining(['post_id', 'category_id']));

        const categories = schemaInfo.find(s => s.name === 'categories');
        if (!categories) throw new Error('categories table not found');
        expect(categories.columns).toEqual(expect.arrayContaining(['category_id', 'name']));
    });
});

describe('SchemaCollector with TableColumnResolver', () => {
    test('resolves wildcard columns using TableColumnResolver', () => {
        // Arrange
        const sql = `SELECT * FROM users`;
        const query = SelectQueryParser.parse(sql);
        const mockResolver: TableColumnResolver = (tableName) => {
            if (tableName === 'users') {
                return ['id', 'name', 'email'];
            }
            return [];
        };
        const collector = new SchemaCollector(mockResolver);

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(new Set(schemaInfo[0].columns)).toStrictEqual(new Set(['id', 'name', 'email']));
    });

    test('resolves wildcard columns with alias using TableColumnResolver', () => {
        // Arrange
        const sql = `SELECT u.* FROM users as u`;
        const query = SelectQueryParser.parse(sql);
        const mockResolver: TableColumnResolver = (tableName) => {
            if (tableName === 'users') {
                return ['id', 'name', 'email'];
            }
            return [];
        };
        const collector = new SchemaCollector(mockResolver);

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(new Set(schemaInfo[0].columns)).toStrictEqual(new Set(['id', 'name', 'email']));
    });

    test('throws error for wildcard columns without TableColumnResolver', () => {
        // Arrange
        const sql = `SELECT * FROM users`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector(); // No TableColumnResolver provided

        // Act & Assert
        expect(() => {
            collector.collect(query);
        }).toThrowError("Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards.");
    });

    test('throws error for wildcard columns with alias without TableColumnResolver', () => {
        // Arrange
        const sql = `SELECT u.* FROM users as u`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector(); // No TableColumnResolver provided

        // Act & Assert
        expect(() => {
            collector.collect(query);
        }).toThrowError(`Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards. Target table: u`);
    });
});
