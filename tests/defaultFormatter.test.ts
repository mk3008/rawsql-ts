import { DefaultFormatter } from "../src/models/DefaultFormatter";
import { SelectClause, SelectCollection, SelectExpression } from "../src/models/SelectClause";
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
    const sql = formatter.visit(new SelectQuery(new SelectClause(new SelectCollection([
        new SelectExpression(new ColumnReference(['a'], 'id'), null),
        new SelectExpression(new ColumnReference(['a'], 'value'), null),
    ]))));
    expect(sql).toBe('select "a"."id", "a"."value"');
});