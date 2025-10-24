import { describe, expect, test } from 'vitest';
import { ValueParser } from '../../src/parsers/ValueParser';
import { Formatter } from '../../src/transformers/Formatter';
import { ArraySliceExpression, ArrayIndexExpression } from '../../src/models/ValueComponent';

describe('ValueParser - Array Slice Syntax (Implemented)', () => {
    const formatter = new Formatter();
    
    describe('Array slice syntax should parse successfully', () => {
        test.each([
            // Basic array slice syntax
            ["Array literal with slice", "(ARRAY[1,2,3])[1:2]", "(array[1, 2, 3])[1:2]"],
            ["Array literal with single index", "(ARRAY[1,2,3])[1]", "(array[1, 2, 3])[1]"],
            ["Column reference with slice", "arr[1:2]", '"arr"[1:2]'],
            ["Column reference with single index", "arr[1]", '"arr"[1]'],
            ["Array expression with slice", "ARRAY[1,2,3][1:2]", "array[1, 2, 3][1:2]"],
            
            // More complex cases
            ["Nested array slice", "arr[1:2][0]", '"arr"[1:2][0]'],
            ["Multiple slice operations", "arr[1:2][3:4]", '"arr"[1:2][3:4]'],
            ["Array slice with expression indices", "arr[x:y]", '"arr"["x":"y"]'],
            ["Mixed slice and index", "arr[1:2][3]", '"arr"[1:2][3]'],
            
            // PostgreSQL-style array slice syntax  
            ["PostgreSQL array with open slice", "arr[1:]", '"arr"[1:]'],
            ["PostgreSQL array with open start", "arr[:2]", '"arr"[:2]'],
            ["PostgreSQL array with both open", "arr[:]", '"arr"[:]'],
            
            // Complex expressions with array slicing
            ["Function result with slice", "get_array()[1:2]", 'get_array()[1:2]'],
            ["Cast expression with slice", "(column::int[])[1:2]", '(cast("column" as int[]))[1:2]'],
            ["Parenthesized expression with slice", "(a + b)[1:2]", '("a" + "b")[1:2]'],
        ])('%s: %s', (description, input, expected) => {
            const value = ValueParser.parse(input);
            const formatted = formatter.format(value);
            expect(formatted).toBe(expected);
        });
    });

    describe('Array slice AST structure validation', () => {
        test('Array slice expression creates ArraySliceExpression', () => {
            const result = ValueParser.parse("arr[1:2]");
            expect(result).toBeInstanceOf(ArraySliceExpression);
            
            const slice = result as ArraySliceExpression;
            expect(slice.startIndex).toBeTruthy();
            expect(slice.endIndex).toBeTruthy();
        });

        test('Array index expression creates ArrayIndexExpression', () => {
            const result = ValueParser.parse("arr[1]");
            expect(result).toBeInstanceOf(ArrayIndexExpression);
            
            const index = result as ArrayIndexExpression;
            expect(index.index).toBeTruthy();
        });

        test('Open slice expressions handle null indices correctly', () => {
            const openEnd = ValueParser.parse("arr[1:]") as ArraySliceExpression;
            expect(openEnd.startIndex).toBeTruthy();
            expect(openEnd.endIndex).toBe(null);

            const openStart = ValueParser.parse("arr[:2]") as ArraySliceExpression;
            expect(openStart.startIndex).toBe(null);
            expect(openStart.endIndex).toBeTruthy();

            const openBoth = ValueParser.parse("arr[:]") as ArraySliceExpression;
            expect(openBoth.startIndex).toBe(null);
            expect(openBoth.endIndex).toBe(null);
        });

        test('Chained array access creates nested structures', () => {
            const result = ValueParser.parse("arr[1:2][3]");
            expect(result).toBeInstanceOf(ArrayIndexExpression);
            
            const outer = result as ArrayIndexExpression;
            expect(outer.array).toBeInstanceOf(ArraySliceExpression);
        });
    });
    
    describe('Array expressions without slicing should continue to work', () => {
        test.each([
            ["Array literal", "ARRAY[1,2,3]", "array[1, 2, 3]"],
            ["Array function call", "ARRAY(SELECT 1)", "array(select 1)"],
            ["Parenthesized array", "(ARRAY[1,2,3])", "(array[1, 2, 3])"],
            ["Simple column reference", "column_name", '"column_name"'],
            ["PostgreSQL array literal", "'{1,2,3}'::int[]", "cast('{1,2,3}' as int[])"],
        ])('%s: %s', (description, input, expected) => {
            const value = ValueParser.parse(input);
            const formatted = formatter.format(value);
            expect(formatted).toBe(expected);
        });
    });

    describe('Edge cases and error handling', () => {
        test('Empty brackets should throw error', () => {
            expect(() => {
                ValueParser.parse("arr[]");
            }).toThrow('Unparsed lexeme remains');
        });

        test('Complex expressions in slice indices work', () => {
            const result = ValueParser.parse("arr[func(x) + 1:func(y) - 1]");
            expect(result).toBeInstanceOf(ArraySliceExpression);
            
            const slice = result as ArraySliceExpression;
            expect(slice.startIndex).toBeTruthy();
            expect(slice.endIndex).toBeTruthy();
        });
    });
});
