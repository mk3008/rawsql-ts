import { SelectClause, SelectList, SelectItem } from "../src/models/Clause";
import { DefaultFormatter } from "../src/models/DefaultFormatter";
import { SelectQuery } from "../src/models/SelectQuery";
import { ColumnReference, LiteralValue, BinaryExpression } from "../src/models/ValueComponent";

test('ColumnReference', () => {
    const formatter = new DefaultFormatter();
    const sql = formatter.visit(new ColumnReference(['a'], 'id'));
    expect(sql).toBe('"a"."id"');
});

test('LiteralExpression escape', () => {
    const formatter = new DefaultFormatter();
    const sql = formatter.visit(new LiteralValue("O'Reilly"));
    expect(sql).toBe("'O''Reilly'");
});

test('LiteralExpression num?', () => {
    const formatter = new DefaultFormatter();
    const sql = formatter.visit(new LiteralValue('1'));
    expect(sql).toBe("'1'");
});

test('LiteralExpression num?', () => {
    const formatter = new DefaultFormatter();
    const sql = formatter.visit(new LiteralValue(1));
    expect(sql).toBe('1');
});

test('BinaryExpression', () => {
    const formatter = new DefaultFormatter();
    const sql = formatter.visit(new BinaryExpression(new ColumnReference(['a'], 'id'), '+', new LiteralValue(1)));
    expect(sql).toBe('"a"."id" + 1');
});

test('SelectQuery', () => {
    const formatter = new DefaultFormatter();
    const sql = formatter.visit(new SelectQuery(
        null,
        new SelectClause(new SelectList([
            new SelectItem(new ColumnReference(['a'], 'id'), null),
            new SelectItem(new ColumnReference(['a'], 'value'), null),
        ],
        )),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null));
    expect(sql).toBe('select "a"."id", "a"."value"');
});