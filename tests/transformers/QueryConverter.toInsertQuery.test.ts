import { describe, it, expect } from 'vitest';
import { QueryConverter } from '../../src/transformers/QueryConverter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { ValuesQuery } from '../../src/models/ValuesQuery';

describe('QueryConverter.toInsertQuery', () => {
    it('infers columns from SELECT and generates correct InsertQuery', () => {
        const select = SelectQueryParser.parse('SELECT id, name FROM users_old') as SimpleSelectQuery;
        const insert = QueryConverter.toInsertQuery(select, 'users');
        const sql = new Formatter().format(insert);
        expect(sql).toBe('insert into "users" ("id", "name") select "id", "name" from "users_old"');
    });

    it('supports VALUES query via SelectQueryParser', () => {
        const query = SelectQueryParser.parse("VALUES (1, 'Alice'), (2, 'Bob')") as ValuesQuery;
        const select = QueryConverter.toSimple(query, ['id', 'name'])

        const insert = QueryConverter.toInsertQuery(select, 'users');
        const sql = new Formatter().format(insert);
        expect(sql).toBe('insert into "users" ("id", "name") select "vq"."id", "vq"."name" from (values (1, \'Alice\'), (2, \'Bob\')) as "vq"("id", "name")');
    });

    it('throws if columns cannot be inferred', () => {
        // Should throw if column names cannot be inferred (e.g. select *)
        const select = SelectQueryParser.parse('SELECT * FROM users_old') as SimpleSelectQuery;
        expect(() => QueryConverter.toInsertQuery(select, 'users')).toThrow();
    });

    it('throws if columns cannot be inferred', () => {
        // Should throw if there are no column names (e.g. SELECT 1)
        const select = SelectQueryParser.parse('SELECT 1') as SimpleSelectQuery;
        expect(() => QueryConverter.toInsertQuery(select, 'users')).toThrow();
    });
});
