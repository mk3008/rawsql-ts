import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';
import { LiteralValue } from '../src/models/ValueComponent';
import { SimpleSelectQuery } from '../src/models/SimpleSelectQuery';

describe('String Literal Keywords Bug Fix', () => {
    test('should preserve string literal null in SELECT', () => {
        // Arrange
        const sql = "select 'null' from users";
        
        // Act
        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({ exportComment: false });
        const result = formatter.format(query);
        
        // Assert - Check AST structure
        const simpleQuery = query as SimpleSelectQuery;
        const firstItem = simpleQuery.selectClause.items[0];
        expect(firstItem.value).toBeInstanceOf(LiteralValue);
        const literalValue = firstItem.value as LiteralValue;
        expect(literalValue.value).toBe('null');
        expect(literalValue.isStringLiteral).toBe(true);
        
        // Assert - Check formatted output
        expect(result.formattedSql).toContain("'null'");
        expect(result.formattedSql).not.toMatch(/\bnull\b(?!')/); // Should not contain bare null
    });

    test('should preserve string literal true in SELECT', () => {
        // Arrange
        const sql = "select 'true' from users";
        
        // Act
        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({ exportComment: false });
        const result = formatter.format(query);
        
        // Assert - Check AST structure
        const simpleQuery = query as SimpleSelectQuery;
        const firstItem = simpleQuery.selectClause.items[0];
        expect(firstItem.value).toBeInstanceOf(LiteralValue);
        const literalValue = firstItem.value as LiteralValue;
        expect(literalValue.value).toBe('true');
        expect(literalValue.isStringLiteral).toBe(true);
        
        // Assert - Check formatted output
        expect(result.formattedSql).toContain("'true'");
        expect(result.formattedSql).not.toMatch(/\btrue\b(?!')/); // Should not contain bare true
    });

    test('should preserve string literal false in SELECT', () => {
        // Arrange
        const sql = "select 'false' from users";
        
        // Act
        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({ exportComment: false });
        const result = formatter.format(query);
        
        // Assert - Check AST structure
        const simpleQuery = query as SimpleSelectQuery;
        const firstItem = simpleQuery.selectClause.items[0];
        expect(firstItem.value).toBeInstanceOf(LiteralValue);
        const literalValue = firstItem.value as LiteralValue;
        expect(literalValue.value).toBe('false');
        expect(literalValue.isStringLiteral).toBe(true);
        
        // Assert - Check formatted output
        expect(result.formattedSql).toContain("'false'");
        expect(result.formattedSql).not.toMatch(/\bfalse\b(?!')/); // Should not contain bare false
    });

    test('should still handle bare null keyword correctly', () => {
        // Arrange
        const sql = "select null from users";
        
        // Act
        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({ exportComment: false });
        const result = formatter.format(query);
        
        // Assert - Check formatted output
        expect(result.formattedSql).toMatch(/\bnull\b/); // Should contain bare null
        expect(result.formattedSql).not.toContain("'null'"); // Should not contain quoted null
    });

    test('should still handle bare true keyword correctly', () => {
        // Arrange
        const sql = "select true from users";
        
        // Act
        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({ exportComment: false });
        const result = formatter.format(query);
        
        // Assert - Check formatted output
        expect(result.formattedSql).toMatch(/\btrue\b/); // Should contain bare true
        expect(result.formattedSql).not.toContain("'true'"); // Should not contain quoted true
    });

    test('should handle mixed quoted and unquoted literals in same query', () => {
        // Arrange
        const sql = "select 'null', null, 'true', true from users";
        
        // Act
        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({ exportComment: false });
        const result = formatter.format(query);
        
        // Assert - Check AST structure
        const simpleQuery = query as SimpleSelectQuery;
        const items = simpleQuery.selectClause.items;
        expect(items).toHaveLength(4);
        
        // First item: 'null' (string)
        const item1 = items[0].value as LiteralValue;
        expect(item1.value).toBe('null');
        expect(item1.isStringLiteral).toBe(true);
        
        // Second item: null (keyword) - should be RawString
        expect(items[1].value.constructor.name).toBe('RawString');
        
        // Third item: 'true' (string)
        const item3 = items[2].value as LiteralValue;
        expect(item3.value).toBe('true');
        expect(item3.isStringLiteral).toBe(true);
        
        // Fourth item: true (keyword) - should be RawString
        expect(items[3].value.constructor.name).toBe('RawString');
        
        // Assert - Check formatted output
        expect(result.formattedSql).toContain("'null'");
        expect(result.formattedSql).toContain("'true'");
        expect(result.formattedSql).toMatch(/,\s*null\s*,/); // bare null between commas
        expect(result.formattedSql).toMatch(/,\s*true\s+from/i); // bare true before FROM (case insensitive)
    });
});