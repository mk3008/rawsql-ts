import { describe, it, expect } from 'vitest';
import { QueryBuilder } from '../../src/transformers/QueryBuilder';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { ValuesQuery } from '../../src/models/ValuesQuery';

describe('QueryBuilder.toInsertQuery', () => {
    it('infers columns from SELECT and generates correct InsertQuery', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id, name FROM users_old') as SimpleSelectQuery;

        // Act
        const insert = QueryBuilder.buildInsertQuery(select, 'users');
        const sql = new Formatter().format(insert);

        // Assert
        expect(sql).toBe('insert into "users"("id", "name") select "id", "name" from "users_old"');
    });

    it('supports VALUES query via SelectQueryParser', () => {
        // Arrange
        const query = SelectQueryParser.parse("VALUES (1, 'Alice'), (2, 'Bob')") as ValuesQuery;
        query.columnAliases = ["id", "name"];
        const select = QueryBuilder.buildSimpleQuery(query);

        // Act
        const insert = QueryBuilder.buildInsertQuery(select, 'users');
        const sql = new Formatter().format(insert);

        // Assert
        expect(sql).toBe('insert into "users"("id", "name") select "vq"."id", "vq"."name" from (values (1, \'Alice\'), (2, \'Bob\')) as "vq"("id", "name")');
    });

    it('throws if columns cannot be inferred from wildcard select (SELECT *)', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT * FROM users_old') as SimpleSelectQuery;

        // Act & Assert
        expect(() => QueryBuilder.buildInsertQuery(select, 'users')).toThrow();
    });

    it('throws if columns cannot be inferred from constant select (SELECT 1)', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT 1') as SimpleSelectQuery;

        // Act & Assert
        expect(() => QueryBuilder.buildInsertQuery(select, 'users')).toThrow();
    });
});
