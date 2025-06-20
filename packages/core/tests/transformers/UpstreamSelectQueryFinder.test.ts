import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { UpstreamSelectQueryFinder } from '../../src/transformers/UpstreamSelectQueryFinder';
import { SqlFormatter } from '../../src/transformers/Formatter';
import { SelectableColumnCollector } from '../../src/transformers/SelectableColumnCollector';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

function getRawSQL(query: any): string {
    // Use Formatter to convert SelectQuery to SQL string
    const formatter = new SqlFormatter();
    return formatter.format(query).formattedSql.trim();
}

describe('UpstreamSelectQueryFinder Demo', () => {
    test('finds upstream query for columns in simple CTE', () => {
        // Arrange
        const sql = `
            WITH temp_sales AS (
                SELECT id, amount, date FROM sales WHERE date >= '2024-01-01'
            )
            SELECT * FROM temp_sales
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['id', 'amount']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        expect(foundSQLs).toContain(
            'select "id", "amount", "date" from "sales" where "date" >= \'2024-01-01\''
        );
    });

    test('finds upstream query for columns in nested CTE', () => {
        // Arrange
        const sql = `
            WITH inner_cte AS (
                SELECT id, value FROM data
            ),
            outer_cte AS (
                SELECT * FROM inner_cte
            )
            SELECT * FROM outer_cte
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['id', 'value']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        expect(foundSQLs).toContain(
            'select "id", "value" from "data"'
        );
    });

    test('finds upstream query for columns in nested subquery', () => {
        // Arrange
        const sql = `
            SELECT *
            FROM (
                SELECT id, price
                FROM (
                    SELECT id, price FROM products WHERE price > 100
                ) AS inner_sub
            ) AS outer_sub
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['id', 'price']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        expect(foundSQLs).toContain(
            'select "id", "price" from "products" where "price" > 100'
        );
    });

    test('skips ValuesQuery and finds correct upstream', () => {
        // Arrange
        const sql = `
            WITH t1 AS (SELECT id, name FROM users)
            SELECT * FROM t1
            UNION ALL
            VALUES (1, 'dummy')
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['id', 'name']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        expect(foundSQLs).toContain(
            'select "id", "name" from "users"'
        );
    });

    test('finds multiple upstream queries in unioned subqueries with CTE references', () => {
        // Arrange
        const sql = `
            WITH cte_a AS (
                SELECT id, val FROM table_a
            ),
            cte_b AS (
                SELECT id, val FROM table_b
            )
            SELECT * FROM (
                SELECT id, val FROM cte_a WHERE val > 10
                UNION ALL
                SELECT id, val FROM cte_b WHERE val < 100
            ) AS unioned_sub
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['id', 'val']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        // Expect both CTE base queries to be found
        expect(foundSQLs).toContain('select "id", "val" from "table_a"');
        expect(foundSQLs).toContain('select "id", "val" from "table_b"');
        expect(foundSQLs.length).toBe(2);
    });

    test('finds columns with wildcard expansion using tableColumnResolver', () => {
        // Arrange
        const sql = `
            SELECT u.*, p.title
            FROM users AS u
            JOIN posts AS p ON u.id = p.user_id
        `;
        // Prepare a resolver that returns table structure
        const tableColumnResolver = (tableName: string): string[] => {
            if (tableName === 'users') return ['id', 'name', 'email', 'created_at'];
            if (tableName === 'posts') return ['id', 'title', 'content', 'user_id', 'created_at'];
            return [];
        };
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder(tableColumnResolver);

        // Act
        const result = finder.find(query, ['id', 'name', 'email', 'created_at', 'title']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        // The SELECT should include all columns of the users table and posts.title
        expect(foundSQLs[0]).toBe('select "u".*, "p"."title" from "users" as "u" join "posts" as "p" on "u"."id" = "p"."user_id"');
    });

    test('ambiguous: CTE and physical table have the same name', () => {
        // Arrange
        const sql = `
            WITH users AS (
                SELECT id, name FROM users WHERE active = true
            )
            SELECT * FROM users
        `;
        // Table resolver returns columns for the physical table
        const tableColumnResolver = (tableName: string): string[] => {
            if (tableName === 'users') return ['id', 'name', 'email'];
            return [];
        };
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder(tableColumnResolver);

        // Act
        const result = finder.find(query, ['id', 'name']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        // Both CTE and physical table could match, but CTE should be prioritized
        expect(foundSQLs[0]).toBe('select "id", "name" from "users" where "active" = true');
    });

    test('ambiguous: CTE and subquery use the same alias', () => {
        // Arrange
        const sql = `
            WITH data AS (
                SELECT id FROM users
            )
            SELECT * FROM (
                SELECT id FROM data
            ) AS data
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['id']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        // Should find the subquery, not the CTE
        expect(foundSQLs[0]).toBe('select "id" from "users"');
    });

    test('union: only one branch satisfies the condition', () => {
        // Arrange
        const sql = `
            SELECT id, name FROM users
            UNION ALL
            SELECT id FROM admins
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['id', 'name']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        // Only the first branch should be found
        expect(foundSQLs).toContain('select "id", "name" from "users"');
        expect(foundSQLs.length).toBe(1);
    });

    test('finds only the matching branch in UNION when columns differ', () => {
        // Arrange
        const sql = `
            SELECT id, name FROM users where age > 18
            UNION ALL
            SELECT id, name FROM admins
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['id', 'name', 'age']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        // Only the first branch (users) should match all columns
        expect(foundSQLs).toContain('select "id", "name" from "users" where "age" > 18');
        expect(foundSQLs.length).toBe(1);
    });

    test('finds both branches in UNION subquery with * when all columns are present', () => {
        // Arrange
        const sql = `
            SELECT *
            FROM (
                SELECT id, name, age FROM users where age > 18
                UNION ALL
                SELECT id, name, 0 as age FROM admins
            ) d
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['id', 'name', 'age']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        // Both branches should be found because both have id, name, age
        expect(foundSQLs).toContain('select "id", "name", "age" from "users" where "age" > 18');
        expect(foundSQLs).toContain('select "id", "name", 0 as "age" from "admins"');
        expect(foundSQLs.length).toBe(2);
    });

    test('recursive: nested CTE with the same name', () => {
        // Arrange
        const sql = `
            WITH RECURSIVE org AS (
                SELECT id, parent_id FROM org WHERE parent_id IS NOT NULL
                UNION ALL
                SELECT o.id, o.parent_id FROM org o JOIN org r ON o.parent_id = r.id
            )
            SELECT * FROM org
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['id', 'parent_id']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        // Should find both the base and recursive part
        expect(foundSQLs.some(sql => sql.includes('select "id", "parent_id" from "org" where "parent_id" is not null'))).toBe(true);
        expect(foundSQLs.some(sql => sql.includes('select "o"."id", "o"."parent_id" from "org" as "o" join "org" as "r" on "o"."parent_id" = "r"."id"'))).toBe(true);
    });

    test('finds column by alias in select clause', () => {
        // Arrange
        const sql = `
            SELECT u.id AS user_id
            FROM users AS u
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const result = finder.find(query, ['user_id']);

        // Assert
        const foundSQLs = result.map(getRawSQL);
        // Should find the query with the alias user_id
        expect(foundSQLs[0]).toBe('select "u"."id" as "user_id" from "users" as "u"');
    });

    test('should work correctly with appendWhereRaw on upstream queries', () => {
        // Arrange
        const sql = `
            WITH sales_transactions AS (
                SELECT
                    transaction_id,
                    customer_id,
                    amount,
                    transaction_date,
                    'sales' AS source
                FROM sales_schema.transactions
                WHERE transaction_date >= CURRENT_DATE - INTERVAL '90 days'
            ),
            support_transactions AS (
                SELECT
                    support_id AS transaction_id,
                    user_id AS customer_id,
                    fee AS amount,
                    support_date AS transaction_date,
                    'support' AS source
                FROM support_schema.support_fees
                WHERE support_date >= CURRENT_DATE - INTERVAL '90 days'
            )
            SELECT * FROM (
                SELECT *
                FROM sales_transactions
                UNION ALL
                SELECT *
                FROM support_transactions
            ) d
            ORDER BY transaction_date DESC`;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        // Find upstream queries that contain the column "amount".
        const collector = new SelectableColumnCollector();
        const queries = finder.find(query, ['amount']);
        // For each upstream query, retrieve the expression for the "amount" column.
        queries.forEach((q) => {
            const exprs = collector.collect(q).filter(item => item.name == 'amount').map(item => item.value);
            // Ensure exactly one expression is found for the "amount" column.
            if (exprs.length !== 1) {
                throw new Error('Expected exactly one expression for "amount" column');
            }
            // Convert the expression back to a string representation.
            const f = new SqlFormatter();
            const expr = f.format(exprs[0]).formattedSql;
            // Add a search condition using the "amount" expression to the upstream query.
            q.appendWhereRaw(`${expr} > 100`);
        });

        // Assert
        const formatter = new SqlFormatter();
        const actual = formatter.format(query).formattedSql;

        // Assert
        // NOTE: sales_transactions will be filtered by amount.
        // NOTE: support_transactions will be filtered by fee (alias: amount).
        const expected = `with "sales_transactions" as (
            select "transaction_id", "customer_id", "amount", "transaction_date", 'sales' as "source"
            from "sales_schema"."transactions"
            where "transaction_date" >= current_date - INTERVAL '90 days'
                and "amount" > 100
        ),
        "support_transactions" as (
            select "support_id" as "transaction_id", "user_id" as "customer_id", "fee" as "amount", "support_date" as "transaction_date", 'support' as "source"
            from "support_schema"."support_fees"
            where "support_date" >= current_date - INTERVAL '90 days'
                and "fee" > 100
        )
        select * from (
            select *
            from "sales_transactions"
            union all
            select * from
            "support_transactions"
        ) as "d"
        order by "transaction_date" desc`;
        // Compare ignoring whitespace, newlines, and tabs
        const normalize = (str: string) => str.replace(/\s+/g, '');
        expect(normalize(actual)).toBe(normalize(expected));
    });

    test('appendWhereExpr', () => {
        // Arrange
        const sql = `
            WITH sales_transactions AS (
                SELECT
                    transaction_id,
                    customer_id,
                    amount,
                    transaction_date,
                    'sales' AS source
                FROM sales_schema.transactions
                WHERE transaction_date >= CURRENT_DATE - INTERVAL '90 days'
            ),
            support_transactions AS (
                SELECT
                    support_id AS transaction_id,
                    user_id AS customer_id,
                    fee AS amount,
                    support_date AS transaction_date,
                    'support' AS source
                FROM support_schema.support_fees
                WHERE support_date >= CURRENT_DATE - INTERVAL '90 days'
            )
            SELECT * FROM (
                SELECT *
                FROM sales_transactions
                UNION ALL
                SELECT *
                FROM support_transactions
            ) d
            ORDER BY transaction_date DESC`;
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        // Act
        query.appendWhereExpr('amount', expr => `${expr} > 100`, { upstream: true });

        // Assert
        const formatter = new SqlFormatter();
        const actual = formatter.format(query).formattedSql;

        // Assert
        // NOTE: sales_transactions will be filtered by amount.
        // NOTE: support_transactions will be filtered by fee (alias: amount).
        const expected = `with "sales_transactions" as (
            select "transaction_id", "customer_id", "amount", "transaction_date", 'sales' as "source"
            from "sales_schema"."transactions"
            where "transaction_date" >= current_date - INTERVAL '90 days'
                and "amount" > 100
        ),
        "support_transactions" as (
            select "support_id" as "transaction_id", "user_id" as "customer_id", "fee" as "amount", "support_date" as "transaction_date", 'support' as "source"
            from "support_schema"."support_fees"
            where "support_date" >= current_date - INTERVAL '90 days'
                and "fee" > 100
        )
        select * from (
            select *
            from "sales_transactions"
            union all
            select * from
            "support_transactions"
        ) as "d"
        order by "transaction_date" desc`;
        // Compare ignoring whitespace, newlines, and tabs
        const normalize = (str: string) => str.replace(/\s+/g, '');
        expect(normalize(actual)).toBe(normalize(expected));
    });

    test('finds upstream queries in UNION branches independently', () => {
        // Arrange
        const sql = `
            WITH users_cte AS (
                SELECT id, name FROM users
            ),
            products_cte AS (
                SELECT id, title FROM products
            )
            SELECT id, name FROM users_cte
            UNION
            SELECT id, title as name FROM products_cte
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act - Search for columns that exist in both branches
        const result = finder.find(query, ['id']);

        // Assert - Should find upstream queries from both UNION branches
        expect(result).toHaveLength(2);
        const foundSQLs = result.map(getRawSQL);
        expect(foundSQLs).toContain('select "id", "name" from "users"');
        expect(foundSQLs).toContain('select "id", "title" from "products"');
    });

    test('finds upstream queries in UNION branches with different column availability', () => {
        // Arrange
        const sql = `
            WITH users_cte AS (
                SELECT id, name, email FROM users
            ),
            products_cte AS (
                SELECT id, title FROM products
            )
            SELECT id, name FROM users_cte
            UNION
            SELECT id, title as name FROM products_cte
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act - Search for 'email' column which only exists in users_cte
        const result = finder.find(query, ['email']);

        // Assert - Should only find upstream query from users branch
        expect(result).toHaveLength(1);
        const foundSQLs = result.map(getRawSQL);
        expect(foundSQLs).toContain('select "id", "name", "email" from "users"');
        expect(foundSQLs).not.toContain('select "id", "title" from "products"');
    });

    test('handles complex nested UNION with CTEs', () => {
        // Arrange
        const sql = `
            WITH base_data AS (
                SELECT id, value, category FROM data_table
            ),
            filtered_a AS (
                SELECT id, value FROM base_data WHERE category = 'A'
            ),
            filtered_b AS (
                SELECT id, value FROM base_data WHERE category = 'B'  
            )
            SELECT * FROM (
                SELECT id, value FROM filtered_a
                UNION ALL
                SELECT id, value FROM filtered_b
            ) combined
        `;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act - Search for columns that should be found in base_data through both branches
        const result = finder.find(query, ['value']);

        // Assert - Should find the base_data query through both filtration paths
        expect(result.length).toBeGreaterThan(0);
        const foundSQLs = result.map(getRawSQL);
        expect(foundSQLs).toContain('select "id", "value", "category" from "data_table"');
    });
});
