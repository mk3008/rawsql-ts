import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { UpstreamSelectQueryFinder } from '../../src/transformers/UpstreamSelectQueryFinder';
import { Formatter } from '../../src/transformers/Formatter';
import { SelectableColumnCollector } from '../../src/transformers/SelectableColumnCollector';

function getRawSQL(query: any): string {
    // Use Formatter to convert SelectQuery to SQL string
    const formatter = new Formatter();
    return formatter.format(query).trim();
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
            SELECT *
            FROM sales_transactions
            UNION ALL
            SELECT *
            FROM support_transactions
            ORDER BY transaction_date DESC`;
        const query = SelectQueryParser.parse(sql);
        const finder = new UpstreamSelectQueryFinder();

        // Act
        const collector = new SelectableColumnCollector();
        const queries = finder.find(query, ['amount']);
        queries.forEach((q) => {
            const exprs = collector.collect(q).filter(item => item.name == 'amount').map(item => item.value);
            if (exprs.length !== 1) {
                throw new Error('Expected exactly one expression for "amount" column');
            }
            const f = new Formatter();
            const expr = f.format(exprs[0]);
            q.appendWhereRaw(`${expr} > 100`);
        });

        // Assert
        const formatter = new Formatter();
        const actual = formatter.format(query);

        // Assert
        // NOTE: sales_transactions will be filtered by amount.
        // NOTE: support_transactions will be filtered by fee (alias: amount).
        const excepted = `with "sales_transactions" as (
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
        select *
        from "sales_transactions"
        union all
        select * from
        "support_transactions"
        order by "transaction_date" desc`;
        // Compare ignoring whitespace, newlines, and tabs
        const normalize = (str: string) => str.replace(/\s+/g, '');
        expect(normalize(actual)).toBe(normalize(excepted));
    });
});
