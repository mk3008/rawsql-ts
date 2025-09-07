import { describe, expect, test } from 'vitest';
import { SelectClause, SelectItem } from "../../src/models/Clause";
import { Formatter } from "../../src/transformers/Formatter";
import { SelectQuery, SimpleSelectQuery } from "../../src/models/SelectQuery";
import { ColumnReference, LiteralValue, BinaryExpression } from "../../src/models/ValueComponent";

test('ColumnReference', () => {
    const formatter = new Formatter();
    const sql = formatter.format(new ColumnReference(['a'], 'id'));
    expect(sql).toBe('"a"."id"');
});

test('LiteralExpression escape', () => {
    const formatter = new Formatter();
    const sql = formatter.format(new LiteralValue("O'Reilly", undefined, true));
    expect(sql).toBe("'O''Reilly'");
});

test('LiteralExpression num?', () => {
    const formatter = new Formatter();
    const sql = formatter.format(new LiteralValue('1', undefined, true));
    expect(sql).toBe("'1'");
});

test('LiteralExpression num?', () => {
    const formatter = new Formatter();
    const sql = formatter.format(new LiteralValue(1));
    expect(sql).toBe('1');
});

test('BinaryExpression', () => {
    const formatter = new Formatter();
    const sql = formatter.format(new BinaryExpression(new ColumnReference(['a'], 'id'), '+', new LiteralValue(1)));
    expect(sql).toBe('"a"."id" + 1');
});

test('SelectQuery', () => {
    const formatter = new Formatter();
    const sql = formatter.format(new SimpleSelectQuery({
        selectClause: new SelectClause([
            new SelectItem(new ColumnReference(['a'], 'id')),
            new SelectItem(new ColumnReference(['a'], 'value')),
        ]),
    }));
    expect(sql).toBe('select "a"."id", "a"."value"');
});