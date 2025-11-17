import { describe, expect, it } from 'vitest';
import { CreateTableParser } from '../../src/parsers/CreateTableParser';
import {
    createTableDefinitionFromCreateTableQuery,
    createTableDefinitionRegistryFromCreateTableQueries
} from '../../src/models/TableDefinitionModel';

describe('TableDefinitionModel helpers', () => {
    it('derives column metadata from CREATE TABLE AST', () => {
        const query = CreateTableParser.parse(`
            CREATE TABLE sales.invoice (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                amount numeric(10, 2) NOT NULL,
                note text DEFAULT 'N/A'
            )
        `);

        const definition = createTableDefinitionFromCreateTableQuery(query);
        expect(definition.name).toBe('sales.invoice');
        expect(definition.columns.map((column) => column.name)).toEqual(['id', 'amount', 'note']);

        expect(definition.columns[0].typeName).toBe('bigint');
        expect(definition.columns[0].required).toBe(false);

        expect(definition.columns[1].typeName).toBe('numeric');
        expect(definition.columns[1].required).toBe(true);

        expect(definition.columns[2].typeName).toBe('text');
        expect(definition.columns[2].required).toBe(false);
        expect(definition.columns[2].defaultValue).not.toBeNull();
    });

    it('builds a registry keyed by qualified table name', () => {
        const query = CreateTableParser.parse('CREATE TABLE inventory.stock (sku text PRIMARY KEY)');
        const registry = createTableDefinitionRegistryFromCreateTableQueries([query]);

        expect(Object.keys(registry)).toEqual(['inventory.stock']);
        expect(registry['inventory.stock'].columns[0].name).toBe('sku');
    });
});
