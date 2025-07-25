import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('SelectQueryParser.analyze', () => {
    test('should successfully analyze valid SELECT query', () => {
        // Arrange
        const sql = `SELECT id, name FROM users WHERE active = true`;

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(true);
        expect(result.query).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(result.errorPosition).toBeUndefined();
        expect(result.remainingTokens).toBeUndefined();
    });

    test('should successfully analyze complex query with JOIN', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name, o.order_id 
            FROM users u 
            JOIN orders o ON u.id = o.user_id 
            WHERE u.active = true
        `;

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(true);
        expect(result.query).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    test('should successfully parse query with alias (not missing FROM)', () => {
        // Arrange
        const sql = `SELECT id, name users`; // This is valid SQL: SELECT id, name AS users

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(true);
        expect(result.query).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    test('should successfully parse query with table alias', () => {
        // Arrange
        const sql = `SELECT id FROM users EXTRA_TOKEN`; // EXTRA_TOKEN is parsed as table alias

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(true);
        expect(result.query).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    test('should detect error when missing SELECT keyword', () => {
        // Arrange
        const sql = `UPDATE users SET name = 'test'`; // Wrong query type

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain("Expected 'SELECT' or 'VALUES'");
        expect(result.errorPosition).toBe(0); // Character position of 'update'
    });

    test('should handle empty query', () => {
        // Arrange
        const sql = ``;

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Unexpected end of input');
    });

    test('should analyze VALUES query successfully', () => {
        // Arrange
        const sql = `VALUES (1, 'John'), (2, 'Jane')`;

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(true);
        expect(result.query).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    test('should analyze UNION query successfully', () => {
        // Arrange
        const sql = `
            SELECT id, name FROM users 
            UNION 
            SELECT id, title FROM posts
        `;

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(true);
        expect(result.query).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    test('should detect error in UNION query with incomplete second part', () => {
        // Arrange
        const sql = `SELECT id FROM users UNION`; // Incomplete UNION

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain("Expected a query after 'UNION'");
    });

    test('should analyze WITH clause query successfully', () => {
        // Arrange
        const sql = `
            WITH user_data AS (SELECT * FROM users)
            SELECT id, name FROM user_data
        `;

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(true);
        expect(result.query).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    test('should detect invalid FROM clause syntax', () => {
        // Arrange
        const sql = `SELECT id FROM FROM users`; // Invalid double FROM

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Identifier list is empty');
    });

    test('should detect incomplete FROM clause', () => {
        // Arrange
        const sql = `SELECT id FROM`; // Incomplete FROM clause

        // Act
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Unexpected end of input after \'FROM\' keyword');
    });

    test('should detect remaining tokens after complete query', () => {
        // Arrange
        const sql = `SELECT * FROM users LIMIT 10 INVALID_KEYWORD`; 

        // Act  
        const result = SelectQueryParser.analyze(sql);

        // Assert
        expect(result.success).toBe(false);
        expect(result.query).toBeDefined(); // Partial parsing successful
        expect(result.error).toContain('Unexpected token "INVALID_KEYWORD"');
        expect(result.errorPosition).toBe(29); // Character position of 'INVALID_KEYWORD'
        expect(result.remainingTokens).toEqual(['INVALID_KEYWORD']);
    });
});