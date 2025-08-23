import { describe, expect, test } from 'vitest';
import { FunctionExpressionParser } from '../../src/parsers/FunctionExpressionParser';
import { SqlTokenizer } from '../../src/parsers/SqlTokenizer';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('FunctionExpressionParser - Aggregate Functions with ORDER BY', () => {
    const formatter = new SqlFormatter();

    describe('ORDER BY within function arguments', () => {
        test('should parse string_agg with ORDER BY clause', () => {
            const sql = "string_agg(new_ch, '' order by ord)";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            expect(result.newIndex).toBe(lexemes.length);
            const functionCall = result.value as any;
            expect(functionCall.qualifiedName.name.value).toBe('string_agg');
            
            // Should have ORDER BY clause within function arguments
            // This is different from WITHIN GROUP - it's inside the function parentheses
            expect(functionCall.argument).toBeDefined();
        });

        test('should parse array_agg with ORDER BY clause', () => {
            const sql = "array_agg(column_name order by sort_column)";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            expect(result.newIndex).toBe(lexemes.length);
            const functionCall = result.value as any;
            expect(functionCall.qualifiedName.name.value).toBe('array_agg');
            expect(functionCall.argument).toBeDefined();
        });

        test('should parse json_agg with ORDER BY clause', () => {
            const sql = "json_agg(data order by created_at)";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            expect(result.newIndex).toBe(lexemes.length);
            const functionCall = result.value as any;
            expect(functionCall.qualifiedName.name.value).toBe('json_agg');
        });

        test('should parse string_agg with multiple ORDER BY columns', () => {
            const sql = "string_agg(name, ', ' order by name, id desc)";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            expect(result.newIndex).toBe(lexemes.length);
            const functionCall = result.value as any;
            expect(functionCall.qualifiedName.name.value).toBe('string_agg');
        });

        test('should parse function without ORDER BY normally', () => {
            const sql = "string_agg(name, ', ')";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            
            expect(result.newIndex).toBe(lexemes.length);
            const functionCall = result.value as any;
            expect(functionCall.qualifiedName.name.value).toBe('string_agg');
        });
    });

    describe('formatting output', () => {
        test('should format function with internal ORDER BY correctly', () => {
            const sql = "string_agg(new_ch, '' order by ord)";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            const formatted = formatter.format(result.value);
            
            expect(typeof formatted.formattedSql).toBe('string');
            expect(formatted.formattedSql.toLowerCase()).toMatch(/order by/);
        });

        test('should format function without ORDER BY normally', () => {
            const sql = "string_agg(name, ', ')";
            const tokenizer = new SqlTokenizer(sql);
            const lexemes = tokenizer.readLexmes();
            
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, 0);
            const formatted = formatter.format(result.value);
            
            expect(typeof formatted.formattedSql).toBe('string');
            expect(formatted.formattedSql.toLowerCase()).not.toMatch(/order by/);
        });
    });
});