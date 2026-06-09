import { describe, expect, test } from 'vitest';
import { FunctionExpressionParser } from '../../src/parsers/FunctionExpressionParser';
import { SqlTokenizer } from '../../src/parsers/SqlTokenizer';
import { BinaryExpression, ColumnReference, FunctionCall, LiteralValue } from '../../src/models/ValueComponent';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('FunctionExpressionParser', () => {
    describe('standard function calls', () => {
        test('parses simple function call', () => {
            const tokenizer = new SqlTokenizer('count(*)');
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            expect(result.value).toBeDefined();
            expect(result.newIndex).toBe(4);
        });
    });

    describe('WITHIN GROUP clause', () => {
        test('should parse PERCENTILE_CONT with WITHIN GROUP - basic', () => {
            const tokenizer = new SqlTokenizer('PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount)');
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            // Should parse the entire expression, not just the function call
            expect(result.newIndex).toBe(lexemes.length);
            
            // Should be a FunctionCall with withinGroup clause
            expect(result.value.constructor.name).toBe('FunctionCall');
            const functionCall = result.value as any;
            expect(functionCall.qualifiedName.name.value).toBe('percentile_cont');
            expect(functionCall.withinGroup).not.toBeNull();
            expect(functionCall.withinGroup.constructor.name).toBe('OrderByClause');
        });

        test('should parse PERCENTILE_DISC with WITHIN GROUP', () => {
            const tokenizer = new SqlTokenizer('PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY amount)');
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            expect(result.newIndex).toBe(lexemes.length);
        });

        test('should parse MODE with WITHIN GROUP', () => {
            const tokenizer = new SqlTokenizer('MODE() WITHIN GROUP (ORDER BY category)');
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            expect(result.newIndex).toBe(lexemes.length);
        });

        test('should parse RANK with WITHIN GROUP', () => {
            const tokenizer = new SqlTokenizer('RANK(5) WITHIN GROUP (ORDER BY score)');
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            expect(result.newIndex).toBe(lexemes.length);
        });

        test('should parse original problem case exactly', () => {
            // Test the exact case from the user's problem
            const tokenizer = new SqlTokenizer('PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount)');
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            // Should parse the entire expression
            expect(result.newIndex).toBe(lexemes.length);
            
            // Function should have WITHIN GROUP clause populated
            const functionCall = result.value as any;
            expect(functionCall.withinGroup).not.toBeNull();
        });
    });

    describe('FILTER clause', () => {
        test('parses aggregates with FILTER predicates', () => {
            const tokenizer = new SqlTokenizer('SUM(amount) FILTER (WHERE year = 2023)');
            const lexemes = tokenizer.readLexmes();

            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);

            expect(result.newIndex).toBe(lexemes.length);
            expect(result.value).toBeInstanceOf(FunctionCall);

            const functionCall = result.value as FunctionCall;
            expect(functionCall.filterCondition).not.toBeNull();

            const filterExpression = functionCall.filterCondition as BinaryExpression;
            expect(filterExpression.operator.value).toBe('=');
            expect(filterExpression.left).toBeInstanceOf(ColumnReference);
            expect(filterExpression.right).toBeInstanceOf(LiteralValue);
            expect((filterExpression.right as LiteralValue).value).toBe(2023);
        });

        test('retains FILTER clause before OVER expressions', () => {
            const tokenizer = new SqlTokenizer('SUM(amount) FILTER (WHERE year = 2024) OVER ()');
            const lexemes = tokenizer.readLexmes();

            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);

            expect(result.newIndex).toBe(lexemes.length);
            const functionCall = result.value as FunctionCall;
            expect(functionCall.filterCondition).not.toBeNull();
            expect(functionCall.over).not.toBeNull();
        });
    });

    describe('PostgreSQL 19 null treatment for window functions', () => {
        test('parses IGNORE NULLS before OVER', () => {
            const tokenizer = new SqlTokenizer('lead(value) IGNORE NULLS OVER (ORDER BY created_at)');
            const lexemes = tokenizer.readLexmes();

            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);

            expect(result.newIndex).toBe(lexemes.length);
            expect(result.value).toBeInstanceOf(FunctionCall);

            const functionCall = result.value as FunctionCall;
            expect(functionCall.nullsTreatment).toBe('ignore nulls');
            expect(functionCall.over).not.toBeNull();

            const query = new SqlFormatter().format(functionCall).formattedSql;
            expect(query).toBe('lead("value") ignore nulls over(order by "created_at")');
        });

        test('parses RESPECT NULLS before OVER', () => {
            const tokenizer = new SqlTokenizer('first_value(value) RESPECT NULLS OVER (PARTITION BY account_id ORDER BY created_at)');
            const lexemes = tokenizer.readLexmes();

            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);

            expect(result.newIndex).toBe(lexemes.length);
            const functionCall = result.value as FunctionCall;
            expect(functionCall.nullsTreatment).toBe('respect nulls');

            const query = new SqlFormatter().format(functionCall).formattedSql;
            expect(query).toBe('first_value("value") respect nulls over(partition by "account_id" order by "created_at")');
        });
    });
});
