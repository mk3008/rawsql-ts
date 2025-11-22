import { describe, it, expect } from 'vitest';
import { SqlParser } from '../../src/parsers/SqlParser';
import { SimulatedSelectConverter } from '../../src/transformers/SimulatedSelectConverter';
import { CreateTableQuery } from '../../src/models/CreateTableQuery';
import { InsertQuery } from '../../src/models/InsertQuery';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

describe('SimulatedSelectConverter', () => {
    const options = { missingFixtureStrategy: 'passthrough' as const };

    it('should convert INSERT query', () => {
        const sql = "INSERT INTO users (id, name) VALUES (1, 'Alice')";
        const ast = SqlParser.parse(sql);
        const result = SimulatedSelectConverter.convert(ast, options);
        expect(result).toBeInstanceOf(SimpleSelectQuery);
    });

    it('should convert UPDATE query', () => {
        const sql = "UPDATE users SET name = 'Bob' WHERE id = 1";
        const ast = SqlParser.parse(sql);
        const result = SimulatedSelectConverter.convert(ast, options);
        expect(result).toBeInstanceOf(SimpleSelectQuery);
    });

    it('should convert DELETE query', () => {
        const sql = "DELETE FROM users WHERE id = 1";
        const ast = SqlParser.parse(sql);
        const result = SimulatedSelectConverter.convert(ast, options);
        expect(result).toBeInstanceOf(SimpleSelectQuery);
    });

    it('should preserve SELECT query', () => {
        const sql = "SELECT * FROM users";
        const ast = SqlParser.parse(sql);
        const result = SimulatedSelectConverter.convert(ast);
        expect(result).toBeInstanceOf(SimpleSelectQuery);
    });

    it('should preserve CREATE TEMPORARY TABLE AS SELECT', () => {
        const sql = "CREATE TEMPORARY TABLE temp_users AS SELECT * FROM users";
        const ast = SqlParser.parse(sql);
        const result = SimulatedSelectConverter.convert(ast);
        expect(result).toBeInstanceOf(CreateTableQuery);
        const createTable = result as CreateTableQuery;
        expect(createTable.isTemporary).toBe(true);
        expect(createTable.asSelectQuery).toBeDefined();
    });

    it('should ignore standard CREATE TABLE', () => {
        const sql = "CREATE TABLE users (id int, name text)";
        const ast = SqlParser.parse(sql);
        const result = SimulatedSelectConverter.convert(ast);
        expect(result).toBeNull();
    });

    it('should ignore CREATE TEMPORARY TABLE without AS SELECT', () => {
        const sql = "CREATE TEMPORARY TABLE temp_users (id int)";
        const ast = SqlParser.parse(sql);
        const result = SimulatedSelectConverter.convert(ast);
        expect(result).toBeNull();
    });

    it('should ignore DROP TABLE', () => {
        const sql = "DROP TABLE users";
        const ast = SqlParser.parse(sql);
        const result = SimulatedSelectConverter.convert(ast);
        expect(result).toBeNull();
    });

    it('should ignore ALTER TABLE', () => {
        const sql = "ALTER TABLE users DROP COLUMN email";
        const ast = SqlParser.parse(sql);
        const result = SimulatedSelectConverter.convert(ast);
        expect(result).toBeNull();
    });

    it('should ignore CREATE INDEX', () => {
        const sql = "CREATE INDEX idx_users_name ON users (name)";
        const ast = SqlParser.parse(sql);
        const result = SimulatedSelectConverter.convert(ast);
        expect(result).toBeNull();
    });
});
