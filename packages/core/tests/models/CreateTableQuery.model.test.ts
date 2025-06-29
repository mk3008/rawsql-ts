import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { CreateTableQuery } from '../../src/models/CreateTableQuery';
import { Formatter } from '../../src/transformers/Formatter';

describe('CreateTableQuery#getSelectQuery & getCountQuery', () => {
    it('getSelectQuery() should return select columns from asSelectQuery', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id, name FROM users');
        const create = new CreateTableQuery({
            tableName: 'my_table',
            asSelectQuery: select
        });
        // Act
        const selectQuery = create.getSelectQuery();
        const sql = new Formatter().format(selectQuery);
        // Assert
        expect(sql).toBe('select "id", "name" from "my_table"');
    });

    it('getSelectQuery() should fallback to wildcard if asSelectQuery is not set', () => {
        // Arrange
        const create = new CreateTableQuery({
            tableName: 'my_table'
        });
        // Act
        const selectQuery = create.getSelectQuery();
        const sql = new Formatter().format(selectQuery);
        // Assert
        expect(sql).toBe('select * from "my_table"');
    });

    it('getCountQuery() should return count query for the table', () => {
        // Arrange
        const create = new CreateTableQuery({
            tableName: 'my_table'
        });
        // Act
        const countQuery = create.getCountQuery();
        const sql = new Formatter().format(countQuery);
        // Assert
        expect(sql).toBe('select count(*) from "my_table"');
    });

    it('getCountQuery() should work even if asSelectQuery is set', () => {
        // Arrange
        const select = SelectQueryParser.parse('SELECT id, name FROM users');
        const create = new CreateTableQuery({
            tableName: 'my_table',
            asSelectQuery: select
        });
        // Act
        const countQuery = create.getCountQuery();
        const sql = new Formatter().format(countQuery);
        // Assert
        expect(sql).toBe('select count(*) from "my_table"');
    });
});
