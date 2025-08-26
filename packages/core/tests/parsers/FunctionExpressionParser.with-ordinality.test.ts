import { describe, expect, test } from 'vitest';
import { FunctionExpressionParser } from '../../src/parsers/FunctionExpressionParser';
import { SqlTokenizer } from '../../src/parsers/SqlTokenizer';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('FunctionExpressionParser - WITH ORDINALITY', () => {
    const formatter = new SqlFormatter();

    describe('WITH ORDINALITY parsing', () => {
        test('should parse regexp_split_to_table with WITH ORDINALITY', () => {
            const sql = "regexp_split_to_table(:search_str, '') with ordinality";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            // Should parse the entire expression including WITH ORDINALITY
            expect(result.newIndex).toBe(lexemes.length);
            
            // Should be a FunctionCall with withOrdinality flag
            expect(result.value.constructor.name).toBe('FunctionCall');
            const functionCall = result.value as any;
            expect(functionCall.qualifiedName.name.value).toBe('regexp_split_to_table');
            expect(functionCall.withOrdinality).toBe(true);
        });

        test('should parse generate_series with WITH ORDINALITY', () => {
            const sql = "generate_series(1, 10) with ordinality";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            expect(result.newIndex).toBe(lexemes.length);
            const functionCall = result.value as any;
            expect(functionCall.qualifiedName.name.value).toBe('generate_series');
            expect(functionCall.withOrdinality).toBe(true);
        });

        test('should parse unnest with WITH ORDINALITY', () => {
            const sql = "unnest(array_column) with ordinality";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            expect(result.newIndex).toBe(lexemes.length);
            const functionCall = result.value as any;
            expect(functionCall.qualifiedName.name.value).toBe('unnest');
            expect(functionCall.withOrdinality).toBe(true);
        });

        test('should parse function without WITH ORDINALITY normally', () => {
            const sql = "generate_series(1, 10)";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            expect(result.newIndex).toBe(lexemes.length);
            const functionCall = result.value as any;
            expect(functionCall.qualifiedName.name.value).toBe('generate_series');
            expect(functionCall.withOrdinality).toBe(false);
        });
    });

    describe('formatting output', () => {
        test('should format function with WITH ORDINALITY correctly', () => {
            const sql = "regexp_split_to_table(:search_str, '') with ordinality";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            const formatted = formatter.format(result.value);
            
            expect(typeof formatted.formattedSql).toBe('string');
            expect(formatted.formattedSql.toLowerCase()).toMatch(/with ordinality/);
        });

        test('should format function without WITH ORDINALITY normally', () => {
            const sql = "generate_series(1, 10)";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            const formatted = formatter.format(result.value);
            
            expect(typeof formatted.formattedSql).toBe('string');
            expect(formatted.formattedSql.toLowerCase()).not.toMatch(/with ordinality/);
        });
    });
});