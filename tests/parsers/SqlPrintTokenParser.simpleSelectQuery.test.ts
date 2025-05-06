import { describe, it, expect } from 'vitest';
import { SqlPrintTokenParser } from '../../src/parsers/SqlPrintTokenParser';
import { SqlPrinter } from '../../src/transformers/SqlPrinter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

// This test class is for SimpleSelectQuery printing only.
describe('SqlPrintTokenParser + SqlPrinter (SimpleSelectQuery)', () => {
    it('should print simple SELECT * FROM table', () => {
        // Arrange
        const node = SelectQueryParser.parse('select * from users');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('select * from "users"');
    });

    it('should print SELECT with columns', () => {
        // Arrange
        const node = SelectQueryParser.parse('select id, name from users');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('select "id", "name" from "users"');
    });

    it('should print SELECT with WHERE', () => {
        // Arrange
        const node = SelectQueryParser.parse('select id from users where id = 1');
        const parser = new SqlPrintTokenParser();
        const token = parser.visit(node);

        // Act
        const printer = new SqlPrinter();
        const sql = printer.print(token);

        // Assert
        expect(sql).toBe('select "id" from "users" where "id" = 1');
    });
});
