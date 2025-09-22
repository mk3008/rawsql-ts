import { describe, it, expect } from 'vitest';
import { SqlComponent, PositionedComment } from '../../src/models/SqlComponent';
import { SelectItem } from '../../src/models/Clause';
import { ColumnReference } from '../../src/models/ValueComponent';

// Test implementation of SqlComponent for testing
class TestSqlComponent extends SqlComponent {
    static kind = Symbol("TestSqlComponent");
}

describe('PositionedComment system', () => {
    describe('Basic PositionedComment functionality', () => {
        it('should add positioned comments correctly', () => {
            const component = new TestSqlComponent();
            
            component.addPositionedComments('before', ['comment1', 'comment2']);
            component.addPositionedComments('after', ['comment3']);
            
            expect(component.positionedComments).toHaveLength(2);
            expect(component.getPositionedComments('before')).toEqual(['comment1', 'comment2']);
            expect(component.getPositionedComments('after')).toEqual(['comment3']);
        });

        it('should merge comments for same position', () => {
            const component = new TestSqlComponent();
            
            component.addPositionedComments('before', ['comment1']);
            component.addPositionedComments('before', ['comment2', 'comment3']);
            
            expect(component.getPositionedComments('before')).toEqual(['comment1', 'comment2', 'comment3']);
        });

        it('should return empty array for non-existent position', () => {
            const component = new TestSqlComponent();
            
            expect(component.getPositionedComments('before')).toEqual([]);
            expect(component.getPositionedComments('after')).toEqual([]);
        });

        it('should get all positioned comments in order', () => {
            const component = new TestSqlComponent();
            
            component.addPositionedComments('after', ['after1', 'after2']);
            component.addPositionedComments('before', ['before1']);
            
            const allComments = component.getAllPositionedComments();
            expect(allComments).toEqual(['before1', 'after1', 'after2']);
        });

        it('should ignore empty comment arrays', () => {
            const component = new TestSqlComponent();
            
            component.addPositionedComments('before', []);
            component.addPositionedComments('after', ['valid']);
            
            expect(component.positionedComments).toHaveLength(1);
            expect(component.getPositionedComments('before')).toEqual([]);
            expect(component.getPositionedComments('after')).toEqual(['valid']);
        });
    });

    describe('SelectItem integration with positioned comments', () => {
        it('should work with SelectItem AS keyword comments', () => {
            const column = new ColumnReference(null, 'test_col');
            const selectItem = new SelectItem(column, 'alias_name');
            
            // Simulate AS keyword comment
            selectItem.addPositionedComments('after', ['as_comment']);
            
            expect(selectItem.getPositionedComments('after')).toEqual(['as_comment']);
            expect(selectItem.getAllPositionedComments()).toEqual(['as_comment']);
        });

        it('should maintain both legacy and positioned comments', () => {
            const column = new ColumnReference(null, 'test_col');
            const selectItem = new SelectItem(column, 'alias_name');
            
            // Legacy comment system
            selectItem.comments = ['legacy_comment'];
            
            // New positioned comment system
            selectItem.addPositionedComments('before', ['before_comment']);
            selectItem.addPositionedComments('after', ['after_comment']);
            
            expect(selectItem.comments).toEqual(['legacy_comment']);
            expect(selectItem.getPositionedComments('before')).toEqual(['before_comment']);
            expect(selectItem.getPositionedComments('after')).toEqual(['after_comment']);
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle null/undefined comments gracefully', () => {
            const component = new TestSqlComponent();
            
            // These should not throw errors
            component.addPositionedComments('before', null as any);
            component.addPositionedComments('after', undefined as any);
            
            expect(component.positionedComments).toBeNull();
        });

        it('should handle comments with whitespace and special characters', () => {
            const component = new TestSqlComponent();
            
            const specialComments = [
                '  whitespace  ',
                'special!@#$%^&*()chars',
                'multi\nline\ncomment',
                ''
            ];
            
            component.addPositionedComments('before', specialComments);
            
            expect(component.getPositionedComments('before')).toEqual(specialComments);
        });

        it('should maintain comment order when adding multiple times', () => {
            const component = new TestSqlComponent();
            
            component.addPositionedComments('before', ['first']);
            component.addPositionedComments('before', ['second', 'third']);
            component.addPositionedComments('before', ['fourth']);
            
            expect(component.getPositionedComments('before')).toEqual(['first', 'second', 'third', 'fourth']);
        });
    });

    describe('PositionedComment interface compliance', () => {
        it('should create valid PositionedComment structures', () => {
            const component = new TestSqlComponent();
            
            component.addPositionedComments('before', ['test']);
            
            const positionedComment: PositionedComment = component.positionedComments![0];
            expect(positionedComment.position).toBe('before');
            expect(positionedComment.comments).toEqual(['test']);
            expect(typeof positionedComment.position).toBe('string');
            expect(Array.isArray(positionedComment.comments)).toBe(true);
        });
    });
});