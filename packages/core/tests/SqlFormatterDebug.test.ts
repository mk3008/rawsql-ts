import { describe, test, expect } from 'vitest';
import { SqlFormatter } from "../src/transformers/SqlFormatter";
import { CaseExpression, CaseKeyValuePair, IdentifierString, LiteralValue, SwitchCaseArgument } from "../src/models/ValueComponent";
import { SqlPrintTokenContainerType } from "../src/models/SqlPrintToken";

test('Debug CASE formatting with SqlFormatter', () => {
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

    // Create SqlFormatter directly with explicit options
    const formatter = new SqlFormatter({
        indentChar: ' ',
        indentSize: 4,
        newline: '\n',
        keywordCase: 'upper',
        indentIncrementContainerTypes: [
            SqlPrintTokenContainerType.CaseExpression,
            SqlPrintTokenContainerType.SwitchCaseArgument,
            SqlPrintTokenContainerType.CaseKeyValuePair,
            SqlPrintTokenContainerType.ElseClause
        ]
    });

    // Act
    const result = formatter.format(caseExpr);
    console.log('Formatted SQL:', result.formattedSql);

    // Assert
    expect(result.formattedSql).toContain('\n');
});