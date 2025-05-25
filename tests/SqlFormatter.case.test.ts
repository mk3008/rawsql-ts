import { describe, test, expect } from 'vitest';
import { Formatter } from "../src/transformers/Formatter";
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
    const formatter = new Formatter({
        indentChar: ' ',
        indentSize: 4,
        newline: '\n',
        keywordCase: 'upper',
        indentIncrementContainerTypes: [
            SqlPrintTokenContainerType.CaseExpression,
            SqlPrintTokenContainerType.SwitchCaseArgument
        ]
    });

    // Act
    const sql = formatter.format(caseExpr);

    // Assert - Check that proper formatting/indentation is applied
    expect(sql).toEqual(
        'CASE "status"\n' +
        '    WHEN \'active\' THEN 1\n' +
        '    WHEN \'pending\' THEN 2\n' +
        '    ELSE 0\n' +
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
    const formatter = new Formatter({
        indentChar: ' ',
        indentSize: 4,
        newline: '\n',
        keywordCase: 'upper',
        indentIncrementContainerTypes: [
            SqlPrintTokenContainerType.CaseExpression,
            SqlPrintTokenContainerType.SwitchCaseArgument
        ]
    });

    // Act
    const sql = formatter.format(caseExpr);

    // Assert - Check that proper formatting/indentation is applied
    expect(sql).toEqual(
        'CASE\n' +
        '    WHEN \'active\' THEN 1\n' +
        '    WHEN \'pending\' THEN 2\n' +
        '    ELSE 0\n' +
        'END'
    );
});