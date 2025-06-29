import { describe, test, expect } from 'vitest';
import { SqlFormatter } from "../src/transformers/SqlFormatter";
import { CaseExpression, CaseKeyValuePair, IdentifierString, LiteralValue, SwitchCaseArgument } from "../src/models/ValueComponent";
import { SqlPrintTokenContainerType } from "../src/models/SqlPrintToken";

test('CASE expression formatting with custom indentation', () => {
    // Arrange
    const switchCase = new SwitchCaseArgument([
        new CaseKeyValuePair(
            new LiteralValue('active'),
            new LiteralValue(1)
        ),
        new CaseKeyValuePair(
            new LiteralValue('pending'),
            new LiteralValue(2)
        )
    ], new LiteralValue(0));

    const caseExpr = new CaseExpression(
        new IdentifierString('status'),
        switchCase
    );

    // Create formatter with custom style
    const formatter = new SqlFormatter({
        indentChar: ' ',
        indentSize: 4,
        newline: '\n',
        keywordCase: 'upper',
    });

    // Act
    const result = formatter.format(caseExpr);
    const sql = result.formattedSql;

    // Assert - Check that proper formatting/indentation is applied
    expect(sql).toEqual(
        'CASE "status"\n' +
        '    WHEN \'active\' THEN\n' +
        '        1\n' +
        '    WHEN \'pending\' THEN\n' +
        '        2\n' +
        '    ELSE\n' +
        '        0\n' +
        'END'
    );
});

test('CASE WHEN expression (without condition) formatting', () => {
    // Arrange
    const switchCase = new SwitchCaseArgument([
        new CaseKeyValuePair(
            new LiteralValue('active'),
            new LiteralValue(1)
        ),
        new CaseKeyValuePair(
            new LiteralValue('pending'),
            new LiteralValue(2)
        )
    ], new LiteralValue(0));

    const caseExpr = new CaseExpression(null, switchCase);

    // Create formatter with custom style
    const formatter = new SqlFormatter({
        indentChar: ' ',
        indentSize: 4,
        newline: '\n',
        keywordCase: 'upper',
    });

    // Act
    const result = formatter.format(caseExpr);
    const sql = result.formattedSql;

    // Assert - Check that proper formatting/indentation is applied
    expect(sql).toEqual(
        'CASE\n' +
        '    WHEN \'active\' THEN\n' +
        '        1\n' +
        '    WHEN \'pending\' THEN\n' +
        '        2\n' +
        '    ELSE\n' +
        '        0\n' +
        'END'
    );
});