import { expect, test } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';
import { BinaryExpression, ColumnReference, FunctionCall, LiteralValue } from '../../src/models/ValueComponent';

const formatter = new Formatter();

test('should add a HAVING condition when none exists using raw string', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parse('SELECT COUNT(*) FROM users GROUP BY department') as SimpleSelectQuery;

    // Act
    baseQuery.appendHavingRaw("COUNT(*) > 5");
    const sql = formatter.format(baseQuery);

    // Assert
    expect(sql).toEqual(`select count(*) from "users" group by "department" having count(*) > 5`);
});

test('should add multiple HAVING conditions with AND logic using raw strings', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parse('SELECT COUNT(*), SUM(amount) FROM orders GROUP BY status') as SimpleSelectQuery;

    // Act
    baseQuery.appendHavingRaw("COUNT(*) > 10");
    baseQuery.appendHavingRaw("SUM(amount) > 1000");
    const sql = formatter.format(baseQuery);

    // Assert
    expect(sql).toEqual(`select count(*), sum("amount") from "orders" group by "status" having count(*) > 10 and sum("amount") > 1000`);
});

test('should handle complex HAVING conditions with raw strings', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parse('SELECT department, AVG(salary) FROM employees GROUP BY department') as SimpleSelectQuery;

    // Act
    baseQuery.appendHavingRaw("(COUNT(*) >= 5 AND MAX(salary) < 100000)");
    baseQuery.appendHavingRaw("AVG(salary) > 50000");
    const sql = formatter.format(baseQuery);

    // Assert
    expect(sql).toEqual(`select "department", avg("salary") from "employees" group by "department" having (count(*) >= 5 and max("salary") < 100000) and avg("salary") > 50000`);
});

test('should add a HAVING condition using ValueComponent', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parse('SELECT product, SUM(sales) FROM transactions GROUP BY product') as SimpleSelectQuery;

    // Create ValueComponent for condition: SUM(sales) > 500
    const sumFunction = new FunctionCall('sum', new ColumnReference(null, 'sales'), null);
    const condition = new BinaryExpression(sumFunction, '>', new LiteralValue(500));

    // Act
    baseQuery.appendHaving(condition);
    const sql = formatter.format(baseQuery);

    // Assert
    expect(sql).toEqual(`select "product", sum("sales") from "transactions" group by "product" having sum("sales") > 500`);
});

test('should add multiple HAVING conditions with AND logic using ValueComponents', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parse('SELECT category, COUNT(*), AVG(price) FROM products GROUP BY category') as SimpleSelectQuery;

    // Create first condition: COUNT(*) > 10
    const countFunction = new FunctionCall('count', new ColumnReference(null, '*'), null);
    const firstCondition = new BinaryExpression(countFunction, '>', new LiteralValue(10));

    // Create second condition: AVG(price) > 50
    const avgFunction = new FunctionCall('avg', new ColumnReference(null, 'price'), null);
    const secondCondition = new BinaryExpression(avgFunction, '>', new LiteralValue(50));

    // Act
    baseQuery.appendHaving(firstCondition);
    baseQuery.appendHaving(secondCondition);
    const sql = formatter.format(baseQuery);

    // Assert
    expect(sql).toEqual(`select "category", count(*), avg("price") from "products" group by "category" having count(*) > 10 and avg("price") > 50`);
});

test('should combine raw string and ValueComponent conditions in HAVING clause', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parse('SELECT region, SUM(sales) FROM sales_data GROUP BY region') as SimpleSelectQuery;

    // Add first condition using raw string
    baseQuery.appendHavingRaw("COUNT(*) > 20");

    // Create second condition using ValueComponent: SUM(sales) > 10000
    const sumFunction = new FunctionCall('sum', new ColumnReference(null, 'sales'), null);
    const secondCondition = new BinaryExpression(sumFunction, '>', new LiteralValue(10000));

    // Act
    baseQuery.appendHaving(secondCondition);
    const sql = formatter.format(baseQuery);

    // Assert
    expect(sql).toEqual(`select "region", sum("sales") from "sales_data" group by "region" having count(*) > 20 and sum("sales") > 10000`);
});
