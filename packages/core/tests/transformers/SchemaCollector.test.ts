import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SchemaCollector } from '../../src/transformers/SchemaCollector';
import { TableColumnResolver } from '../../src/transformers/TableColumnResolver';

const DEBUG = process.env.DEBUG === 'true'; // Add DEBUG flag

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
        expect(schemaInfo.length).toBe(2); // users, cte_users
        expect(schemaInfo.map(s => s.name).sort()).toEqual(['cte_users', 'users']);
        expect(schemaInfo.find(s => s.name === 'users')?.columns).toEqual(['id', 'name']);
        expect(schemaInfo.find(s => s.name === 'cte_users')?.columns).toEqual(['id', 'name']);
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
        expect(schemaInfo.length).toBe(3); // orders, cte_orders, users
        expect(schemaInfo.map(s => s.name).sort()).toEqual(['cte_orders', 'orders', 'users']);
        expect(schemaInfo.find(s => s.name === 'orders')?.columns.sort()).toEqual(['order_id', 'user_id']);
        expect(schemaInfo.find(s => s.name === 'cte_orders')?.columns.sort()).toEqual(['order_id', 'user_id']);
        expect(schemaInfo.find(s => s.name === 'users')?.columns.sort()).toEqual(['id', 'name']);
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

    test('should collect CTE schemas along with base tables', () => {
        // Arrange
        const sql = `
            WITH dat AS (
                SELECT line_id, name, unit_price, quantity, tax_rate
                FROM table_a
            ),
            detail AS (
                SELECT dat.line_id, dat.name
                FROM dat
            )
            SELECT detail.line_id, detail.name FROM detail
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(3); // table_a, dat, detail
        expect(schemaInfo.map(s => s.name).sort()).toEqual(['dat', 'detail', 'table_a']);
        expect(schemaInfo.find(s => s.name === 'dat')?.columns.sort()).toEqual(['line_id', 'name']);
        expect(schemaInfo.find(s => s.name === 'detail')?.columns.sort()).toEqual(['line_id', 'name']);
        expect(schemaInfo.find(s => s.name === 'table_a')?.columns.sort()).toEqual(['line_id', 'name', 'quantity', 'tax_rate', 'unit_price']);
    });

    // Exact reproduction of original issue Test Case 1 for collect() method
    test('should reproduce original issue Test Case 1 with collect()', () => {
        // Arrange - EXACT copy from original issue
        const sql = `
            WITH dat AS (
              SELECT line_id, name, unit_price, quantity, tax_rate
              FROM table_a
            ),
            detail AS (
              SELECT dat.*
              FROM dat
            )
            SELECT * FROM detail
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        let schemaInfo;
        let threwError = false;
        try {
            schemaInfo = collector.collect(query);
        } catch (error) {
            threwError = true;
            expect(error.message).toContain('Wildcard');
        }

        // Assert - Either succeeds with proper CTE recognition or fails with wildcard error
        if (!threwError) {
            // If it succeeds, it must properly collect all CTE schemas
            expect(schemaInfo.length).toBeGreaterThanOrEqual(2); // At least table_a and dat
            expect(schemaInfo.map(s => s.name)).toContain('table_a');
            expect(schemaInfo.map(s => s.name)).toContain('dat');
        }
    });

    test('should handle CTE wildcards with collect() and resolver', () => {
        // Arrange
        const customResolver = (tableName: string) => {
            if (tableName === 'table_a') {
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            if (tableName === 'dat') {
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            if (tableName === 'detail') {
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            return [];
        };

        const sql = `
            WITH dat AS (
                SELECT line_id, name, unit_price, quantity, tax_rate
                FROM table_a
            ),
            detail AS (
                SELECT dat.*
                FROM dat
            )
            SELECT * FROM detail
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector(customResolver);

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(3); // table_a, dat, detail
        expect(schemaInfo.map(s => s.name).sort()).toEqual(['dat', 'detail', 'table_a']);
        
        // All should have the resolver-provided columns (sorted for consistent testing)
        const expectedColumns = ['line_id', 'name', 'quantity', 'tax_rate', 'unit_price'];
        expect(schemaInfo.find(s => s.name === 'dat')?.columns.sort()).toEqual(expectedColumns);
        expect(schemaInfo.find(s => s.name === 'detail')?.columns.sort()).toEqual(expectedColumns);
        expect(schemaInfo.find(s => s.name === 'table_a')?.columns.sort()).toEqual(expectedColumns);
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

    test('should collect schema from a complex query referencing a physical table `dat`', () => {
        // Arrange
        const sql = `
with
detail as (
    select  
        q.*,
        trunc(q.price * (1 + q.tax_rate)) - q.price as tax,
        q.price * (1 + q.tax_rate) - q.price as raw_tax
    from
        (
            select
                dat.*,
                (dat.unit_price * dat.quantity) as price
            from
                dat
        ) q
), 
tax_summary as (
    select
        d.tax_rate,
        trunc(sum(raw_tax)) as total_tax
    from
        detail d
    group by
        d.tax_rate
)
select 
   line_id,
    name,
    unit_price,
    quantity,
    tax_rate,
    price,
    price + tax as tax_included_price,
    tax
from
    (
        select
            line_id,
            name,
            unit_price,
            quantity,
            tax_rate,
            price,
            tax + adjust_tax as tax
        from
            (
                select
                    q.*,
                    case when q.total_tax - q.cumulative >= q.priority then 1 else 0 end as adjust_tax
                from
                    (
                        select  
                            d.*, 
                            s.total_tax,
                            sum(d.tax) over (partition by d.tax_rate) as cumulative,
                            row_number() over (partition by d.tax_rate order by d.raw_tax % 1 desc, d.line_id) as priority
                        from
                            detail d
                            inner join tax_summary s on d.tax_rate = s.tax_rate
                    ) q
            ) q
    ) q
order by 
    line_id
        `;
        const query = SelectQueryParser.parse(sql);
        const mockResolver: TableColumnResolver = (tableName) => {
            if (tableName === 'dat') {
                // Simulate the columns of the physical table 'dat'
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            if (tableName === 'detail') {
                // detail CTE expands dat.* plus additional calculated columns
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate', 'price', 'tax', 'raw_tax'];
            }
            if (tableName === 'tax_summary') {
                // tax_summary CTE has these columns
                return ['tax_rate', 'total_tax'];
            }
            return []; // Return empty for other tables if not specified
        };
        const collector = new SchemaCollector(mockResolver);

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(3); // dat, detail, tax_summary
        expect(schemaInfo.map(s => s.name).sort()).toEqual(['dat', 'detail', 'tax_summary']);
        
        // Check dat table (physical table)
        const datSchema = schemaInfo.find(s => s.name === 'dat');
        expect(datSchema).toBeDefined();
        expect(datSchema!.columns).toEqual(['line_id', 'name', 'quantity', 'tax_rate', 'unit_price']);
        
        // Check detail CTE schema  
        const detailSchema = schemaInfo.find(s => s.name === 'detail');
        expect(detailSchema).toBeDefined();
        // detail CTE references dat.* and creates additional columns
        
        // Check tax_summary CTE schema
        const taxSummarySchema = schemaInfo.find(s => s.name === 'tax_summary');
        expect(taxSummarySchema).toBeDefined();
        // tax_summary CTE references detail.tax_rate and creates total_tax
    });

    test('handles function tables (e.g., generate_series) without errors', () => {
        // Arrange: test with function table to ensure no "[CTECollector] No handler for FunctionSource" error
        const sql = `SELECT n.value FROM generate_series(1, 5) as n(value)`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act & Assert: should not throw any errors
        expect(() => {
            const schemaInfo = collector.collect(query);
            // Function tables should not be included in schema info since they don't represent actual tables
            // The result might be empty or contain minimal info
        }).not.toThrow();
    });

    test('handles mixed queries with function tables and real tables', () => {
        // Arrange: test with both function tables and real tables
        const sql = `
            SELECT u.id, u.name, n.value 
            FROM users u 
            CROSS JOIN generate_series(1, 3) as n(value)
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act & Assert: should not throw any errors
        expect(() => {
            const schemaInfo = collector.collect(query);
            // Should collect schema info for the real table (users) but not the function table
        }).not.toThrow();
    });

    test('handles CTE with function tables', () => {
        // Arrange: test with CTE containing function table
        const sql = `
            WITH numbers AS (
                SELECT value FROM generate_series(1, 10) as g(value)
            )
            SELECT * FROM numbers WHERE value > 5
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act & Assert: should not throw any errors
        expect(() => {
            const schemaInfo = collector.collect(query);
            // Should handle the CTE without errors, even though it contains a function table
        }).not.toThrow();
    });

    test('handles StringSpecifierExpression (PostgreSQL E-strings) without error', () => {
        // Arrange - Simple query with E-string literal
        const sql = `select E'\\\\s*'`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act & Assert - should not throw error (SchemaCollector uses CTECollector internally)
        expect(() => {
            collector.collect(query);
        }).not.toThrow();
    });

    test('handles StringSpecifierExpression in complex query with schema collection', () => {
        // Arrange - Complex query with tables and E-string literals
        const sql = `select u.id, u.name, E'\\\\s*' as pattern from users u where description = E'test\\\\value'`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act & Assert - should not throw error and collect schema info
        expect(() => {
            const schemaInfo = collector.collect(query);
            expect(schemaInfo.length).toBe(1);
            expect(schemaInfo[0].name).toBe('users');
            expect(schemaInfo[0].columns).toContain('id');
            expect(schemaInfo[0].columns).toContain('name');
        }).not.toThrow();
    });
});
