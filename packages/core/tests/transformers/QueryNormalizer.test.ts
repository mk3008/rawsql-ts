import { QueryBuilder } from "../../src/transformers/QueryBuilder";
import { SelectQueryParser } from "../../src/parsers/SelectQueryParser";
import { SqlFormatter } from "../../src/transformers/Formatter";
import { BinarySelectQuery, SimpleSelectQuery, ValuesQuery } from "../../src/models/SelectQuery";
import { describe, expect, test } from 'vitest';

describe('QueryNormalizer', () => {
    const formatter = new SqlFormatter();

    test('it returns SimpleSelectQuery unchanged', () => {
        // Arrange
        const sql = "SELECT id, name FROM users WHERE active = true";
        const query = SelectQueryParser.parse(sql);

        // Act
        const normalizedQuery = QueryBuilder.buildSimpleQuery(query);

        // Assert
        expect(normalizedQuery).toBe(query); // Should be the same object instance
    });

    test('it converts BinarySelectQuery to subquery format', () => {
        // Arrange
        const sql = "SELECT id, name FROM users UNION SELECT id, name FROM admins";
        const query = SelectQueryParser.parse(sql);
        expect(query).toBeInstanceOf(BinarySelectQuery);
        expect(query).toBeInstanceOf(BinarySelectQuery);

        // Act
        const normalizedQuery = QueryBuilder.buildSimpleQuery(query);

        // Assert
        expect(normalizedQuery).toBeInstanceOf(SimpleSelectQuery);
    });

    test('throws error if ValuesQuery has no columnAliases', () => {
        // Arrange
        const sql = "VALUES (1, 'one'), (2, 'two'), (3, 'three')";
        const query = SelectQueryParser.parse(sql) as ValuesQuery;
        expect(query).toBeInstanceOf(ValuesQuery);

        // Act & Assert
        expect(() => {
            QueryBuilder.buildSimpleQuery(query);
        }).toThrow();
    });

    test('it converts ValuesQuery to subquery with column names', () => {
        // Arrange
        const sql = "VALUES (1, 'one'), (2, 'two'), (3, 'three')";
        const query = SelectQueryParser.parse(sql) as ValuesQuery;
        expect(query).toBeInstanceOf(ValuesQuery);
        expect(query).toBeInstanceOf(ValuesQuery);

        // Act   
        query.columnAliases = ["id", "value"]; //set column aliases
        const normalizedQuery = QueryBuilder.buildSimpleQuery(query);

        // Assert
        expect(normalizedQuery).toBeInstanceOf(SimpleSelectQuery);
        expect(formatter.format(normalizedQuery).formattedSql).toBe('select "vq"."id", "vq"."value" from (values (1, \'one\'), (2, \'two\'), (3, \'three\')) as "vq"("id", "value")');
    });

    test('it handles nested binary queries', () => {
        // Arrange
        const sql = "SELECT id FROM users UNION SELECT id FROM customers UNION SELECT id FROM guests";
        const query = SelectQueryParser.parse(sql);

        // Act
        const normalizedQuery = QueryBuilder.buildSimpleQuery(query);

        // Assert
        expect(normalizedQuery).toBeInstanceOf(SimpleSelectQuery);
    });

    test('it handles VALUES with no rows - should throw error for missing column aliases', () => {
        // VALUES () without column aliases cannot be converted to SimpleSelectQuery
        // This is expected behavior - column aliases are required for normalization

        // Arrange
        const sql = "VALUES ()";
        const query = SelectQueryParser.parse(sql);

        // Act & Assert - Should throw error
        expect(() => {
            QueryBuilder.buildSimpleQuery(query);
        }).toThrow('Column aliases are required to convert a VALUES clause to SimpleSelectQuery');
    });

    test('it normalizes UNION query with WITH clause', () => {
        // Arrange
        const sql = "WITH active_users AS (SELECT id, name FROM users WHERE active = true) " +
            "SELECT id, name FROM active_users UNION SELECT id, name FROM admins";
        const query = SelectQueryParser.parse(sql);

        // Act
        const normalizedQuery = QueryBuilder.buildSimpleQuery(query);

        // Assert
        expect(normalizedQuery).toBeInstanceOf(SimpleSelectQuery);
        expect(formatter.format(normalizedQuery).formattedSql).toBe('with "active_users" as (select "id", "name" from "users" where "active" = true) select * from (select "id", "name" from "active_users" union select "id", "name" from "admins") as "bq"');
    });
});

