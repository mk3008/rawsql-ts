import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { QueryBuilder } from '../../src/transformers/QueryBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

describe('buildInsertQuery', () => {
    it('builds INSERT via QueryBuilder with options and hoists CTEs', () => {
        const select = SelectQueryParser.parse(
            'WITH src AS (SELECT id, name FROM users_staging) SELECT id, name FROM src'
        ) as SimpleSelectQuery;

        const insert = QueryBuilder.buildInsertQuery(select, {
            target: 'users',
            columns: ['id', 'name']
        });
        const sql = new SqlFormatter().format(insert).formattedSql;

        expect(sql).toBe('with "src" as (select "id", "name" from "users_staging") insert into "users"("id", "name") select "id", "name" from "src"');
    });

    it('builds INSERT via SelectQuery method and infers columns', () => {
        const select = SelectQueryParser.parse('SELECT id, email FROM accounts_backup') as SimpleSelectQuery;

        const insert = select.toInsertQuery({ target: 'accounts' });
        const sql = new SqlFormatter().format(insert).formattedSql;

        expect(sql).toBe('insert into "accounts"("id", "email") select "id", "email" from "accounts_backup"');
    });

    it('throws when explicit columns reference missing select columns', () => {
        const select = SelectQueryParser.parse('SELECT 1 AS id') as SimpleSelectQuery;

        expect(() => QueryBuilder.buildInsertQuery(select, {
            target: 'users',
            columns: ['id', 'name']
        })).toThrowError('Columns specified in conversion options were not found in selectQuery select list: [name].');
    });

    it('filters the select clause to the provided columns', () => {
        const select = SelectQueryParser.parse("SELECT 1 AS id, 'a' AS name, 2 AS value") as SimpleSelectQuery;

        const insert = QueryBuilder.buildInsertQuery(select, {
            target: 'users',
            columns: ['name', 'id']
        });
        const sql = new SqlFormatter().format(insert).formattedSql;

        expect(sql).toBe("insert into \"users\"(\"name\", \"id\") select 'a' as \"name\", 1 as \"id\"");
    });

    it('throws when select output has no overlap with explicit columns', () => {
        const select = SelectQueryParser.parse('SELECT 2 AS value') as SimpleSelectQuery;

        expect(() => QueryBuilder.buildInsertQuery(select, {
            target: 'users',
            columns: ['id', 'name']
        })).toThrowError('Columns specified in conversion options were not found in selectQuery select list: [id, name].');
    });

    it('throws when select output uses wildcard columns', () => {
        const select = SelectQueryParser.parse('SELECT 1') as SimpleSelectQuery;

        expect(() => QueryBuilder.buildInsertQuery(select, {
            target: 'users',
            columns: ['id']
        })).toThrowError('Unable to determine any column names from selectQuery.');
    });

    it('reorders select output to match explicit column order', () => {
        const select = SelectQueryParser.parse('SELECT id, name FROM users_src') as SimpleSelectQuery;

        const insert = QueryBuilder.buildInsertQuery(select, {
            target: 'users',
            columns: ['name', 'id']
        });
        const sql = new SqlFormatter().format(insert).formattedSql;

        expect(sql).toBe('insert into "users"("name", "id") select "name", "id" from "users_src"');
    });
});
