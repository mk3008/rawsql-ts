import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { CommentEditor } from '../../src/utils/CommentEditor';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

describe('Comment Security and Sanitization', () => {
    const formatter = new SqlFormatter({ exportComment: true });

    describe('SQL Injection Prevention', () => {
        test.skip('should prevent comment injection with */ sequences', () => {
            const query = SelectQueryParser.parse('SELECT id FROM users');
            const maliciousComment = 'malicious */ DROP TABLE users; /*';
            
            CommentEditor.addComment(query, maliciousComment);
            const result = formatter.format(query);
            
            // Verify that */ sequences are sanitized
            expect(result.formattedSql).not.toContain('*/ DROP');
            expect(result.formattedSql).toContain('/* malicious * DROP TABLE users; * */');
            
            // Verify comment is contained within block
            const commentStartIndex = result.formattedSql.indexOf('/* malicious');
            const commentEndIndex = result.formattedSql.indexOf(' */ select');
            expect(commentStartIndex).toBeLessThan(commentEndIndex);
        });

        test.skip('should prevent nested comment attacks', () => {
            const query = SelectQueryParser.parse('SELECT id FROM users');
            const nestedComment = '/* nested comment attack */';
            
            CommentEditor.addComment(query, nestedComment);
            const result = formatter.format(query);
            
            // Verify nested comments are sanitized
            expect(result.formattedSql).toContain('/* * nested comment attack * */');
            expect(result.formattedSql).not.toContain('/* /* nested');
        });

        test.skip('should sanitize multiple dangerous sequences', () => {
            const query = SelectQueryParser.parse('SELECT id FROM users');
            const complexAttack = 'test */ SELECT password FROM secrets; /* more */ DROP TABLE important; /*';
            
            CommentEditor.addComment(query, complexAttack);
            const result = formatter.format(query);
            
            // Verify all dangerous sequences are removed
            expect(result.formattedSql).not.toContain('*/ SELECT');
            expect(result.formattedSql).not.toContain('/* more');
            expect(result.formattedSql).not.toContain('*/ DROP');
            
            // Verify sanitized version is safe
            expect(result.formattedSql).toContain('/* test * SELECT password FROM secrets; * more * DROP TABLE important; * */');
        });

        test.skip('should handle newlines in comments', () => {
            const query = SelectQueryParser.parse('SELECT id FROM users');
            const multilineComment = 'First line\nSecond line\r\nThird line';
            
            CommentEditor.addComment(query, multilineComment);
            const result = formatter.format(query);
            
            // Verify newlines are converted to spaces
            expect(result.formattedSql).toContain('/* First line Second line Third line */');
            expect(result.formattedSql).not.toContain('\n');
            expect(result.formattedSql).not.toContain('\r');
        });

        test.skip('should preserve safe comment content', () => {
            const query = SelectQueryParser.parse('SELECT id FROM users');
            const safeComment = 'This is a safe comment with numbers 123 and symbols !@#$%^&*()';
            
            CommentEditor.addComment(query, safeComment);
            const result = formatter.format(query);
            
            // Verify safe content is preserved
            expect(result.formattedSql).toContain(`/* ${safeComment} */`);
        });

        test.skip('should handle empty and whitespace-only comments', () => {
            const query1 = SelectQueryParser.parse('SELECT id FROM users');
            const query2 = SelectQueryParser.parse('SELECT id FROM users');
            
            CommentEditor.addComment(query1, '');
            CommentEditor.addComment(query2, '   \n\t  ');
            
            const result1 = formatter.format(query1);
            const result2 = formatter.format(query2);
            
            // Verify empty comments are filtered out (intentional behavior)
            expect(result1.formattedSql).not.toContain('/*');
            expect(result2.formattedSql).not.toContain('/*');
            expect(result1.formattedSql).toBe('select "id" from "users"');
            expect(result2.formattedSql).toBe('select "id" from "users"');
        });
    });
    
    describe('Multiple Comments Security', () => {
        test.skip('should sanitize all comments in complex queries', () => {
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
            expect(result.formattedSql).toContain('header * DROP DATABASE; *');
            expect(result.formattedSql).toContain('select * UNION SELECT password *');
            expect(result.formattedSql).toContain('item * FROM secrets *');
        });
    });
});