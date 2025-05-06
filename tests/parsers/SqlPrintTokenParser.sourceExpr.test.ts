import { describe, it, expect } from 'vitest';
import { SqlPrintTokenParser } from '../../src/parsers/SqlPrintTokenParser';
import { SqlPrinter } from '../../src/transformers/SqlPrinter';
import { SourceExpressionParser } from '../../src/parsers/SourceExpressionParser';

describe('SqlPrintTokenParser + SqlPrinter (SourceExpressionParser)', () => {
    it('should print simple table name', () => {
        // Arrange
        const node = SourceExpressionParser.parse('users');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"users"');
    });

    it('should print table name with schema', () => {
        // Arrange
        const node = SourceExpressionParser.parse('public.users');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"public"."users"');
    });

    it('should print table name with alias', () => {
        // Arrange
        const node = SourceExpressionParser.parse('users u');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"users" as "u"');
    });

    it('should print table name with schema and alias', () => {
        // Arrange
        const node = SourceExpressionParser.parse('public.users as u');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"public"."users" as "u"');
    });

    it('should omit alias if same as table name', () => {
        // Arrange
        const node = SourceExpressionParser.parse('users as users');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('"users"');
    });
});
