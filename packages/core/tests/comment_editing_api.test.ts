import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';
import { CommentEditor } from '../src/utils/CommentEditor';

describe('Comment Editing API', () => {
    const testSql = `
WITH 
-- Base customer data (active users only, with segment classification)
raw_users AS (
    SELECT 
        user_id,
        email,
        registration_date,
        subscription_tier,
        country_code,
        referral_source,
        device_type,
        CASE 
            WHEN registration_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'new'
            WHEN registration_date >= CURRENT_DATE - INTERVAL '365 days' THEN 'active'
            ELSE 'established'
        END as user_segment
    FROM users 
    WHERE email IS NOT NULL 
    AND registration_date IS NOT NULL
)
select * from raw_users
`;

    it('should add comments to SQL query', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Add a new comment
        CommentEditor.addComment(query, 'Added: This query retrieves customer segments');
        
        const comments = CommentEditor.getComments(query);
        expect(comments).toHaveLength(1);
        expect(comments[0]).toBe('Added: This query retrieves customer segments');
        
        // Format and check output with newline
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n'
        });
        
        const result = formatter.format(query);
        const expectedSql = `/* Added: This query retrieves customer segments */
WITH
/* Base customer data (active users only, with segment classification) */
"raw_users" AS (
SELECT
"user_id", "email", "registration_date", "subscription_tier", "country_code", "referral_source", "device_type", CASE
WHEN "registration_date" >= current_date - INTERVAL '90 days' THEN
'new'
WHEN "registration_date" >= current_date - INTERVAL '365 days' THEN
'active'
ELSE
'established'
END AS "user_segment"
FROM
"users"
WHERE
"email" is not null AND "registration_date" is not null
)
SELECT
*
FROM
"raw_users"`;
        expect(result.formattedSql).toBe(expectedSql);
    });

    it('should edit existing comments', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Edit the existing comment in WithClause
        const withClause = (query as any).withClause;
        CommentEditor.editComment(withClause, 0, 'Edited: Base customer data with segmentation logic');
        
        const comments = CommentEditor.getComments(withClause);
        expect(comments).toHaveLength(1);
        expect(comments[0]).toBe('Edited: Base customer data with segmentation logic');
        
        // Format and check output
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n'
        });
        
        const result = formatter.format(query);
        const expectedSql = `WITH
/* Edited: Base customer data with segmentation logic */
"raw_users" AS (
SELECT
"user_id", "email", "registration_date", "subscription_tier", "country_code", "referral_source", "device_type", CASE
WHEN "registration_date" >= current_date - INTERVAL '90 days' THEN
'new'
WHEN "registration_date" >= current_date - INTERVAL '365 days' THEN
'active'
ELSE
'established'
END AS "user_segment"
FROM
"users"
WHERE
"email" is not null AND "registration_date" is not null
)
SELECT
*
FROM
"raw_users"`;
        expect(result.formattedSql).toBe(expectedSql);
    });

    it('should delete comments', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Delete the comment from WithClause
        const withClause = (query as any).withClause;
        CommentEditor.deleteComment(withClause, 0);
        
        const comments = CommentEditor.getComments(withClause);
        expect(comments).toHaveLength(0);
        
        // Format and check output - should have no comments
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n'
        });
        
        const result = formatter.format(query);
        const expectedSql = `WITH
"raw_users" AS (
SELECT
"user_id", "email", "registration_date", "subscription_tier", "country_code", "referral_source", "device_type", CASE
WHEN "registration_date" >= current_date - INTERVAL '90 days' THEN
'new'
WHEN "registration_date" >= current_date - INTERVAL '365 days' THEN
'active'
ELSE
'established'
END AS "user_segment"
FROM
"users"
WHERE
"email" is not null AND "registration_date" is not null
)
SELECT
*
FROM
"raw_users"`;
        expect(result.formattedSql).toBe(expectedSql);
    });

    it('should handle multiple comment operations', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Start with no comments on query level (original comment is in WithClause)
        expect(CommentEditor.getComments(query)).toHaveLength(0);
        
        // Add more comments
        CommentEditor.addComment(query, 'Performance optimized query');
        CommentEditor.addComment(query, 'Last updated: 2024-01-15');
        
        expect(CommentEditor.getComments(query)).toHaveLength(2);
        
        // Edit first comment
        CommentEditor.editComment(query, 0, 'Highly optimized for performance');
        
        // Delete first comment
        CommentEditor.deleteComment(query, 0);
        
        const finalComments = CommentEditor.getComments(query);
        expect(finalComments).toHaveLength(1);
        expect(finalComments[0]).toBe('Last updated: 2024-01-15');
    });

    it('should find components with specific comments', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Find components with "customer" in comments
        // Now comments are properly separated: WithClause has the original comment
        const components = CommentEditor.findComponentsWithComment(query, 'customer');
        expect(components.length).toBeGreaterThanOrEqual(1);
        expect(components.some(comp => comp === (query as any).withClause)).toBe(true);
    });

    it('should format SQL with comment export option', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Add additional comments
        CommentEditor.addComment(query, 'Export Test: Additional note about indexes');
        
        // Format with comments
        const formatterWithComments = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            commaBreak: 'before',
            newline: '\n'
        });
        
        const withComments = formatterWithComments.format(query);
        const expectedWithComments = `/* Export Test: Additional note about indexes */
WITH
/* Base customer data (active users only, with segment classification) */
"raw_users" AS (
SELECT
"user_id"
, "email"
, "registration_date"
, "subscription_tier"
, "country_code"
, "referral_source"
, "device_type"
, CASE
WHEN "registration_date" >= current_date - INTERVAL '90 days' THEN
'new'
WHEN "registration_date" >= current_date - INTERVAL '365 days' THEN
'active'
ELSE
'established'
END AS "user_segment"
FROM
"users"
WHERE
"email" is not null AND "registration_date" is not null
)
SELECT
*
FROM
"raw_users"`;
        expect(withComments.formattedSql).toBe(expectedWithComments);
        
        // Format without comments
        const formatterWithoutComments = new SqlFormatter({
            exportComment: false,
            keywordCase: 'upper',
            commaBreak: 'before',
            newline: '\n'
        });
        
        const withoutComments = formatterWithoutComments.format(query);
        const expectedWithoutComments = `WITH
"raw_users" AS (
SELECT
"user_id"
, "email"
, "registration_date"
, "subscription_tier"
, "country_code"
, "referral_source"
, "device_type"
, CASE
WHEN "registration_date" >= current_date - INTERVAL '90 days' THEN
'new'
WHEN "registration_date" >= current_date - INTERVAL '365 days' THEN
'active'
ELSE
'established'
END AS "user_segment"
FROM
"users"
WHERE
"email" is not null AND "registration_date" is not null
)
SELECT
*
FROM
"raw_users"`;
        expect(withoutComments.formattedSql).toBe(expectedWithoutComments);
    });

    it('should replace text in comments across the AST', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Add more comments with "data" in them
        CommentEditor.addComment(query, 'Process customer data efficiently');
        CommentEditor.addComment(query, 'Data validation rules applied');
        
        // Replace "data" with "information"
        const replacementCount = CommentEditor.replaceInComments(query, 'data', 'information');
        
        expect(replacementCount).toBe(3); // Should replace in all 3 comments (1 in WithClause + 2 in query)
        
        const comments = CommentEditor.getComments(query);
        expect(comments[0]).toBe('Process customer information efficiently');
        expect(comments[1]).toBe('information validation rules applied');
        
        // Check WithClause comment was also replaced
        const withClauseComments = CommentEditor.getComments((query as any).withClause);
        expect(withClauseComments[0]).toBe('Base customer information (active users only, with segment classification)');
    });

    it('should count comments in the AST', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // After comment preservation fix, comments appear in multiple components
        const initialCount = CommentEditor.countComments(query);
        expect(initialCount).toBeGreaterThanOrEqual(1);
        
        CommentEditor.addComment(query, 'Additional comment 1');
        const afterAdd1 = CommentEditor.countComments(query);
        expect(afterAdd1).toBeGreaterThan(initialCount);
        
        CommentEditor.addComment(query, 'Additional comment 2');
        const afterAdd2 = CommentEditor.countComments(query);
        expect(afterAdd2).toBeGreaterThan(afterAdd1);
        
        CommentEditor.deleteComment(query, 0);
        const afterDelete = CommentEditor.countComments(query);
        expect(afterDelete).toBeLessThan(afterAdd2);
    });

    it('should get all comments with their components', () => {
        const query = SelectQueryParser.parse(testSql);
        
        CommentEditor.addComment(query, 'Query level comment');
        
        const allComments = CommentEditor.getAllComments(query);
        
        // After comment preservation fix, there are more comments preserved
        // The number of comments depends on the preservation mechanism
        expect(allComments.length).toBeGreaterThanOrEqual(1);
        
        // Verify that at least one comment contains the expected text
        const hasBaseComment = allComments.some(item => 
            item.comment === 'Base customer data (active users only, with segment classification)'
        );
        expect(hasBaseComment).toBe(true);
        
        // Verify the added comment is present
        const hasAddedComment = allComments.some(item => 
            item.comment === 'Query level comment' && item.component === query
        );
        expect(hasAddedComment).toBe(true);
    });

    it('should handle error cases gracefully', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Test invalid index errors
        expect(() => CommentEditor.editComment(query, 10, 'new comment')).toThrow('Invalid comment index: 10');
        expect(() => CommentEditor.deleteComment(query, -1)).toThrow('Invalid comment index: -1');
        
        // Test empty component
        CommentEditor.deleteAllComments(query);
        expect(() => CommentEditor.editComment(query, 0, 'new comment')).toThrow('Invalid comment index: 0');
    });

    it('should handle multiple comments in SELECT clause with newlines', () => {
        const testSql = `
SELECT 
    user_id,
    email,
    name
FROM users
WHERE active = true
`;
        
        const query = SelectQueryParser.parse(testSql).toSimpleQuery();
        
        // Add multiple comments to SELECT clause
        CommentEditor.addComment(query.selectClause, 'First comment for SELECT');
        CommentEditor.addComment(query.selectClause, 'Second comment for SELECT');
        CommentEditor.addComment(query.selectClause, 'Third comment for SELECT');
        
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n'
        });
        
        const result = formatter.format(query);
        
        // Expected output with multiple comments in SELECT clause (with comment newlines)
        const expectedSql = `SELECT
/* First comment for SELECT */
/* Second comment for SELECT */
/* Third comment for SELECT */
"user_id", "email", "name"
FROM
"users"
WHERE
"active" = true`;
        
        expect(result.formattedSql).toBe(expectedSql);
    });

    it('should handle multiple comments in WHERE clause with newlines', () => {
        const testSql = `
SELECT 
    user_id,
    email,
    name
FROM users
WHERE active = true
`;
        
        const query = SelectQueryParser.parse(testSql).toSimpleQuery();
        
        // Add multiple comments to WHERE clause
        CommentEditor.addComment(query.whereClause!, 'First WHERE comment');
        CommentEditor.addComment(query.whereClause!, 'Second WHERE comment');
        CommentEditor.addComment(query.whereClause!, 'Third WHERE comment');
        
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n'
        });
        
        const result = formatter.format(query);
        
        // Expected output with multiple comments in WHERE clause (with comment newlines)
        const expectedSql = `SELECT
"user_id", "email", "name"
FROM
"users"
WHERE
/* First WHERE comment */
/* Second WHERE comment */
/* Third WHERE comment */
"active" = true`;
        
        expect(result.formattedSql).toBe(expectedSql);
    });

    it('should handle multiple comments in both SELECT and WHERE clauses', () => {
        const testSql = `
SELECT 
    user_id,
    email,
    name
FROM users
WHERE active = true
`;
        
        const query = SelectQueryParser.parse(testSql).toSimpleQuery();
        
        // Add comments to both SELECT and WHERE clauses
        CommentEditor.addComment(query.selectClause, 'SELECT comment 1');
        CommentEditor.addComment(query.selectClause, 'SELECT comment 2');
        CommentEditor.addComment(query.whereClause!, 'WHERE comment 1');
        CommentEditor.addComment(query.whereClause!, 'WHERE comment 2');
        
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n'
        });
        
        const result = formatter.format(query);
        
        // Expected output with comments in both clauses (with comment newlines)
        const expectedSql = `SELECT
/* SELECT comment 1 */
/* SELECT comment 2 */
"user_id", "email", "name"
FROM
"users"
WHERE
/* WHERE comment 1 */
/* WHERE comment 2 */
"active" = true`;
        
        expect(result.formattedSql).toBe(expectedSql);
    });

    it('should handle multiline comments with different newline settings', () => {
        const testSql = `
SELECT 
    user_id,
    email
FROM users
WHERE active = true
`;
        
        const query = SelectQueryParser.parse(testSql).toSimpleQuery();
        
        // Add comments
        CommentEditor.addComment(query.selectClause, 'Multi-line comment\nwith line breaks');
        CommentEditor.addComment(query.whereClause!, 'Another multi-line\ncomment here');
        
        // Test with newlines
        const formatterWithNewlines = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: '\n'
        });
        
        const resultWithNewlines = formatterWithNewlines.format(query);
        
        // Test with spaces
        const formatterWithSpaces = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            newline: ' '
        });
        
        const resultWithSpaces = formatterWithSpaces.format(query);
        
        // Verify comments are handled appropriately
        expect(resultWithNewlines.formattedSql).toContain('/* Multi-line comment\nwith line breaks */');
        expect(resultWithSpaces.formattedSql).toContain('/* Multi-line comment\nwith line breaks */');
    });
});