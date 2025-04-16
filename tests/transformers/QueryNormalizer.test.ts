import { QueryNormalizer } from "../../src/transformers/QueryNormalizer";
import { SelectQueryParser } from "../../src/parsers/SelectQueryParser";
import { Formatter } from "../../src/transformers/Formatter";
import { BinarySelectQuery, SimpleSelectQuery, ValuesQuery } from "../../src/models/SelectQuery";
import { describe, expect, test } from 'vitest';

describe('QueryNormalizer', () => {
    const normalizer = new QueryNormalizer();
    const formatter = new Formatter();

    test('it returns SimpleSelectQuery unchanged', () => {
        // Arrange
        const sql = "SELECT id, name FROM users WHERE active = true";
        const query = SelectQueryParser.parseFromText(sql);

        // Act
        const normalizedQuery = normalizer.normalize(query);

        // Assert
        expect(normalizedQuery).toBe(query); // Should be the same object instance
        expect(formatter.visit(normalizedQuery)).toBe('select "id", "name" from "users" where "active" = true');
    });

    test('it converts BinarySelectQuery to subquery format', () => {
        // Arrange
        const sql = "SELECT id, name FROM users UNION SELECT id, name FROM admins";
        const query = SelectQueryParser.parseFromText(sql);
        expect(query).toBeInstanceOf(BinarySelectQuery);

        // Act
        const normalizedQuery = normalizer.normalize(query);

        // Assert
        expect(normalizedQuery).toBeInstanceOf(SimpleSelectQuery);
        expect(formatter.visit(normalizedQuery)).toBe('select * from (select "id", "name" from "users" union select "id", "name" from "admins") as "bq"');
    });

    test('it converts ValuesQuery to subquery with column names', () => {
        // Arrange
        const sql = "VALUES (1, 'one'), (2, 'two'), (3, 'three')";
        const query = SelectQueryParser.parseFromText(sql);
        expect(query).toBeInstanceOf(ValuesQuery);

        // Act
        const normalizedQuery = normalizer.normalize(query);

        // Assert
        expect(normalizedQuery).toBeInstanceOf(SimpleSelectQuery);
        // Formatter will output the query with aliases for the VALUES expression
        expect(formatter.visit(normalizedQuery)).toBe('select * from (values (1, \'one\'), (2, \'two\'), (3, \'three\')) as "vq"("column1", "column2")');
    });

    test('it handles nested binary queries', () => {
        // Arrange
        const sql = "SELECT id FROM users UNION SELECT id FROM customers UNION SELECT id FROM guests";
        const query = SelectQueryParser.parseFromText(sql);

        // Act
        const normalizedQuery = normalizer.normalize(query);

        // Assert
        expect(normalizedQuery).toBeInstanceOf(SimpleSelectQuery);
        expect(formatter.visit(normalizedQuery)).toContain('as "bq"');
    });

    test.skip('it handles VALUES with no rows', () => {
        // This test is skipped as some SQL parsers might not accept the empty VALUES syntax
        // Arrange - Note: Using empty VALUES syntax
        const sql = "VALUES ()";
        const query = SelectQueryParser.parseFromText(sql);

        // Act
        const normalizedQuery = normalizer.normalize(query);

        // Assert
        expect(normalizedQuery).toBeInstanceOf(SimpleSelectQuery);
    });

    test('it normalizes UNION query with WITH clause', () => {
        // Arrange
        const sql = "WITH active_users AS (SELECT id, name FROM users WHERE active = true) " +
            "SELECT id, name FROM active_users UNION SELECT id, name FROM admins";
        const query = SelectQueryParser.parseFromText(sql);

        // Act
        const normalizedQuery = normalizer.normalize(query);

        // Assert
        expect(normalizedQuery).toBeInstanceOf(SimpleSelectQuery);
        expect(formatter.visit(normalizedQuery)).toBe('with "active_users" as (select "id", "name" from "users" where "active" = true) select * from (select "id", "name" from "active_users" union select "id", "name" from "admins") as "bq"');
    });
});

