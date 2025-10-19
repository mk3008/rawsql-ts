import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { QueryBuilder } from '../../src/transformers/QueryBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { CreateTableQuery } from '../../src/models/CreateTableQuery';


describe('QueryBuilder.buildCreateTableQuery', () => {
    it('should convert a simple SELECT to CREATE TABLE ... AS SELECT', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id, name FROM users');

        // Act
        const create = QueryBuilder.buildCreateTableQuery(select, 'my_table');
        const sql = new SqlFormatter().format(create).formattedSql;

        // Assert
        expect(create).toBeInstanceOf(CreateTableQuery);
        expect(create.ifNotExists).toBe(false);
        expect(sql).toBe('create table "my_table" as select "id", "name" from "users"');
    });

    it('should support temporary tables', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id FROM users');

        // Act
        const create = QueryBuilder.buildCreateTableQuery(select, 'tmp_table', true);
        const sql = new SqlFormatter().format(create).formattedSql;

        // Assert
        expect(sql).toBe('create temporary table "tmp_table" as select "id" from "users"');
    });

    it('should honour IF NOT EXISTS flag', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id FROM users');

        // Act
        const create = QueryBuilder.buildCreateTableQuery(select, 'logs', false, true);
        const sql = new SqlFormatter().format(create).formattedSql;

        // Assert
        expect(create.ifNotExists).toBe(true);
        expect(sql).toBe('create table if not exists "logs" as select "id" from "users"');
    });
});
