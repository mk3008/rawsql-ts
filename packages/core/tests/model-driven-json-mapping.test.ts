/**
 * Test file for ModelDrivenJsonMapping conversion functionality.
 */

import { describe, it, expect } from 'vitest';
import {
    ModelDrivenJsonMapping,
    convertModelDrivenMapping,
    validateModelDrivenMapping
} from '../src/transformers/ModelDrivenJsonMapping';

describe('ModelDrivenJsonMapping', () => {
    describe('convertModelDrivenMapping', () => {
        it('should convert simple structure to traditional JsonMapping', () => {
            const modelMapping: ModelDrivenJsonMapping = {
                typeInfo: {
                    interface: 'Todo',
                    importPath: 'src/contracts/todo.ts'
                },
                structure: {
                    id: { from: 'todo_id' },
                    title: { from: 'title', type: 'string' },
                    completed: { from: 'completed' }
                }
            };

            const result = convertModelDrivenMapping(modelMapping);

            expect(result.jsonMapping.rootEntity.columns).toEqual({
                id: 'todo_id',
                title: 'title',
                completed: 'completed'
            });

            expect(result.typeProtection.protectedStringFields).toContain('title');
        });

        it('should convert nested object structure', () => {
            const modelMapping: ModelDrivenJsonMapping = {
                typeInfo: {
                    interface: 'TodoWithUser',
                    importPath: 'src/contracts/todo-with-user.ts'
                },
                structure: {
                    id: { from: 'todo_id' },
                    title: { from: 'title', type: 'string' },
                    user: {
                        type: 'object',
                        from: 'u',
                        structure: {
                            userId: { from: 'user_id' },
                            userName: { from: 'user_name', type: 'string' }
                        }
                    }
                }
            };

            const result = convertModelDrivenMapping(modelMapping);

            // Check root entity
            expect(result.jsonMapping.rootEntity.columns).toEqual({
                id: 'todo_id',
                title: 'title'
            });

            // Check nested entity
            expect(result.jsonMapping.nestedEntities).toHaveLength(1);
            const userEntity = result.jsonMapping.nestedEntities![0];
            expect(userEntity.propertyName).toBe('user');
            expect(userEntity.relationshipType).toBe('object');
            expect(userEntity.columns).toEqual({
                userId: 'user_id',
                userName: 'user_name'
            });

            // Check type protection
            expect(result.typeProtection.protectedStringFields).toEqual(
                expect.arrayContaining(['title', 'user_name'])
            );
        });

        it('should convert nested array structure', () => {
            const modelMapping: ModelDrivenJsonMapping = {
                typeInfo: {
                    interface: 'TodoWithComments',
                    importPath: 'src/contracts/todo-with-comments.ts'
                },
                structure: {
                    id: { from: 'todo_id' },
                    comments: {
                        type: 'array',
                        from: 'c',
                        structure: {
                            commentId: { from: 'comment_id' },
                            text: { from: 'comment_text', type: 'string' }
                        }
                    }
                }
            };

            const result = convertModelDrivenMapping(modelMapping);

            expect(result.jsonMapping.nestedEntities).toHaveLength(1);
            const commentsEntity = result.jsonMapping.nestedEntities![0];
            expect(commentsEntity.propertyName).toBe('comments');
            expect(commentsEntity.relationshipType).toBe('array');
        });

        it('should handle deeply nested structures', () => {
            const modelMapping: ModelDrivenJsonMapping = {
                typeInfo: {
                    interface: 'TodoWithNestedComments',
                    importPath: 'src/contracts/todo-with-nested-comments.ts'
                },
                structure: {
                    id: { from: 'todo_id' },
                    comments: {
                        type: 'array',
                        from: 'c',
                        structure: {
                            commentId: { from: 'comment_id' },
                            text: { from: 'comment_text', type: 'string' },
                            user: {
                                type: 'object',
                                from: 'cu',
                                structure: {
                                    userId: { from: 'comment_user_id' },
                                    userName: { from: 'comment_user_name', type: 'string' }
                                }
                            }
                        }
                    }
                }
            };

            const result = convertModelDrivenMapping(modelMapping);

            // Should have 2 nested entities: comments and comment.user
            expect(result.jsonMapping.nestedEntities).toHaveLength(2);

            const commentsEntity = result.jsonMapping.nestedEntities!.find(e => e.propertyName === 'comments');
            const userEntity = result.jsonMapping.nestedEntities!.find(e => e.propertyName === 'user');

            expect(commentsEntity).toBeDefined();
            expect(userEntity).toBeDefined();
            expect(userEntity!.parentId).toBe(commentsEntity!.id);
        });
    });

    describe('validateModelDrivenMapping', () => {
        it('should validate required fields', () => {
            const invalidMapping = {} as ModelDrivenJsonMapping;
            const errors = validateModelDrivenMapping(invalidMapping);

            expect(errors).toContain('typeInfo is required');
            expect(errors).toContain('structure is required and must be an object');
        });

        it('should validate typeInfo fields', () => {
            const invalidMapping: ModelDrivenJsonMapping = {
                typeInfo: {
                    interface: '',
                    importPath: ''
                },
                structure: {}
            };

            const errors = validateModelDrivenMapping(invalidMapping);
            expect(errors).toContain('typeInfo.interface is required');
            expect(errors).toContain('typeInfo.importPath is required');
        });

        it('should pass validation for valid mapping', () => {
            const validMapping: ModelDrivenJsonMapping = {
                typeInfo: {
                    interface: 'Todo',
                    importPath: 'src/contracts/todo.ts'
                },
                structure: {
                    id: { from: 'todo_id' }
                }
            };

            const errors = validateModelDrivenMapping(validMapping);
            expect(errors).toHaveLength(0);
        });
    });
});
