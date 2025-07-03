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
        CommentEditor.addComment(query, 'This query retrieves customer segments');
        
        const comments = CommentEditor.getComments(query);
        expect(comments).toHaveLength(2);
        expect(comments[0]).toBe('Base customer data (active users only, with segment classification)');
        expect(comments[1]).toBe('This query retrieves customer segments');
        
        // Format and check output
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper'
        });
        
        const result = formatter.format(query);
        expect(result.formattedSql).toContain('/* Base customer data (active users only, with segment classification) */');
        expect(result.formattedSql).toContain('/* This query retrieves customer segments */');
    });

    it('should edit existing comments', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Edit the existing comment
        CommentEditor.editComment(query, 0, 'Base customer data with segmentation logic');
        
        const comments = CommentEditor.getComments(query);
        expect(comments).toHaveLength(1);
        expect(comments[0]).toBe('Base customer data with segmentation logic');
        
        // Format and check output
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper'
        });
        
        const result = formatter.format(query);
        expect(result.formattedSql).toContain('/* Base customer data with segmentation logic */');
        expect(result.formattedSql).not.toContain('Base customer data (active users only, with segment classification)');
    });

    it('should delete comments', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Delete the comment
        CommentEditor.deleteComment(query, 0);
        
        const comments = CommentEditor.getComments(query);
        expect(comments).toHaveLength(0);
        
        // Format and check output - should have no comments
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper'
        });
        
        const result = formatter.format(query);
        expect(result.formattedSql).not.toContain('/*');
    });

    it('should handle multiple comment operations', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Start with original comment
        expect(CommentEditor.getComments(query)).toHaveLength(1);
        
        // Add more comments
        CommentEditor.addComment(query, 'Performance optimized query');
        CommentEditor.addComment(query, 'Last updated: 2024-01-15');
        
        expect(CommentEditor.getComments(query)).toHaveLength(3);
        
        // Edit middle comment
        CommentEditor.editComment(query, 1, 'Highly optimized for performance');
        
        // Delete first comment
        CommentEditor.deleteComment(query, 0);
        
        const finalComments = CommentEditor.getComments(query);
        expect(finalComments).toHaveLength(2);
        expect(finalComments[0]).toBe('Highly optimized for performance');
        expect(finalComments[1]).toBe('Last updated: 2024-01-15');
    });

    it('should find components with specific comments', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Find components with "customer" in comments
        // After comment preservation fix, the same comment appears in multiple components (main query and WITH clause)
        const components = CommentEditor.findComponentsWithComment(query, 'customer');
        expect(components.length).toBeGreaterThanOrEqual(1);
        expect(components.some(comp => comp === query)).toBe(true);
    });

    it('should format SQL with comment export option', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Add additional comments
        CommentEditor.addComment(query, 'Additional note: Check indexes');
        
        // Format with comments
        const formatterWithComments = new SqlFormatter({
            exportComment: true,
            keywordCase: 'upper',
            commaBreak: 'before'
        });
        
        const withComments = formatterWithComments.format(query);
        expect(withComments.formattedSql).toContain('/* Base customer data (active users only, with segment classification) */');
        expect(withComments.formattedSql).toContain('/* Additional note: Check indexes */');
        
        // Format without comments
        const formatterWithoutComments = new SqlFormatter({
            exportComment: false,
            keywordCase: 'upper',
            commaBreak: 'before'
        });
        
        const withoutComments = formatterWithoutComments.format(query);
        expect(withoutComments.formattedSql).not.toContain('/*');
    });

    it('should replace text in comments across the AST', () => {
        const query = SelectQueryParser.parse(testSql);
        
        // Add more comments with "data" in them
        CommentEditor.addComment(query, 'Process customer data efficiently');
        CommentEditor.addComment(query, 'Data validation rules applied');
        
        // Replace "data" with "information"
        const replacementCount = CommentEditor.replaceInComments(query, 'data', 'information');
        
        expect(replacementCount).toBe(3); // Should replace in all 3 comments
        
        const comments = CommentEditor.getComments(query);
        expect(comments[0]).toBe('Base customer information (active users only, with segment classification)');
        expect(comments[1]).toBe('Process customer information efficiently');
        expect(comments[2]).toBe('information validation rules applied');
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
});