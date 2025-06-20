/**
 * Tests for JsonMappingUnifier - unified JSON mapping format processor
 */

import { describe, test, expect } from 'vitest';
import {
    processJsonMapping,
    unifyJsonMapping,
    isModelDrivenFormat,
    isUnifiedFormat,
    isLegacyFormat
} from '../src/transformers/JsonMappingUnifier';

describe('JsonMappingUnifier', () => {
    describe('Format Detection', () => {
        test('should detect model-driven format correctly', () => {
            const modelDrivenInput = {
                typeInfo: {
                    interface: 'User',
                    importPath: './types/User'
                },
                structure: {
                    id: { column: 'u.id', type: 'number' },
                    name: { column: 'u.name', type: 'string' }
                }
            };

            expect(isModelDrivenFormat(modelDrivenInput)).toBe(true);
            expect(isUnifiedFormat(modelDrivenInput)).toBe(false);
            expect(isLegacyFormat(modelDrivenInput)).toBe(false);
        });

        test('should detect unified format correctly', () => {
            const unifiedInput = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { id: 'u.id', name: 'u.name' }
                },
                nestedEntities: []
            };

            expect(isModelDrivenFormat(unifiedInput)).toBe(false);
            expect(isUnifiedFormat(unifiedInput)).toBe(true);
            expect(isLegacyFormat(unifiedInput)).toBe(false);
        });

        test('should detect legacy format correctly', () => {
            const legacyInput = {
                columns: { id: 'u.id', name: 'u.name' },
                relationships: {
                    posts: {
                        type: 'hasMany',
                        columns: { id: 'p.id', title: 'p.title' }
                    }
                }
            };

            expect(isModelDrivenFormat(legacyInput)).toBe(false);
            expect(isUnifiedFormat(legacyInput)).toBe(false);
            expect(isLegacyFormat(legacyInput)).toBe(true);
        });
    });

    describe('Model-Driven Format Processing', () => {
        test('should process simple model-driven format', () => {
            const input = {
                typeInfo: {
                    interface: 'User',
                    importPath: './types/User'
                },
                structure: {
                    id: { column: 'u.id', type: 'number' },
                    name: { column: 'u.name', type: 'string' },
                    email: { column: 'u.email', type: 'string' }
                }
            };

            const result = processJsonMapping(input);

            expect(result.format).toBe('model-driven');
            expect(result.jsonMapping.rootName).toBe('root');
            expect(result.jsonMapping.rootEntity.columns).toEqual({
                id: 'u.id',
                name: 'u.name',
                email: 'u.email'
            });
            expect(result.jsonMapping.nestedEntities).toEqual([]);
            expect(result.metadata?.typeInfo).toEqual(input.typeInfo);
        });

        test('should process model-driven format with nested objects', () => {
            const input = {
                typeInfo: {
                    interface: 'UserWithProfile',
                    importPath: './types/User'
                },
                structure: {
                    id: { column: 'u.id', type: 'number' },
                    name: { column: 'u.name', type: 'string' },
                    profile: {
                        type: 'object',
                        structure: {
                            bio: { column: 'p.bio', type: 'string' },
                            avatar: { column: 'p.avatar_url', type: 'string' }
                        }
                    }
                }
            };

            const result = processJsonMapping(input);

            expect(result.format).toBe('model-driven');
            expect(result.jsonMapping.nestedEntities).toHaveLength(1);
            expect(result.jsonMapping.nestedEntities[0].propertyName).toBe('profile');
            expect(result.jsonMapping.nestedEntities[0].relationshipType).toBe('object');
            expect(result.jsonMapping.nestedEntities[0].columns).toEqual({
                bio: 'p.bio',
                avatar: 'p.avatar_url'
            });
        });

        test('should process model-driven format with arrays', () => {
            const input = {
                typeInfo: {
                    interface: 'UserWithPosts',
                    importPath: './types/User'
                },
                structure: {
                    id: { column: 'u.id', type: 'number' },
                    name: { column: 'u.name', type: 'string' },
                    posts: {
                        type: 'array',
                        structure: {
                            id: { column: 'p.id', type: 'number' },
                            title: { column: 'p.title', type: 'string' }
                        }
                    }
                }
            };

            const result = processJsonMapping(input);

            expect(result.format).toBe('model-driven');
            expect(result.jsonMapping.nestedEntities).toHaveLength(1);
            expect(result.jsonMapping.nestedEntities[0].propertyName).toBe('posts');
            expect(result.jsonMapping.nestedEntities[0].relationshipType).toBe('array');
            expect(result.jsonMapping.nestedEntities[0].columns).toEqual({
                id: 'p.id',
                title: 'p.title'
            });
        });
    });

    describe('Unified Format Processing', () => {
        test('should process unified format correctly', () => {
            const input = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { id: 'u.id', name: 'u.name' }
                },
                nestedEntities: [
                    {
                        id: 'posts',
                        name: 'Posts',
                        parentId: 'user',
                        propertyName: 'posts',
                        relationshipType: 'array',
                        columns: { id: 'p.id', title: 'p.title' }
                    }
                ]
            };

            const result = processJsonMapping(input);

            expect(result.format).toBe('unified');
            expect(result.jsonMapping.rootName).toBe('user');
            expect(result.jsonMapping.rootEntity.columns).toEqual({
                id: 'u.id',
                name: 'u.name'
            });
            expect(result.jsonMapping.nestedEntities).toHaveLength(1);
            expect(result.jsonMapping.nestedEntities[0].propertyName).toBe('posts');
        });
    });

    describe('Legacy Format Processing', () => {
        test('should process legacy format correctly', () => {
            const input = {
                columns: { id: 'u.id', name: 'u.name' },
                relationships: {
                    posts: {
                        type: 'hasMany',
                        columns: { id: 'p.id', title: 'p.title' }
                    },
                    profile: {
                        type: 'hasOne',
                        columns: { bio: 'pr.bio', avatar: 'pr.avatar_url' }
                    }
                }
            };

            const result = processJsonMapping(input);

            expect(result.format).toBe('legacy');
            expect(result.jsonMapping.rootName).toBe('root');
            expect(result.jsonMapping.rootEntity.columns).toEqual({
                id: 'u.id',
                name: 'u.name'
            });
            expect(result.jsonMapping.nestedEntities).toHaveLength(2);

            const postsEntity = result.jsonMapping.nestedEntities.find(e => e.propertyName === 'posts');
            expect(postsEntity?.relationshipType).toBe('array');
            expect(postsEntity?.columns).toEqual({ id: 'p.id', title: 'p.title' });

            const profileEntity = result.jsonMapping.nestedEntities.find(e => e.propertyName === 'profile');
            expect(profileEntity?.relationshipType).toBe('object');
            expect(profileEntity?.columns).toEqual({ bio: 'pr.bio', avatar: 'pr.avatar_url' });
        });
    });

    describe('Convenience Functions', () => {
        test('unifyJsonMapping should return JsonMapping directly', () => {
            const input = {
                columns: { id: 'u.id', name: 'u.name' },
                relationships: {}
            };

            const result = unifyJsonMapping(input);

            expect(result.rootName).toBe('root');
            expect(result.rootEntity.columns).toEqual({
                id: 'u.id',
                name: 'u.name'
            });
            expect(result.nestedEntities).toEqual([]);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid model-driven format', () => {
            const invalidInput = {
                typeInfo: {
                    interface: 'User',
                    importPath: './types/User'
                }
                // Missing structure
            };

            expect(() => processJsonMapping(invalidInput)).toThrow();
        });

        test('should handle invalid unified format', () => {
            const invalidInput = {
                rootName: 'user'
                // Missing rootEntity
            };

            expect(() => processJsonMapping(invalidInput)).toThrow();
        });

        test('should handle empty input', () => {
            const emptyInput = {};

            expect(() => processJsonMapping(emptyInput)).toThrow();
        });
    });
});
