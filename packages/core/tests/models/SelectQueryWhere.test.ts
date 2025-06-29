import { expect, test } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';

const formatter = new Formatter();

test('should add a WHERE condition when none exists', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;

    // Act
    baseQuery.appendWhereRaw("status = 'active'");
    const sql = formatter.format(baseQuery);

    // Assert
    expect(sql).toEqual(`select "id" from "users" where "status" = 'active'`);
});

test('should add multiple WHERE conditions with AND logic', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;

    // Act
    baseQuery.appendWhereRaw("status = 'active'");
    baseQuery.appendWhereRaw("created_at > '2023-01-01'");

    // Assert
    const sql = formatter.format(baseQuery);
    expect(sql).toEqual(`select "id" from "users" where "status" = 'active' and "created_at" > '2023-01-01'`);
});

test('should handle complex conditions', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;

    // Act
    baseQuery.appendWhereRaw("(age > 18 AND verified = true)");
    baseQuery.appendWhereRaw("status = 'active'");
    const sql = formatter.format(baseQuery);

    // Assert
    expect(sql).toEqual(`select "id" from "users" where ("age" > 18 and "verified" = true) and "status" = 'active'`);
});
