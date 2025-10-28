import { describe, expect, test } from 'vitest';
import { CreateTableParser } from '../../src/parsers/CreateTableParser';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter indentNestedParentheses option', () => {
    const sql = `SELECT
    *
FROM sales
WHERE (a = 1 OR b = 2) AND ((c IS NULL) OR (d <= 10) OR (e >= 20));`;

    test('indentNestedParentheses true expands outer group when nested parentheses exist', () => {
        const query = SelectQueryParser.parse(sql);
        // Enable indentation to expand only the outer group while keeping inner checks compact.
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
            parenthesesOneLine: true,
            orBreak: 'before',
            indentNestedParentheses: true,
        });

        const expectedSql = `select
  *
from
  "sales"
where
  ("a" = 1 or "b" = 2) and (
    ("c" is null)
    or ("d" <= 10)
    or ("e" >= 20)
  )`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });

    test('indentNestedParentheses false keeps entire group on a single indentation level', () => {
        const query = SelectQueryParser.parse(sql);
        // Confirm default behavior keeps parentheses compact when indentation toggle is disabled.
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
            parenthesesOneLine: true,
            orBreak: 'before',
            indentNestedParentheses: false,
        });

        const expectedSql = `select
  *
from
  "sales"
where
  ("a" = 1 or "b" = 2) and (("c" is null) or ("d" <= 10) or ("e" >= 20))`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });

    test('indentNestedParentheses true indents table-level CHECK constraints with nested groups', () => {
        const ddl = [
            'CREATE TABLE table_a (',
            '    id SERIAL PRIMARY KEY',
            '    , start_birthday DATE',
            '    , end_birthday DATE',
            '    , CONSTRAINT chk_nested CHECK((start_birthday IS NULL AND end_birthday IS NULL)',
            '    OR (start_birthday IS NOT NULL AND end_birthday IS NOT NULL))',
            ')',
        ].join('\n');

        const ast = CreateTableParser.parse(ddl);
        // Ensure CREATE TABLE check constraints mirror SELECT formatting when nested boolean groups are present.
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 4,
            indentChar: ' ',
            keywordCase: 'lower',
            commaBreak: 'before',
            orBreak: 'before',
            identifierEscape: 'none',
            indentNestedParentheses: true,
        });

        const expected = [
            'create table table_a(',
            '    id SERIAL primary key',
            '    , start_birthday DATE',
            '    , end_birthday DATE',
            '    , constraint chk_nested check(',
            '        (start_birthday is null and end_birthday is null)',
            '        or (start_birthday is not null and end_birthday is not null)',
            '    )',
            ')',
        ].join('\n');

        const { formattedSql } = formatter.format(ast);

        expect(formattedSql).toBe(expected);
    });

    test('indentNestedParentheses true indents column-level CHECK constraints with nested groups', () => {
        const ddl = [
            'CREATE TABLE metrics (',
            '    score INTEGER CHECK((score IS NULL) OR (score > 0))',
            ')',
        ].join('\n');

        const ast = CreateTableParser.parse(ddl);
        // Validate column constraints reuse the same ParenExpression path for nested indentation logic.
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 4,
            indentChar: ' ',
            keywordCase: 'lower',
            commaBreak: 'before',
            orBreak: 'before',
            identifierEscape: 'none',
            indentNestedParentheses: true,
        });

        const expected = [
            'create table metrics(',
            '    score INTEGER check(',
            '        (score is null)',
            '        or (score > 0)',
            '    )',
            ')',
        ].join('\n');

        const { formattedSql } = formatter.format(ast);

        expect(formattedSql).toBe(expected);
    });
});
