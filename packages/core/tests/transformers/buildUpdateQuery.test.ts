import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { QueryBuilder } from '../../src/transformers/QueryBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

describe('buildUpdateQuery', () => {
    it('generates UPDATE with CTE (WITH clause)', () => {
        // Arrange
        // Test pattern: Update only active users using a WITH clause (CTE)
        const select = SelectQueryParser.parse('WITH active_users AS (SELECT id, score FROM exam_results_new WHERE active = true) SELECT id, score FROM active_users') as SimpleSelectQuery;

        // Act
        const update = QueryBuilder.buildUpdateQuery(select, "src", 'exam_results', 'id');
        const sql = new SqlFormatter().format(update).formattedSql;

        // Assert
        // Check that the WITH clause is correctly reflected in the UPDATE statement
        expect(sql).toContain('with "active_users" as (select "id", "score" from "exam_results_new" where "active" = true) update "exam_results" set "score" = "exam_results"."score" from (select "id", "score" from "active_users") as "src" where "exam_results"."id" = "src"."id"');
    });

    it('generates UPDATE with table alias in updateTableExpr', () => {
        // Arrange
        // Realistic scenario: update with table alias (e.g. for complex queries or self-join situations)
        const select = SelectQueryParser.parse('SELECT id, score FROM exam_results_new') as SimpleSelectQuery;

        // Act
        // Include an alias in updateTableExpr (e.g. "exam_results er")
        const update = QueryBuilder.buildUpdateQuery(select, "src", 'exam_results er', 'id');
        const sql = new SqlFormatter().format(update).formattedSql;

        // Assert
        // Confirm that the UPDATE statement is generated correctly with alias
        expect(sql).toContain('update "exam_results" as "er" set "score" = "er"."score" from (select "id", "score" from "exam_results_new") as "src" where "er"."id" = "src"."id"');
    });

    it('generates simple UPDATE with single PK', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id, name, age FROM users_new') as SimpleSelectQuery;

        // Act
        const update = QueryBuilder.buildUpdateQuery(select, "src", 'users', 'id');
        const sql = new SqlFormatter().format(update).formattedSql;

        // Assert
        expect(sql).toContain('update "users" set "name" = "users"."name", "age" = "users"."age" from (select "id", "name", "age" from "users_new") as "src" where "users"."id" = "src"."id"');
    });

    it('generates UPDATE with composite PK (order_items/order_details)', () => {
        // Arrange
        // Simulate a real-world scenario: updating order_details from order_items
        const select = SelectQueryParser.parse('SELECT order_id, item_id, quantity FROM order_items') as SimpleSelectQuery;

        // Act
        const update = QueryBuilder.buildUpdateQuery(select, "src", 'order_details', ['order_id', 'item_id']);
        const sql = new SqlFormatter().format(update).formattedSql;

        // Assert
        expect(sql).toContain('update "order_details" set "quantity" = "order_details"."quantity" from (select "order_id", "item_id", "quantity" from "order_items") as "src" where "order_details"."order_id" = "src"."order_id" and "order_details"."item_id" = "src"."item_id"');
    });
});
