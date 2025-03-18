import { BinaryExpression, ColumnReference, LiteralValue, SelectClause, SelectQuery, ValueExpressionFormatter } from "../src/models/ValueExpression";

test('ColumnReference', () => {
    const formatter = new ValueExpressionFormatter();
    const sql = formatter.visit(new ColumnReference(['a'], 'id'));
    expect(sql).toBe('"a"."id"');
});

test('LiteralExpression escape', () => {
    const formatter = new ValueExpressionFormatter();
    const sql = formatter.visit(new LiteralValue("O'Reilly"));
    expect(sql).toBe("'O''Reilly'");
});

test('LiteralExpression num?', () => {
    const formatter = new ValueExpressionFormatter();
    const sql = formatter.visit(new LiteralValue('1'));
    expect(sql).toBe("'1'");
});

test('LiteralExpression num?', () => {
    const formatter = new ValueExpressionFormatter();
    const sql = formatter.visit(new LiteralValue(1));
    expect(sql).toBe('1');
});

test('BinaryExpression', () => {
    const formatter = new ValueExpressionFormatter();
    const sql = formatter.visit(new BinaryExpression(new ColumnReference(['a'], 'id'), '+', new LiteralValue(1)));
    expect(sql).toBe('"a"."id" + 1');
});

test('SelectQuery', () => {
    const formatter = new ValueExpressionFormatter();
    const sql = formatter.visit(new SelectQuery(new SelectClause([
        new ColumnReference(['a'], 'id')
        , new ColumnReference(['a'], 'value')
    ])));
    expect(sql).toBe('select "a"."id", "a"."value"');
});