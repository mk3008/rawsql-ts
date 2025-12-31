import { describe, expect, test } from 'vitest';
import { SqlParser } from '../../src/parsers/SqlParser';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';
import { InsertQuery } from '../../src/models/InsertQuery';
import { CreateTableQuery } from '../../src/models/CreateTableQuery';
import { MergeQuery } from '../../src/models/MergeQuery';
import {
    AnalyzeStatement,
    ExplainStatement,
    CreateSchemaStatement,
    DropSchemaStatement,
    VacuumStatement,
    ReindexStatement,
    ClusterStatement,
    CheckpointStatement,
} from '../../src/models/DDLStatements';
import { RawString, IdentifierString, ParameterExpression } from '../../src/models/ValueComponent';

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

    test('parse supports PostgreSQL positional parameters in select list', () => {
        const result = SqlParser.parse('select $1, $2');

        expect(result).toBeInstanceOf(SimpleSelectQuery);
        if (!(result instanceof SimpleSelectQuery)) {
            throw new Error('SqlParser.parse should return SimpleSelectQuery for SELECT statements');
        }

        expect(result.selectClause.items).toHaveLength(2);
        expect(result.selectClause.items[0].value).toBeInstanceOf(ParameterExpression);
        expect(result.selectClause.items[1].value).toBeInstanceOf(ParameterExpression);
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

    test('parse returns a CreateSchemaStatement for CREATE SCHEMA statements', () => {
        const sql = 'CREATE SCHEMA IF NOT EXISTS tenant AUTHORIZATION admin';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(CreateSchemaStatement);
        if (result instanceof CreateSchemaStatement) {
            expect(result.ifNotExists).toBe(true);
            expect(result.schemaName.toString()).toBe('tenant');
            expect(result.authorization?.name).toBe('admin');
        }
    });

    test('parse returns a DropSchemaStatement for DROP SCHEMA statements', () => {
        const sql = 'DROP SCHEMA IF EXISTS public, audit CASCADE';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(DropSchemaStatement);
        if (result instanceof DropSchemaStatement) {
            expect(result.ifExists).toBe(true);
            expect(result.schemaNames.map((schema) => schema.toString())).toEqual(['public', 'audit']);
            expect(result.behavior).toBe('cascade');
        }
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

    test('parse returns an AnalyzeStatement for ANALYZE statements', () => {
        const sql = 'ANALYZE VERBOSE public.users (id)';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(AnalyzeStatement);
        if (result instanceof AnalyzeStatement) {
            expect(result.verbose).toBe(true);
            expect(result.columns?.map(col => col.name)).toEqual(['id']);
        }
    });

    test('parse returns an ExplainStatement for EXPLAIN statements', () => {
        const sql = 'EXPLAIN ANALYZE VERBOSE SELECT id FROM users';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(ExplainStatement);
        if (result instanceof ExplainStatement) {
            const optionNames = result.options?.map(option => option.name.name);
            expect(optionNames).toEqual(['analyze', 'verbose']);
            expect(result.statement.constructor.name).toBe('SimpleSelectQuery');
        }
    });

    test('parse handles EXPLAIN option list with explicit values', () => {
        const sql = 'EXPLAIN (ANALYZE false, FORMAT JSON) SELECT id FROM users';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(ExplainStatement);
        if (result instanceof ExplainStatement) {
            expect(result.options).toHaveLength(2);
            const optionMap = Object.fromEntries(result.options!.map(option => [option.name.name, option.value]));
            const analyzeValue = optionMap['analyze'];
            const formatValue = optionMap['format'];
            expect(analyzeValue).toBeDefined();
            expect(formatValue).toBeDefined();
            if (analyzeValue instanceof RawString) {
                expect(analyzeValue.value.toLowerCase()).toBe('false');
            }
            if (formatValue) {
                if (formatValue instanceof IdentifierString) {
                    expect(formatValue.name.toLowerCase()).toBe('json');
                } else if (formatValue instanceof RawString) {
                    expect(formatValue.value.toLowerCase()).toBe('json');
                }
            }
        }
    });

    test('parse returns a VacuumStatement for VACUUM statements', () => {
        const sql = 'VACUUM FULL VERBOSE public.logs';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(VacuumStatement);
    });

    test('parse returns a ReindexStatement for REINDEX statements', () => {
        const sql = 'REINDEX CONCURRENTLY TABLE public.logs';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(ReindexStatement);
    });

    test('parse returns a ClusterStatement for CLUSTER statements', () => {
        const sql = 'CLUSTER public.logs USING log_idx';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(ClusterStatement);
    });

    test('parse returns a CheckpointStatement for CHECKPOINT statements', () => {
        const sql = 'CHECKPOINT';

        const result = SqlParser.parse(sql);

        expect(result).toBeInstanceOf(CheckpointStatement);
    });

    test('parse throws when EXPLAIN lacks a nested statement', () => {
        expect(() => SqlParser.parse('EXPLAIN')).toThrow(/EXPLAIN must be followed/i);
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
    test('parse throws error with clean message for unsupported token', () => {
        const sql = 'selet * from table_a';

        expect(() => SqlParser.parse(sql)).toThrowError(
            '[SqlParser] Statement 1 starts with unsupported token "selet".'
        );
    });
});
