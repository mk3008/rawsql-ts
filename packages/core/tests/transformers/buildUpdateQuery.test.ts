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
        expect(sql).toBe('with "active_users" as (select "id", "score" from "exam_results_new" where "active" = true) update "exam_results" set "score" = "src"."score" from (select "id", "score" from "active_users") as "src" where "exam_results"."id" = "src"."id"');
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
        expect(sql).toBe('update "exam_results" as "er" set "score" = "src"."score" from (select "id", "score" from "exam_results_new") as "src" where "er"."id" = "src"."id"');
    });

    it('generates simple UPDATE with single PK', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id, name, age FROM users_new') as SimpleSelectQuery;

        // Act
        const update = QueryBuilder.buildUpdateQuery(select, "src", 'users', 'id');
        const sql = new SqlFormatter().format(update).formattedSql;

        // Assert
        expect(sql).toBe('update "users" set "name" = "src"."name", "age" = "src"."age" from (select "id", "name", "age" from "users_new") as "src" where "users"."id" = "src"."id"');
    });

    it('generates UPDATE with composite PK (order_items/order_details)', () => {
        // Arrange
        // Simulate a real-world scenario: updating order_details from order_items
        const select = SelectQueryParser.parse('SELECT order_id, item_id, quantity FROM order_items') as SimpleSelectQuery;

        // Act
        const update = QueryBuilder.buildUpdateQuery(select, "src", 'order_details', ['order_id', 'item_id']);
        const sql = new SqlFormatter().format(update).formattedSql;

        // Assert
        expect(sql).toBe('update "order_details" set "quantity" = "src"."quantity" from (select "order_id", "item_id", "quantity" from "order_items") as "src" where "order_details"."order_id" = "src"."order_id" and "order_details"."item_id" = "src"."item_id"');
    });

    it('builds UPDATE via SelectQuery.toUpdateQuery with explicit columns', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id, status FROM events_draft') as SimpleSelectQuery;

        // Act
        const update = select.toUpdateQuery({
            target: 'events e',
            primaryKeys: 'id',
            columns: ['status'],
            sourceAlias: 'src'
        });
        const sql = new SqlFormatter().format(update).formattedSql;

        // Assert
        expect(sql).toBe('update "events" as "e" set "status" = "src"."status" from (select "id", "status" from "events_draft") as "src" where "e"."id" = "src"."id"');
    });

    it('throws when explicit update columns reference missing select columns', () => {
        const select = SelectQueryParser.parse('SELECT id, name FROM users_src') as SimpleSelectQuery;

        expect(() => QueryBuilder.buildUpdateQuery(select, {
            target: 'users u',
            primaryKeys: 'id',
            columns: ['name', 'age'],
            sourceAlias: 'src'
        })).toThrowError('Provided update columns were not found in selectQuery output or are primary keys: [age].');
    });

    it('removes extra select columns when explicit update list provided', () => {
        const select = SelectQueryParser.parse('SELECT id, name, age, extra FROM users_src') as SimpleSelectQuery;

        const update = QueryBuilder.buildUpdateQuery(select, {
            target: 'users',
            primaryKeys: 'id',
            columns: ['name', 'age'],
            sourceAlias: 'src'
        });
        const sql = new SqlFormatter().format(update).formattedSql;

        expect(sql).toBe('update "users" set "name" = "src"."name", "age" = "src"."age" from (select "id", "name", "age" from "users_src") as "src" where "users"."id" = "src"."id"');
    });

    it('throws when explicit update columns do not match select output', () => {
        const select = SelectQueryParser.parse('SELECT id FROM users_src') as SimpleSelectQuery;

        expect(() => QueryBuilder.buildUpdateQuery(select, {
            target: 'users',
            primaryKeys: 'id',
            columns: ['name'],
            sourceAlias: 'src'
        })).toThrowError('Provided update columns were not found in selectQuery output or are primary keys: [name].');
    });

    it('throws when select output omits required primary keys', () => {
        const select = SelectQueryParser.parse('SELECT name FROM users_src') as SimpleSelectQuery;

        expect(() => QueryBuilder.buildUpdateQuery(select, {
            target: 'users',
            primaryKeys: 'id',
            columns: ['name'],
            sourceAlias: 'src'
        })).toThrowError("Primary key column 'id' is not present in selectQuery select list.");
    });

    it('throws when select output only includes primary keys', () => {
        const select = SelectQueryParser.parse('SELECT id FROM users_src') as SimpleSelectQuery;

        expect(() => QueryBuilder.buildUpdateQuery(select, "src", 'users', 'id')).toThrowError(
            'No updatable columns found. Ensure the select list contains at least one column other than the specified primary keys.'
        );
    });
});
