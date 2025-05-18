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

    test('should collect schema from a query with a subquery source aliased and referenced with wildcard', () => {
        const sql = 'select a.* from (select id, name from table_a) as a';
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();
        const result = collector.collect(query);
        // This might fail or produce unexpected results, which is the goal for now
        console.log('Subquery Alias Test Result:', JSON.stringify(result, null, 2));
        // For now, we'll just check if it runs without throwing a *different* kind of error
        // and later refine assertions based on expected behavior or error.
        expect(result).toBeDefined();
    });

    test('should collect schema from a query with a CTE aliased and referenced with wildcard', () => {
        const sql = 'with a as (select id, category from table_a) select a.* from a';
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();
        const result = collector.collect(query);
        // This might fail or produce unexpected results, which is the goal for now
        console.log('CTE Alias Test Result:', JSON.stringify(result, null, 2));
        // For now, we'll just check if it runs without throwing a *different* kind of error
        // and later refine assertions based on expected behavior or error.
        expect(result).toBeDefined();
    });

    test('should collect schema from a complex query with multiple CTEs, subqueries, and window functions', () => {
        const sql = `
with
dat(line_id, name, unit_price, quantity, tax_rate) as ( 
    values
    (1, 'apple' , 105, 5, 0.07),
    (2, 'orange', 203, 3, 0.07),
    (3, 'banana', 233, 9, 0.07),
    (4, 'tea'   , 309, 7, 0.08),
    (5, 'coffee', 555, 9, 0.08),
    (6, 'matcha', 456, 2, 0.08)
),
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
        const collector = new SchemaCollector();
        const result = collector.collect(query);
        // This might fail or produce unexpected results, which is the goal for now
        console.log('Complex CTE and Subquery Test Result:', JSON.stringify(result, null, 2));
        // For now, we'll just check if it runs without throwing a *different* kind of error
        // and later refine assertions based on expected behavior or error.
        expect(result).toBeDefined();
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
