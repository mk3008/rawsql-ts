import { describe, it, expect } from 'vitest';
import { CommentEditor } from '../../src/utils/CommentEditor';
import { SelectClause, SelectItem } from '../../src/models/Clause';
import { IdentifierString, RawString } from '../../src/models/ValueComponent';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('CommentEditor', () => {
    const formatter = new SqlFormatter({
        exportComment: true,
        keywordCase: 'upper'
    });

    describe('addComment', () => {
        it('should add comment to SelectClause', () => {
            // Arrange
            const columnName = new IdentifierString('name');
            const selectItem = new SelectItem(columnName);
            const selectClause = new SelectClause([selectItem]);

            // Act
            CommentEditor.addComment(selectClause, 'This is the main SELECT clause');

            // Assert
            expect(selectClause.getPositionedComments('before')).toEqual(['This is the main SELECT clause']);
        });

        it('should add multiple comments to SelectClause', () => {
            // Arrange
            const columnName1 = new IdentifierString('id');
            const columnName2 = new IdentifierString('name');
            const selectItem1 = new SelectItem(columnName1);
            const selectItem2 = new SelectItem(columnName2);
            const selectClause = new SelectClause([selectItem1, selectItem2]);

            // Act
            CommentEditor.addComment(selectClause, 'First comment');
            CommentEditor.addComment(selectClause, 'Second comment');

            // Assert
            expect(selectClause.getPositionedComments('before')).toEqual(['First comment', 'Second comment']);
        });

        it('should add comment to SelectClause parsed from SQL', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const selectClause = query.selectClause;

            // Act
            CommentEditor.addComment(selectClause, 'Select user information');

            // Assert
            const result = formatter.format(query);
            const expectedSql = `SELECT/* Select user information */   "id", "name" FROM "users"`;
            expect(result.formattedSql).toBe(expectedSql);
        });

        it('should add comment to SelectItem within SelectClause', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const selectClause = query.selectClause;
            const firstSelectItem = selectClause.items[0];

            // Act
            CommentEditor.addComment(firstSelectItem, 'User ID column');

            // Assert
            const result = formatter.format(query);
            const expectedSql = `SELECT /* User ID column */ "id", "name" FROM "users"`;
            expect(result.formattedSql).toBe(expectedSql);
        });

        it('should add multiple comments to different parts of SelectClause', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Act
            CommentEditor.addComment(query.selectClause, 'Main SELECT clause');
            CommentEditor.addComment(query.selectClause.items[0], 'Primary key');
            CommentEditor.addComment(query.selectClause.items[1], 'Display name');

            // Assert
            const result = formatter.format(query);
            const expectedSql = `SELECT/* Main SELECT clause */   /* Primary key */ "id", /* Display name */ "name" FROM "users" WHERE "active" = true`;
            expect(result.formattedSql).toBe(expectedSql);
        });
    });

    describe('editComment', () => {
        it('should edit existing comment on SelectClause', () => {
            // Arrange
            const sql = 'SELECT id FROM users';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            CommentEditor.addComment(query.selectClause, 'Original comment');

            // Act
            CommentEditor.editComment(query.selectClause, 0, 'Updated comment');

            // Assert
            const result = formatter.format(query);
            const expectedSql = `SELECT/* Updated comment */   "id" FROM "users"`;
            expect(result.formattedSql).toBe(expectedSql);
        });

        it('should throw error when editing non-existent comment index', () => {
            // Arrange
            const selectClause = new SelectClause([]);

            // Act & Assert
            expect(() => CommentEditor.editComment(selectClause, 0, 'New comment'))
                .toThrowError('Invalid comment index: 0. Component has 0 before positioned comments.');
        });
    });

    describe('deleteComment', () => {
        it('should delete comment from SelectClause', () => {
            // Arrange
            const sql = 'SELECT id FROM users';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            CommentEditor.addComment(query.selectClause, 'Comment to delete');

            // Act
            CommentEditor.deleteComment(query.selectClause, 0);

            // Assert
            const result = formatter.format(query);
            const expectedSql = `SELECT "id" FROM "users"`;
            expect(result.formattedSql).toBe(expectedSql);
        });

        it('should delete specific comment when multiple exist', () => {
            // Arrange
            const sql = 'SELECT id FROM users';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            CommentEditor.addComment(query.selectClause, 'First');
            CommentEditor.addComment(query.selectClause, 'Second');
            CommentEditor.addComment(query.selectClause, 'Third');

            // Act
            CommentEditor.deleteComment(query.selectClause, 1);

            // Assert
            const result = formatter.format(query);
            const expectedSql = `SELECT/* First */  /* Third */   "id" FROM "users"`;
            expect(result.formattedSql).toBe(expectedSql);
        });
    });

    describe('getComments', () => {
        it('should return empty array when no comments exist', () => {
            // Arrange
            const selectClause = new SelectClause([]);

            // Act
            const comments = CommentEditor.getComments(selectClause);

            // Assert
            expect(comments).toEqual([]);
        });

        it('should return all comments from SelectClause', () => {
            // Arrange
            const selectClause = new SelectClause([]);
            CommentEditor.addComment(selectClause, 'Comment 1');
            CommentEditor.addComment(selectClause, 'Comment 2');

            // Act
            const comments = CommentEditor.getComments(selectClause);

            // Assert
            expect(comments).toEqual(['Comment 1', 'Comment 2']);
        });
    });

    describe('findComponentsWithComment', () => {
        it('should find SelectClause with matching comment', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            CommentEditor.addComment(query.selectClause, 'Important selection');

            // Act
            const components = CommentEditor.findComponentsWithComment(query, 'Important');

            // Assert
            expect(components).toHaveLength(1);
            expect(components[0]).toBe(query.selectClause);
        });

        it('should find multiple components with matching comments', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            CommentEditor.addComment(query.selectClause, 'TODO: optimize this');
            CommentEditor.addComment(query.whereClause!, 'TODO: add index');

            // Act
            const components = CommentEditor.findComponentsWithComment(query, 'TODO');

            // Assert
            expect(components).toHaveLength(2);
            expect(components).toContainEqual(query.selectClause);
            expect(components).toContainEqual(query.whereClause);
        });

        it('should perform case-insensitive search by default', () => {
            // Arrange
            const selectClause = new SelectClause([]);
            CommentEditor.addComment(selectClause, 'UPPERCASE COMMENT');

            // Act
            const components = CommentEditor.findComponentsWithComment(selectClause, 'uppercase');

            // Assert
            expect(components).toHaveLength(1);
            expect(components[0]).toBe(selectClause);
        });
    });

    describe('countComments', () => {
        it('should count comments in complex query structure', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true ORDER BY created_at';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            CommentEditor.addComment(query.selectClause, 'Select comment');
            CommentEditor.addComment(query.whereClause!, 'Where comment 1');
            CommentEditor.addComment(query.whereClause!, 'Where comment 2');
            CommentEditor.addComment(query.orderByClause!.order[0], 'Order comment');

            // Act
            const count = CommentEditor.countComments(query);

            // Assert
            expect(count).toBe(4);
        });
    });

    describe('getAllComments', () => {
        it('should get all comments with their components from query', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            CommentEditor.addComment(query.selectClause, 'Main select');
            CommentEditor.addComment(query.selectClause.items[0], 'ID column');

            // Act
            const allComments = CommentEditor.getAllComments(query);

            // Assert
            expect(allComments).toHaveLength(2);
            expect(allComments[0]).toEqual({
                comment: 'Main select',
                component: query.selectClause,
                index: 0
            });
            expect(allComments[1]).toEqual({
                comment: 'ID column',
                component: query.selectClause.items[0],
                index: 0
            });
        });
    });
});