import { describe, it, expect } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { InsertQuery } from '../../src/models/InsertQuery';
import { IdentifierString, LiteralValue } from '../../src/models/ValueComponent';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { ValuesQuery } from '../../src/models/ValuesQuery';
import { TupleExpression } from '../../src/models/ValueComponent';

describe('Formatter: InsertQuery', () => {
    it('formats simple single-row VALUES insert', () => {
        const valuesQuery = new ValuesQuery([
            new TupleExpression([new LiteralValue(1), new LiteralValue('Alice')])
        ]);
        const query = new InsertQuery({
            namespaces: null,
            table: 'users',
            columns: ['id', 'name'],
            selectQuery: valuesQuery
        });
        const sql = new Formatter().format(query);
        expect(sql).toBe('insert into "users"("id", "name") values (1, \'Alice\')');
    });

    it('formats multi-row VALUES insert', () => {
        const valuesQuery = new ValuesQuery([
            new TupleExpression([new LiteralValue(1), new LiteralValue('Alice')]),
            new TupleExpression([new LiteralValue(2), new LiteralValue('Bob')])
        ]);
        const query = new InsertQuery({
            namespaces: null,
            table: 'users',
            columns: ['id', 'name'],
            selectQuery: valuesQuery
        });
        const sql = new Formatter().format(query);
        expect(sql).toBe('insert into "users"("id", "name") values (1, \'Alice\'), (2, \'Bob\')');
    });

    it('formats INSERT ... SELECT', () => {
        const select = SelectQueryParser.parse('SELECT id, name FROM users_old');
        const query = new InsertQuery({
            namespaces: null,
            table: 'users',
            columns: ['id', 'name'],
            selectQuery: select
        });
        const sql = new Formatter().format(query);
        expect(sql).toBe('insert into "users"("id", "name") select "id", "name" from "users_old"');
    });

    it('throws if neither values nor selectQuery is set', () => {
        const query = new InsertQuery({
            namespaces: null,
            table: 'users',
            columns: ['id', 'name']
        });
        const formatter = new Formatter();
        expect(() => formatter.format(query)).toThrow();
    });
});
