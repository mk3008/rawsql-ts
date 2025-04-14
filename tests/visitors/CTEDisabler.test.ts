import { describe, expect, test } from 'vitest';
import { CTEDisabler } from '../../src/visitors/CTEDisabler';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/visitors/Formatter';

const formatter = new Formatter();

describe('CTEDisabler', () => {
    test('disables simple WITH clause', () => {
        // Arrange
        const sql = `
            WITH temp_sales AS (
                SELECT * FROM sales WHERE date >= '2024-01-01'
            )
            SELECT * FROM temp_sales
        `;
        const query = SelectQueryParser.parseFromText(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.visit(disabledQuery);

        // Assert
        expect(result).toBe('select * from "temp_sales"');
    });

    test('disables multiple WITH clauses', () => {
        // Arrange
        const sql = `
            WITH 
                sales_2024 AS (
                    SELECT * FROM sales WHERE year = 2024
                ),
                top_products AS (
                    SELECT product_id, SUM(quantity) as total 
                    FROM sales_2024 
                    GROUP BY product_id 
                    ORDER BY total DESC 
                    LIMIT 10
                )
            SELECT p.name, tp.total
            FROM products p
            JOIN top_products tp ON p.id = tp.product_id
        `;
        const query = SelectQueryParser.parseFromText(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.visit(disabledQuery);

        // Assert
        expect(result).toBe('select "p"."name", "tp"."total" from "products" as "p" join "top_products" as "tp" on "p"."id" = "tp"."product_id"');
    });

    test('disables recursive WITH clause', () => {
        // Arrange
        const sql = `
            WITH RECURSIVE employees_path(id, name, path) AS (
                SELECT id, name, CAST(id AS TEXT) as path 
                FROM employees 
                WHERE manager_id IS NULL
                UNION ALL
                SELECT e.id, e.name, ep.path || '->' || CAST(e.id AS TEXT)
                FROM employees e 
                JOIN employees_path ep ON e.manager_id = ep.id
            )
            SELECT * FROM employees_path
        `;
        const query = SelectQueryParser.parseFromText(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.visit(disabledQuery);

        // Assert
        expect(result).toBe('select * from "employees_path"');
    });

    test('disables nested WITH clauses in subqueries', () => {
        // Arrange
        const sql = `
            SELECT * 
            FROM (
                WITH nested_cte AS (
                    SELECT id, value FROM data WHERE type = 'important'
                )
                SELECT * FROM nested_cte
            ) AS subquery
        `;
        const query = SelectQueryParser.parseFromText(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.visit(disabledQuery);

        // Assert
        expect(result).toBe('select * from (select * from "nested_cte") as "subquery"');
    });

    test('disables WITH clauses in both parts of UNION queries', () => {
        // Arrange
        const sql = `
            WITH cte1 AS (SELECT id FROM table1)
            SELECT * FROM cte1
            UNION
            WITH cte2 AS (SELECT id FROM table2)
            SELECT * FROM cte2
        `;
        const query = SelectQueryParser.parseFromText(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.visit(disabledQuery);

        // Assert
        expect(result).toBe('select * from "cte1" union select * from "cte2"');
    });

    test('disables WITH clauses in complex query with multiple nesting levels', () => {
        // Arrange
        const sql = `
            WITH outer_cte AS (
                SELECT * FROM (
                    WITH inner_cte AS (
                        SELECT id, name FROM users
                    )
                    SELECT ic.*
                    FROM inner_cte ic
                    JOIN (
                        WITH deepest_cte AS (
                            SELECT * FROM profiles
                        )
                        SELECT * FROM deepest_cte
                    ) AS deep ON ic.id = deep.user_id
                ) AS mid
            )
            SELECT * FROM outer_cte
        `;
        const query = SelectQueryParser.parseFromText(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.visit(disabledQuery);

        // Assert
        expect(result).toBe('select * from "outer_cte"');
    });

    test('disables WITH clauses in WHERE clause subqueries', () => {
        // Arrange
        const sql = `
            SELECT *
            FROM users
            WHERE department_id IN (
                WITH top_departments AS (
                    SELECT id FROM departments WHERE budget > 1000000
                )
                SELECT id FROM top_departments
            )
        `;
        const query = SelectQueryParser.parseFromText(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.visit(disabledQuery);

        // Assert
        expect(result).toBe('select * from "users" where "department_id" in (select "id" from "top_departments")');
    });

    test('preserves query semantics after disabling WITH clauses', () => {
        // Arrange
        const sql = `
            WITH filtered_data AS (
                SELECT * FROM raw_data WHERE status = 'active'
            )
            SELECT 
                id, 
                name, 
                COUNT(*) as total_count
            FROM filtered_data
            GROUP BY id, name
            HAVING COUNT(*) > 10
            ORDER BY total_count DESC
            LIMIT 5
        `;
        const query = SelectQueryParser.parseFromText(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.visit(disabledQuery);

        // Assert
        expect(result).toBe('select "id", "name", count(*) as "total_count" from "filtered_data" group by "id", "name" having count(*) > 10 order by "total_count" desc limit 5');
    });

    test('properly handles circular references', () => {
        // Arrange
        const sql = `
            WITH cte1 AS (
                SELECT * FROM table1 WHERE id IN (SELECT id FROM table2)
            )
            SELECT * 
            FROM cte1
            WHERE id IN (
                SELECT id FROM cte1 WHERE name = 'test'
            )
        `;
        const query = SelectQueryParser.parseFromText(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.visit(disabledQuery);

        // Assert
        expect(result).toBe('select * from "cte1" where "id" in (select "id" from "cte1" where "name" = \'test\')');
    });
});