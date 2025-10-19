import { describe, expect, test } from 'vitest';
import { SqlParser } from '../../src/parsers/SqlParser';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';
import { InsertQuery } from '../../src/models/InsertQuery';
import { CreateTableQuery } from '../../src/models/CreateTableQuery';
import { MergeQuery } from '../../src/models/MergeQuery';

describe('SqlParser', () => {
    test('parse returns a SelectQuery for single-statement input', () => {
        const sql = 'SELECT id FROM users';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(SimpleSelectQuery);
        if (!(result instanceof SimpleSelectQuery)) {
            throw new Error('SqlParser.parse should return SimpleSelectQuery for SELECT statements');
        }
        expect(() => result.toSimpleQuery()).not.toThrow();
    });

    test('parse returns an InsertQuery for INSERT statements', () => {
        const sql = 'INSERT INTO users (id) VALUES (1) RETURNING id';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(InsertQuery);
        if (!(result instanceof InsertQuery)) {
            throw new Error('SqlParser.parse should return InsertQuery for INSERT statements');
        }
        expect(result.returningClause).not.toBeNull();
    });

    test('parse returns a CreateTableQuery for CREATE TABLE statements', () => {
        const sql = 'CREATE TABLE logs AS SELECT id FROM events';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(CreateTableQuery);
    });

    test('parse returns a MergeQuery for MERGE statements', () => {
        const sql = `
            MERGE INTO target t
            USING source s
            ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET name = s.name
            WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);
        `;

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(MergeQuery);
    });

    test('parse throws when additional statements are present in single mode', () => {
        const sql = `
            SELECT id FROM users;
            SELECT id FROM accounts;
        `;

        expect(() => SqlParser.parse(sql)).toThrow(/additional statement/i);
    });

    test('parse does not enforce trailing check when mode is multiple', () => {
        const sql = `
            SELECT id FROM users;
            SELECT id FROM accounts;
        `;

        const result = SqlParser.parse(sql, { mode: 'multiple' });

        expect(result).toBeInstanceOf(SimpleSelectQuery);
    });

    test('parseMany returns each statement as an independent SelectQuery', () => {
        const sql = `
            SELECT id, name FROM users WHERE active = true;
            VALUES (1), (2), (3);
            INSERT INTO audit_log (user_id) SELECT id FROM users WHERE active = true;
        `;

        const statements = SqlParser.parseMany(sql);

        expect(statements).toHaveLength(3);
        expect(statements[0]).toBeInstanceOf(SimpleSelectQuery);
        expect(statements[1].constructor.name).toBe('ValuesQuery');
        expect(statements[2]).toBeInstanceOf(InsertQuery);
    });

    test('parseMany skips empty statements while preserving leading comments', () => {
        const sql = `
            -- carries forward
            ;
            ;
            SELECT id FROM users;
        `;

        const statements = SqlParser.parseMany(sql);

        expect(statements).toHaveLength(1);
        const firstStatement = statements[0];
        expect(firstStatement).toBeInstanceOf(SimpleSelectQuery);
        if (!(firstStatement instanceof SimpleSelectQuery)) {
            throw new Error('Expected first parsed statement to be a SimpleSelectQuery');
        }
        expect(firstStatement.headerComments).toContain('carries forward');
    });

    test('parseMany surfaces statement index in errors', () => {
        const sql = `
            SELECT id FROM users;
            INSERT INTO audit_log (event_id)
        `;

        expect(() => SqlParser.parseMany(sql)).toThrow(/statement 2/i);
    });
});
