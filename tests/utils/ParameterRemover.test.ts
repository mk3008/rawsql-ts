import { expect, test, describe } from 'vitest';
import { ValueParser } from '../../src/parsers/ValueParser';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { WhereClause } from '../../src/models/Clause';
import { ParameterRemover } from '../../src/utils/ParameterRemover';

describe('ParameterRemover', () => {
    describe('SqlComponent-level unit tests', () => {
        test('removes binary expression with parameter on right side', () => {
            // Arrange
            const rawSql = 'id = :id';
            const valueObject = ValueParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(valueObject);

            // Assert
            expect(result).toBeNull();
        });

        test('removes binary expression with parameter on left side', () => {
            // Arrange
            const rawSql = ':id = 123';
            const valueObject = ValueParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(valueObject);

            // Assert
            expect(result).toBeNull();
        });

        test('keeps binary expression without parameters', () => {
            // Arrange
            const rawSql = 'id = 123';
            const valueObject = ValueParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(valueObject);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const actualSql = formattedResult.formattedSql;

            const expectedSql = '"id" = 123';
            expect(actualSql).toBe(expectedSql);
        });

        test('removes only parameterized part of AND expression', () => {
            // Arrange
            const rawSql = '"id" = 1 AND "name" = :name';
            const valueObject = ValueParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(valueObject);

            // Assert
            expect(result).not.toBeNull();

            const formatter = new SqlFormatter();
            const actual = formatter.format(result!).formattedSql;
            const expected = '"id" = 1';
            expect(actual).toBe(expected);
        });

        test('removes only parameterized part of OR expression', () => {
            // Arrange
            const rawSql = 'id = 1 OR name = :name';
            const valueObject = ValueParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(valueObject);

            // Assert
            expect(result).not.toBeNull();

            const formatter = new SqlFormatter();
            const actual = formatter.format(result!).formattedSql;
            const expected = '"id" = 1';
            expect(actual).toBe(expected);
        });

        test('removes where clause entirely if all conditions have parameters', () => {
            // Arrange
            const rawSql = 'id = :id';
            const valueObject = ValueParser.parse(rawSql);
            const whereClause = new WhereClause(valueObject);

            // Act
            const result = ParameterRemover.remove(whereClause);

            // Assert
            expect(result).toBeNull();
        });

        test('removes nested parameter expressions in complex condition', () => {
            // Arrange
            const rawSql = '(id = 1 AND (name = :name OR age > 18))';
            const valueObject = ValueParser.parse(rawSql);
            const whereClause = new WhereClause(valueObject);

            // Act
            const result = ParameterRemover.remove(whereClause);

            // Assert
            if (result === null) {
                expect(result).toBeNull();
                return;
            }
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result);
            const actualSql = formattedResult.formattedSql;

            const expectedSql = 'where ("id" = 1 and ("age" > 18))';
            expect(actualSql).toBe(expectedSql);
        });
    });

    describe('query-level integration tests', () => {
        test('removes parameter expressions from simple WHERE clause', () => {
            // Arrange
            const rawSql = `SELECT id, name FROM users WHERE id = :id`;
            const queryObject = SelectQueryParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(queryObject);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const actualSql = formattedResult.formattedSql;

            const expectedSql = 'select "id", "name" from "users"';
            expect(actualSql).toBe(expectedSql);
        });

        test('removes only parameterized conditions from WHERE clause', () => {
            // Arrange
            const rawSql = `SELECT id, name FROM users WHERE id > 100 AND name = :name`;
            const queryObject = SelectQueryParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(queryObject);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const actualSql = formattedResult.formattedSql;

            const expectedSql = 'select "id", "name" from "users" where "id" > 100';
            expect(actualSql).toBe(expectedSql);
        }); test('handles complex WHERE clause with mixed conditions', () => {
            // Arrange
            const rawSql = `
                SELECT id, name 
                FROM users 
                WHERE (id > 100 OR name = 'test') 
                AND (age BETWEEN :min_age AND :max_age OR status = 'active')
            `;
            const queryObject = SelectQueryParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(queryObject);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const actualSql = formattedResult.formattedSql;

            const expectedSql = 'select "id", "name" from "users" where ("id" > 100 or "name" = \'test\') and ("status" = \'active\')';
            expect(actualSql).toBe(expectedSql);
        });

        test('handles subqueries with parameters', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name 
                FROM users u
                WHERE u.id IN (SELECT o.user_id FROM orders o WHERE o.amount > :min_amount)
                      AND u.active = true
            `;
            const query = SelectQueryParser.parse(sql);

            // Act
            const result = ParameterRemover.remove(query);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const formattedSql = formattedResult.formattedSql;

            const expectedSql = 'select "u"."id", "u"."name" from "users" as "u" where "u"."id" in (select "o"."user_id" from "orders" as "o") and "u"."active" = true';
            expect(formattedSql).toBe(expectedSql);
        });

        test('handles WITH clauses with parameters', () => {
            // Arrange
            const sql = `
                WITH filtered_orders AS (
                    SELECT * FROM orders WHERE amount > :min_amount
                )
                SELECT u.id, u.name 
                FROM users u
                JOIN filtered_orders fo ON u.id = fo.user_id
                WHERE u.active = true
            `;
            const query = SelectQueryParser.parse(sql);

            // Act
            const result = ParameterRemover.remove(query);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const formattedSql = formattedResult.formattedSql;

            const expectedSql = 'with "filtered_orders" as (select * from "orders") select "u"."id", "u"."name" from "users" as "u" join "filtered_orders" as "fo" on "u"."id" = "fo"."user_id" where "u"."active" = true';
            expect(formattedSql).toBe(expectedSql);
        });

        test('handles JOIN ON conditions with parameters', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name, o.order_id
                FROM users u
                JOIN orders o ON u.id = o.user_id AND o.amount > :min_amount
            `;
            const query = SelectQueryParser.parse(sql);

            // Act
            const result = ParameterRemover.remove(query);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const formattedSql = formattedResult.formattedSql;

            const expectedSql = 'select "u"."id", "u"."name", "o"."order_id" from "users" as "u" join "orders" as "o" on "u"."id" = "o"."user_id"';
            expect(formattedSql).toBe(expectedSql);
        });

        test('handles HAVING clauses with parameters', () => {
            // Arrange
            const sql = `
                SELECT department_id, COUNT(*) as employee_count
                FROM employees
                GROUP BY department_id
                HAVING COUNT(*) > :min_count OR AVG(salary) > 50000
            `;
            const query = SelectQueryParser.parse(sql);

            // Act
            const result = ParameterRemover.remove(query);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const formattedSql = formattedResult.formattedSql; const expectedSql = 'select "department_id", count(*) as "employee_count" from "employees" group by "department_id" having avg("salary") > 50000';
            expect(formattedSql).toBe(expectedSql);
        });

        test('handles UNION queries with parameters', () => {
            // Arrange
            const sql = `
                SELECT id, name FROM users WHERE status = :status
                UNION
                SELECT id, name FROM admins WHERE role = 'super'
            `;
            const query = SelectQueryParser.parse(sql);

            // Act
            const result = ParameterRemover.remove(query);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const formattedSql = formattedResult.formattedSql;

            const expectedSql = 'select "id", "name" from "users" union select "id", "name" from "admins" where "role" = \'super\'';
            expect(formattedSql).toBe(expectedSql);
        });

        test('handles complex nested logical expressions with BETWEEN and parameters', () => {
            // Arrange - Complex case from debug scripts  
            const sql = `
                SELECT id, name 
                FROM users 
                WHERE (id > 100 OR name = 'test') 
                AND (age BETWEEN :min_age AND :max_age OR status = 'active')
            `;
            const query = SelectQueryParser.parse(sql);

            // Act
            const result = ParameterRemover.remove(query);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const formattedSql = formattedResult.formattedSql;

            const expectedSql = 'select "id", "name" from "users" where ("id" > 100 or "name" = \'test\') and ("status" = \'active\')';
            expect(formattedSql).toBe(expectedSql);
        });

        test('handles OR expression with parameter as entire left side', () => {
            // Arrange - Simple OR case from debug  
            const rawSql = 'age BETWEEN :min_age AND :max_age OR status = \'active\'';
            const valueObject = ValueParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(valueObject);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const actualSql = formattedResult.formattedSql;

            const expectedSql = '"status" = \'active\'';
            expect(actualSql).toBe(expectedSql);
        });

        test('handles deeply nested logical expressions with multiple parameters', () => {
            // Arrange - Test deeply nested case
            const rawSql = '(a = :param1 AND (b = 2 OR c = :param2)) OR (d = 4 AND e = :param3)';
            const valueObject = ValueParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(valueObject);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const actualSql = formattedResult.formattedSql; const expectedSql = '(("b" = 2)) or ("d" = 4)';
            expect(actualSql).toBe(expectedSql);
        });

        test('handles mixed BETWEEN and regular conditions with parameters', () => {
            // Arrange - Mixed conditions test 
            const rawSql = 'a BETWEEN 1 AND 5 AND (b = :param OR c BETWEEN :min AND :max)';
            const valueObject = ValueParser.parse(rawSql);

            // Act
            const result = ParameterRemover.remove(valueObject);

            // Assert
            const formatter = new SqlFormatter();
            const formattedResult = formatter.format(result!);
            const actualSql = formattedResult.formattedSql;

            const expectedSql = '"a" between 1 and 5';
            expect(actualSql).toBe(expectedSql);
        });
    });
});
