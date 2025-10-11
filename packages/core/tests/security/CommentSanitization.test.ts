import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { CommentEditor } from '../../src/utils/CommentEditor';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

describe('Comment Security and Sanitization', () => {
    const formatter = new SqlFormatter({ exportComment: true });

    describe('SQL Injection Prevention', () => {
        test('should prevent comment injection with */ sequences', () => {
            const query = SelectQueryParser.parse('SELECT id FROM users');
            const maliciousComment = 'malicious */ DROP TABLE users; /*';
            
            CommentEditor.addComment(query, maliciousComment);
            const result = formatter.format(query);
            
            // Verify that */ sequences are sanitized
            expect(result.formattedSql).not.toContain('*/ DROP');
            expect(result.formattedSql).toContain('/* malicious *\\/ DROP TABLE users; \\/\\* */');
            
            // Verify comment is contained within block
            const commentStartIndex = result.formattedSql.indexOf('/* malicious');
            const commentEndIndex = result.formattedSql.indexOf(' */ select');
            expect(commentStartIndex).toBeLessThan(commentEndIndex);
        });

        test('should prevent nested comment attacks', () => {
            const query = SelectQueryParser.parse('SELECT id FROM users');
            const nestedComment = '/* nested comment attack */';
            
            CommentEditor.addComment(query, nestedComment);
            const result = formatter.format(query);
            
            // Verify nested comments are sanitized
            expect(result.formattedSql).toContain('/* nested comment attack */');
            expect(result.formattedSql).not.toContain('/* /* nested');
        });

        test('should sanitize multiple dangerous sequences', () => {
            const query = SelectQueryParser.parse('SELECT id FROM users');
            const complexAttack = 'test */ SELECT password FROM secrets; /* more */ DROP TABLE important; /*';
            
            CommentEditor.addComment(query, complexAttack);
            const result = formatter.format(query);
            
            // Verify all dangerous sequences are removed
            expect(result.formattedSql).not.toContain('*/ SELECT');
            expect(result.formattedSql).not.toContain('/* more');
            expect(result.formattedSql).not.toContain('*/ DROP');
            
            // Verify sanitized version is safe
            expect(result.formattedSql).toContain('/* test *\\/ SELECT password FROM secrets; \\/\\* more *\\/ DROP TABLE important; \\/\\* */');
        });

        test('should handle newlines in comments', () => {
            const query = SelectQueryParser.parse('SELECT id FROM users');
            const multilineComment = 'First line\nSecond line\r\nThird line';
            
            CommentEditor.addComment(query, multilineComment);
            const result = formatter.format(query);
            
            // Verify newlines are converted to spaces
            expect(result.formattedSql).toContain('/* First line Second line Third line */');
            expect(result.formattedSql).not.toContain('\n');
            expect(result.formattedSql).not.toContain('\r');
        });

        test('should preserve safe comment content', () => {
            const query = SelectQueryParser.parse('SELECT id FROM users');
            const safeComment = 'This is a safe comment with numbers 123 and symbols !@#$%^&*()';
            
            CommentEditor.addComment(query, safeComment);
            const result = formatter.format(query);
            
            // Verify safe content is preserved
            expect(result.formattedSql).toContain(`/* ${safeComment} */`);
        });

        test('should handle empty and whitespace-only comments', () => {
            const query1 = SelectQueryParser.parse('SELECT id FROM users');
            const query2 = SelectQueryParser.parse('SELECT id FROM users');
            
            CommentEditor.addComment(query1, '');
            CommentEditor.addComment(query2, '   \n\t  ');
            
            const result1 = formatter.format(query1);
            const result2 = formatter.format(query2);
            
            // Verify empty comments are filtered out (intentional behavior)
            expect(result1.formattedSql).toBe('/* */ select "id" from "users"');
            expect(result1.formattedSql).toContain('/* */');
            expect(result2.formattedSql).toBe('select "id" from "users"');
            expect(result2.formattedSql).not.toContain('/*');
        });
    });
    
    describe('Multiple Comments Security', () => {
        test('should sanitize all comments in complex queries', () => {
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            CommentEditor.addComment(query, 'header */ DROP DATABASE; /*');
            CommentEditor.addComment(query.selectClause, 'select */ UNION SELECT password /*');
            CommentEditor.addComment(query.selectClause.items[0], 'item */ FROM secrets /*');
            
            const result = formatter.format(query);
            
            // Verify all comments are sanitized
            expect(result.formattedSql).not.toContain('*/ DROP');
            expect(result.formattedSql).not.toContain('*/ UNION');
            expect(result.formattedSql).not.toContain('*/ FROM secrets');
            
            // Verify sanitized versions exist
            expect(result.formattedSql).toContain('/* header *\\/ DROP DATABASE; \\/\\* */');
            expect(result.formattedSql).toContain('/* select *\\/ UNION SELECT password \\/\\* */');
            expect(result.formattedSql).toContain('/* item *\\/ FROM secrets \\/\\* */');
        });
    });

    describe('Comment Separator Line Preservation', () => {
        test('should preserve dash separator lines in block comments', () => {
            const sql = `
/*
  Header
  ----------
  Content
*/
SELECT 1 AS test
`;
            const query = SelectQueryParser.parse(sql);
            const result = formatter.format(query);

            // Verify separator line is preserved as block comment
            expect(result.formattedSql).toContain('/* Header */');
            expect(result.formattedSql).toContain('/* ---------- */');
            expect(result.formattedSql).toContain('/* Content */');

            // Verify separator line is not output as plain text
            // Remove all block comments and check if separator exists in remaining text
            const withoutBlockComments = result.formattedSql.replace(/\/\*[\s\S]*?\*\//g, '');
            expect(withoutBlockComments).not.toContain('----------');
        });

        test('should preserve different separator characters', () => {
            const sql = `
/*
  Section A
  ==========
  Section B
  __________
  Section C
  ++++++++++
  Section D
  ##########
*/
SELECT 1 AS test
`;
            const query = SelectQueryParser.parse(sql);
            const result = formatter.format(query);

            // Verify all separator types are preserved as block comments
            expect(result.formattedSql).toContain('/* ========== */');
            expect(result.formattedSql).toContain('/* __________ */');
            expect(result.formattedSql).toContain('/* ++++++++++ */');
            expect(result.formattedSql).toContain('/* ########## */');

            // Verify separators are not output as plain text
            const withoutBlockComments = result.formattedSql.replace(/\/\*[\s\S]*?\*\//g, '');
            expect(withoutBlockComments).not.toContain('==========');
            expect(withoutBlockComments).not.toContain('__________');
            expect(withoutBlockComments).not.toContain('++++++++++');
            expect(withoutBlockComments).not.toContain('##########');
        });

        test('should preserve separator lines mixed with regular content', () => {
            const sql = `
/*
  Sales Analysis Report - Q4 2023
  ================================

  Purpose: Comprehensive sales analysis
  Author: Analytics Team

  Dependencies:
  - sales table: Core transaction data
  - customers table: Master data
*/
SELECT 1 AS test
`;
            const query = SelectQueryParser.parse(sql);
            const result = formatter.format(query);

            // Verify mixed content is preserved
            expect(result.formattedSql).toContain('/* Sales Analysis Report - Q4 2023 */');
            expect(result.formattedSql).toContain('/* ================================ */');
            expect(result.formattedSql).toContain('/* Purpose: Comprehensive sales analysis */');
            expect(result.formattedSql).toContain('/* - sales table: Core transaction data */');

            // Verify separator is not plain text
            const withoutBlockComments = result.formattedSql.replace(/\/\*[\s\S]*?\*\//g, '');
            expect(withoutBlockComments).not.toContain('================================');
        });

        test('should not treat dash comments as line comments when they are separators', () => {
            const plainDashLine = '--------------------------';
            const query = SelectQueryParser.parse('SELECT 1 AS test');

            CommentEditor.addComment(query, plainDashLine);
            const result = formatter.format(query);

            // Should be treated as block comment, not line comment
            expect(result.formattedSql).toContain('/* -------------------------- */');
            // Check that the separator doesn't appear as a line comment
            const withoutBlockComments = result.formattedSql.replace(/\/\*[\s\S]*?\*\//g, '');
            expect(withoutBlockComments).not.toContain('--------------------------');
        });

        test('should distinguish between separator lines and actual line comments', () => {
            const query1 = SelectQueryParser.parse('SELECT 1 AS test');
            const query2 = SelectQueryParser.parse('SELECT 2 AS test');

            CommentEditor.addComment(query1, '-- This is a line comment');
            CommentEditor.addComment(query2, '------------------');

            const result1 = formatter.format(query1);
            const result2 = formatter.format(query2);

            // Line comment should be preserved as-is
            expect(result1.formattedSql).toContain('-- This is a line comment');

            // Separator should be converted to block comment
            expect(result2.formattedSql).toContain('/* ------------------ */');
            // Check that separator doesn't appear outside block comments
            const withoutBlockComments = result2.formattedSql.replace(/\/\*[\s\S]*?\*\//g, '');
            expect(withoutBlockComments).not.toContain('------------------');
        });

        test('should preserve separator lines in WITH clause comments', () => {
            const sql = `
WITH
/*
  Raw Sales Data Preparation
  --------------------------
  Extracts and processes core sales transactions.
*/
raw_sales AS (
    SELECT * FROM sales
)
SELECT * FROM raw_sales
`;
            const query = SelectQueryParser.parse(sql);
            const result = formatter.format(query);

            // Verify separator line in WITH clause is preserved
            expect(result.formattedSql).toContain('/* Raw Sales Data Preparation */');
            expect(result.formattedSql).toContain('/* -------------------------- */');
            expect(result.formattedSql).toContain('/* Extracts and processes core sales transactions. */');

            // Verify no plain text separator
            const withoutBlockComments = result.formattedSql.replace(/\/\*[\s\S]*?\*\//g, '');
            expect(withoutBlockComments).not.toContain('--------------------------');
        });
    });
});
