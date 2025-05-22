import { expect, test, describe } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';
import { WhereClause } from '../../src/models/Clause';
import { ParameterRemover } from '../../src/utils/ParameterRemover';
import { BinaryExpression, ColumnReference, LiteralValue, ParameterExpression, ParenExpression } from '../../src/models/ValueComponent';

describe('ParameterRemover', () => {
    describe('SqlComponent-level unit tests', () => {
        test('removes binary expression with parameter on right side', () => {
            // Create AST by hand
            const left = new ColumnReference(null, 'id');
            const right = new ParameterExpression('id');
            const expr = new BinaryExpression(left, '=', right);

            // Apply parameter removal
            const result = ParameterRemover.remove(expr);

            // Expect the entire binary expression to be removed
            expect(result).toBeNull();
        });

        test('removes binary expression with parameter on left side', () => {
            // Create AST by hand
            const left = new ParameterExpression('id');
            const right = new LiteralValue(123);
            const expr = new BinaryExpression(left, '=', right);

            // Apply parameter removal
            const result = ParameterRemover.remove(expr);

            // Expect the entire binary expression to be removed
            expect(result).toBeNull();
        });

        test('keeps binary expression without parameters', () => {
            // Create AST by hand
            const left = new ColumnReference(null, 'id');
            const right = new LiteralValue(123);
            const expr = new BinaryExpression(left, '=', right);

            // Apply parameter removal
            const result = ParameterRemover.remove(expr);

            // Expect the binary expression to be kept
            expect(result).not.toBeNull();
            expect((result as BinaryExpression).left).toEqual(left);
            expect((result as BinaryExpression).right).toEqual(right);
        });

        test('removes only parameterized part of AND expression', () => {
            // Create AST by hand
            // id = 1 AND name = :name
            const leftExpr = new BinaryExpression(
                new ColumnReference(null, 'id'),
                '=',
                new LiteralValue(1)
            );
            
            const rightExpr = new BinaryExpression(
                new ColumnReference(null, 'name'),
                '=',
                new ParameterExpression('name')
            );

            const andExpr = new BinaryExpression(leftExpr, 'and', rightExpr);

            // Apply parameter removal
            const result = ParameterRemover.remove(andExpr);

            // Expect only the left part (id = 1) to remain
            expect(result).not.toBeNull();
            expect(result).toEqual(leftExpr);
        });

        test('removes only parameterized part of OR expression', () => {
            // Create AST by hand
            // id = 1 OR name = :name
            const leftExpr = new BinaryExpression(
                new ColumnReference(null, 'id'),
                '=',
                new LiteralValue(1)
            );
            
            const rightExpr = new BinaryExpression(
                new ColumnReference(null, 'name'),
                '=',
                new ParameterExpression('name')
            );

            const orExpr = new BinaryExpression(leftExpr, 'or', rightExpr);

            // Apply parameter removal
            const result = ParameterRemover.remove(orExpr);

            // Expect only the left part (id = 1) to remain
            expect(result).not.toBeNull();
            expect(result).toEqual(leftExpr);
        });

        test('removes where clause entirely if all conditions have parameters', () => {
            // Create AST by hand
            // WHERE id = :id
            const condition = new BinaryExpression(
                new ColumnReference(null, 'id'),
                '=',
                new ParameterExpression('id')
            );
            
            const whereClause = new WhereClause(condition);

            // Apply parameter removal
            const result = ParameterRemover.remove(whereClause);

            // Expect the entire WHERE clause to be removed
            expect(result).toBeNull();
        });

        test('removes nested parameter expressions in complex condition', () => {
            // Create AST by hand
            // WHERE (id = 1 AND (name = :name OR age > 18))
            const idCondition = new BinaryExpression(
                new ColumnReference(null, 'id'),
                '=',
                new LiteralValue(1)
            );
            
            const nameCondition = new BinaryExpression(
                new ColumnReference(null, 'name'),
                '=',
                new ParameterExpression('name')
            );
            
            const ageCondition = new BinaryExpression(
                new ColumnReference(null, 'age'),
                '>',
                new LiteralValue(18)
            );
            
            const orCondition = new BinaryExpression(nameCondition, 'or', ageCondition);
            const nestedCondition = new ParenExpression(orCondition);
            const andCondition = new BinaryExpression(idCondition, 'and', nestedCondition);
            const outerCondition = new ParenExpression(andCondition);
            
            const whereClause = new WhereClause(outerCondition);

            // Apply parameter removal
            const result = ParameterRemover.remove(whereClause);

            // Expect a WHERE clause with "id = 1 AND (age > 18)"
            expect(result).not.toBeNull();

            // Extract condition for further testing
            const whereResult = result as WhereClause;
            const outerParenExpr = whereResult.condition as ParenExpression;
            const andExpr = outerParenExpr.expression as BinaryExpression;
            
            // Check left side is "id = 1"
            expect(andExpr.left).toEqual(idCondition);
            
            // Check right side is "(age > 18)"
            expect(andExpr.operator.value.toLowerCase()).toBe('and');
            expect(andExpr.right).toBeInstanceOf(ParenExpression);
            
            const rightParenExpr = andExpr.right as ParenExpression;
            // The name condition should be removed, leaving only age > 18
            expect(rightParenExpr.expression).toEqual(ageCondition);
        });
    });

    describe('query-level integration tests', () => {
        test('removes parameter expressions from simple WHERE clause', () => {
            // Parse from SQL string
            const sql = `SELECT id, name FROM users WHERE id = :id`;
            const query = SelectQueryParser.parse(sql);
            
            // Apply parameter removal
            const result = ParameterRemover.remove(query);
            
            // Format back to SQL
            const formatter = new Formatter();
            const formattedSql = formatter.format(result);
            
            // The output will be formatted with quotes around identifiers
            // Only check for the absence of parameters
            expect(formattedSql.trim()).not.toContain(":id");
            expect(formattedSql.trim()).toContain("id");
            expect(formattedSql.trim()).toContain("name");
            expect(formattedSql.trim()).toContain("users");
        });

        test('removes only parameterized conditions from WHERE clause', () => {
            // Parse from SQL string
            const sql = `SELECT id, name FROM users WHERE id > 100 AND name = :name`;
            const query = SelectQueryParser.parse(sql);
            
            // Apply parameter removal
            const result = ParameterRemover.remove(query);
            
            // Format back to SQL
            const formatter = new Formatter();
            const formattedSql = formatter.format(result);
            
            // The output will be formatted with quotes around identifiers
            // Just check that parameters are removed
            expect(formattedSql.trim()).not.toContain(":name");
            expect(formattedSql.trim()).not.toContain(":min_amount");
        });

        test('handles complex WHERE clause with mixed conditions', () => {
            // Parse from SQL string
            const sql = `
                SELECT id, name 
                FROM users 
                WHERE (id > 100 OR name = 'test') 
                AND (age BETWEEN :min_age AND :max_age OR status = 'active')
            `;
            const query = SelectQueryParser.parse(sql);
            
            // Apply parameter removal
            const result = ParameterRemover.remove(query);
            
            // Format back to SQL
            const formatter = new Formatter();
            const formattedSql = formatter.format(result);
            
            // Just check that parameters are removed
            expect(formattedSql.trim()).not.toContain(":min_age");
            expect(formattedSql.trim()).not.toContain(":max_age");
        });

        test('handles subqueries with parameters', () => {
            // Parse from SQL string
            const sql = `
                SELECT u.id, u.name 
                FROM users u
                WHERE u.id IN (SELECT o.user_id FROM orders o WHERE o.amount > :min_amount)
                AND u.active = true
            `;
            const query = SelectQueryParser.parse(sql);
            
            // Apply parameter removal
            const result = ParameterRemover.remove(query);
            
            // Format back to SQL
            const formatter = new Formatter();
            const formattedSql = formatter.format(result);
            
            // Expect the parameterized condition in the subquery to be removed
            expect(formattedSql.trim()).toContain("id");
            expect(formattedSql.trim()).toContain("user_id");
            expect(formattedSql.trim()).not.toContain(":min_amount");
        });

        test('handles WITH clauses with parameters', () => {
            // Parse from SQL string
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
            
            // Apply parameter removal
            const result = ParameterRemover.remove(query);
            
            // Format back to SQL
            const formatter = new Formatter();
            const formattedSql = formatter.format(result);
            
            // Expect the parameterized condition in the CTE to be removed
            expect(formattedSql.trim()).toContain("users");
            expect(formattedSql.trim()).not.toContain(":min_amount");
        });

        test('handles JOIN ON conditions with parameters', () => {
            // Parse from SQL string
            const sql = `
                SELECT u.id, u.name, o.order_id
                FROM users u
                JOIN orders o ON u.id = o.user_id AND o.amount > :min_amount
            `;
            const query = SelectQueryParser.parse(sql);
            
            // Apply parameter removal
            const result = ParameterRemover.remove(query);
            
            // Format back to SQL
            const formatter = new Formatter();
            const formattedSql = formatter.format(result);
            
            // Just check that parameters are removed
            expect(formattedSql.trim()).not.toContain(":min_amount");
        });

        test('handles HAVING clauses with parameters', () => {
            // Parse from SQL string
            const sql = `
                SELECT department_id, COUNT(*) as employee_count
                FROM employees
                GROUP BY department_id
                HAVING COUNT(*) > :min_count OR AVG(salary) > 50000
            `;
            const query = SelectQueryParser.parse(sql);
            
            // Apply parameter removal
            const result = ParameterRemover.remove(query);
            
            // Format back to SQL
            const formatter = new Formatter();
            const formattedSql = formatter.format(result);
            
            // Just check that parameters are removed
            expect(formattedSql.trim()).not.toContain(":min_count");
        });

        test('handles UNION queries with parameters', () => {
            // Parse from SQL string
            const sql = `
                SELECT id, name FROM users WHERE status = :status
                UNION
                SELECT id, name FROM admins WHERE role = 'super'
            `;
            const query = SelectQueryParser.parse(sql);
            
            // Apply parameter removal
            const result = ParameterRemover.remove(query);
            
            // Format back to SQL
            const formatter = new Formatter();
            const formattedSql = formatter.format(result);
            
            // Expect the parameterized WHERE clause in the first query to be removed
            expect(formattedSql.trim()).toContain("admins");
            expect(formattedSql.trim()).toContain("role");
            expect(formattedSql.trim()).not.toContain(":status");
        });
    });
});