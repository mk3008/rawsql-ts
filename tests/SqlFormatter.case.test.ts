import { describe, expect, test } from 'vitest';
import { Formatter } from "../src/transformers/Formatter";
import { CaseExpression, CaseKeyValuePair, LiteralValue, SwitchCaseArgument } from '../src/models/ValueComponent';
import { ColumnReference } from '../src/models/ValueComponent';

describe('CASE expression formatting', () => {
    
    test('Simple CASE expression formatting with default style', () => {
        // Arrange
        const formatter = new Formatter();
        
        // Create a CASE expression: CASE WHEN x > 10 THEN 'high' ELSE 'low' END
        const caseExpr = new CaseExpression(
            null, // no condition
            new SwitchCaseArgument(
                [
                    new CaseKeyValuePair(
                        new ColumnReference([], 'x > 10'), // key (when condition)
                        new LiteralValue('high')  // value (then result)
                    )
                ],
                new LiteralValue('low') // else value
            )
        );
        
        // Act
        const sql = formatter.format(caseExpr, {
            indentChar: '',
            indentSize: 0,
            newline: ' '
        });
        
        // Assert
        expect(sql).toBe('case when "x > 10" then \'high\' else \'low\' end');
    });
    
    test('CASE expression with custom indentation (2 spaces)', () => {
        // Arrange
        const formatter = new Formatter();
        
        // Create a CASE expression with multiple WHEN/THEN pairs
        const caseExpr = new CaseExpression(
            new ColumnReference([], 'status'), // condition
            new SwitchCaseArgument(
                [
                    new CaseKeyValuePair(
                        new LiteralValue('active'),
                        new LiteralValue('green')
                    ),
                    new CaseKeyValuePair(
                        new LiteralValue('pending'),
                        new LiteralValue('yellow')
                    ),
                    new CaseKeyValuePair(
                        new LiteralValue('inactive'),
                        new LiteralValue('red')
                    )
                ],
                new LiteralValue('gray') // else value
            )
        );
        
        // Act
        const sql = formatter.format(caseExpr, {
            indentChar: ' ',
            indentSize: 2,
            newline: '\n',
            keywordCase: 'upper'
        });
        
        // Assert
        expect(sql).toBe(
            'CASE "status"\n' +
            '  WHEN \'active\'\n' +
            '  THEN \'green\'\n' +
            '  WHEN \'pending\'\n' +
            '  THEN \'yellow\'\n' +
            '  WHEN \'inactive\'\n' +
            '  THEN \'red\'\n' +
            '  ELSE \'gray\'\n' +
            'END'
        );
    });
    
    test('CASE expression with tab indentation', () => {
        // Arrange
        const formatter = new Formatter();
        
        // Create a nested CASE expression
        const innerCaseExpr = new CaseExpression(
            null,
            new SwitchCaseArgument(
                [
                    new CaseKeyValuePair(
                        new ColumnReference([], 'y < 0'),
                        new LiteralValue('negative')
                    )
                ],
                new LiteralValue('positive')
            )
        );
        
        const caseExpr = new CaseExpression(
            null,
            new SwitchCaseArgument(
                [
                    new CaseKeyValuePair(
                        new ColumnReference([], 'x < 0'),
                        innerCaseExpr
                    )
                ],
                new LiteralValue('x is positive')
            )
        );
        
        // Act
        const sql = formatter.format(caseExpr, {
            indentChar: '\t',
            indentSize: 1,
            newline: '\n',
            keywordCase: 'upper'
        });
        
        // Assert
        expect(sql).toBe(
            'CASE\n' +
            '\tWHEN "x < 0"\n' +
            '\tTHEN CASE\n' +
            '\t\tWHEN "y < 0"\n' +
            '\t\tTHEN \'negative\'\n' +
            '\t\tELSE \'positive\'\n' +
            '\tEND\n' +
            '\tELSE \'x is positive\'\n' +
            'END'
        );
    });
    
    test('CASE expression with custom newline character', () => {
        // Arrange
        const formatter = new Formatter();
        
        // Create a CASE expression
        const caseExpr = new CaseExpression(
            new ColumnReference([], 'x'),
            new SwitchCaseArgument(
                [
                    new CaseKeyValuePair(
                        new LiteralValue(1),
                        new LiteralValue('one')
                    ),
                    new CaseKeyValuePair(
                        new LiteralValue(2),
                        new LiteralValue('two')
                    )
                ],
                new LiteralValue('other')
            )
        );
        
        // Act
        const sql = formatter.format(caseExpr, {
            indentChar: ' ',
            indentSize: 4,
            newline: '\r\n', // CRLF line endings
            keywordCase: 'lower'
        });
        
        // Assert
        expect(sql).toBe(
            'case "x"\r\n' +
            '    when 1\r\n' +
            '    then \'one\'\r\n' +
            '    when 2\r\n' +
            '    then \'two\'\r\n' +
            '    else \'other\'\r\n' +
            'end'
        );
    });
});