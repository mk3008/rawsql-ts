import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { QueryBuilder } from '../../src/transformers/QueryBuilder';
import { Formatter } from '../../src/transformers/Formatter';
import { CreateTableQuery } from '../../src/models/CreateTableQuery';


describe('QueryBuilder.toCreateTableQuery', () => {
    it('should convert a simple SELECT to CREATE TABLE ... AS SELECT', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id, name FROM users');

        // Act
        const create = QueryBuilder.buildCreateTableQuery(select, 'my_table');
        const sql = new Formatter().format(create);

        // Assert
        expect(create).toBeInstanceOf(CreateTableQuery);
        expect(sql).toBe('create table "my_table" as select "id", "name" from "users"');
    });

    it('should support temporary tables', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id FROM users');

        // Act
        const create = QueryBuilder.buildCreateTableQuery(select, 'tmp_table', true);
        const sql = new Formatter().format(create);

        // Assert
        expect(sql).toBe('create temporary table "tmp_table" as select "id" from "users"');
    });
});
