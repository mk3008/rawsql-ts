/**
 * Tests for JsonMappingConverter - unified JSON mapping format processor
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { JsonMappingConverter } from '../src/transformers/JsonMappingConverter';
import { EnhancedJsonMapping } from '../src/transformers/EnhancedJsonMapping';
import { ModelDrivenJsonMapping } from '../src/transformers/ModelDrivenJsonMapping';
import { JsonMapping } from '../src/transformers/PostgresJsonQueryBuilder';

describe('JsonMappingConverter', () => {
    let converter: JsonMappingConverter;

    beforeEach(() => {
        converter = new JsonMappingConverter();
    });

    describe('Format Detection', () => {
        test('should detect enhanced format correctly', () => {
            const enhancedInput: EnhancedJsonMapping = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { 
                        id: { column: 'u.id', type: 'number' }, 
                        name: { column: 'u.name', type: 'string' } 
                    }
                },
                nestedEntities: [],
                typeInfo: {
                    interface: 'User',
                    importPath: './types/User'
                }
            };

            expect(converter.detectFormat(enhancedInput)).toBe('enhanced');
        });

        test('should detect model-driven format correctly', () => {
            const modelDrivenInput: ModelDrivenJsonMapping = {
                typeInfo: {
                    interface: 'User',
                    importPath: './types/User'
                },
                structure: {
                    id: { column: 'u.id', type: 'number' },
                    name: { column: 'u.name', type: 'string' }
                }
            };

            expect(converter.detectFormat(modelDrivenInput)).toBe('model-driven');
        });

        test('should detect legacy format correctly', () => {
            const legacyInput: JsonMapping = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { id: 'u.id', name: 'u.name' }
                },
                nestedEntities: []
            };

            expect(converter.detectFormat(legacyInput)).toBe('legacy');
        });
    });

    describe('Enhanced Format Conversion', () => {
        test('should convert enhanced format with type protection', () => {
            const enhancedInput: EnhancedJsonMapping = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: {
                        id: { column: 'u.id', type: 'number' },
                        name: { column: 'u.name', type: 'string' },
                        email: 'u.email'
                    }
                },
                nestedEntities: [],
                typeInfo: {
                    interface: 'User',
                    importPath: './types/User'
                }
            };

            const result = converter.convert(enhancedInput);

            expect(result.format).toBe('enhanced');
            expect(result.mapping.rootName).toBe('user');
            expect(result.mapping.rootEntity.columns).toEqual({
                id: 'u.id',
                name: 'u.name',
                email: 'u.email'
            });
            expect(result.typeProtection.protectedStringFields).toContain('u.name');
            expect(result.metadata?.typeInfo).toEqual(enhancedInput.typeInfo);
        });

        test('should convert enhanced format with nested entities', () => {
            const enhancedInput: EnhancedJsonMapping = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { id: 'u.id', name: 'u.name' }
                },
                nestedEntities: [{
                    id: 'profile',
                    name: 'Profile',
                    parentId: 'user',
                    propertyName: 'profile',
                    relationshipType: 'object',
                    columns: {
                        bio: { column: 'p.bio', type: 'string' },
                        avatar: 'p.avatar_url'
                    }
                }]
            };

            const result = converter.convert(enhancedInput);

            expect(result.mapping.nestedEntities).toHaveLength(1);
            expect(result.mapping.nestedEntities[0].propertyName).toBe('profile');
            expect(result.mapping.nestedEntities[0].columns).toEqual({
                bio: 'p.bio',
                avatar: 'p.avatar_url'
            });
            expect(result.typeProtection.protectedStringFields).toContain('p.bio');
        });
    });

    describe('Model-Driven Format Conversion', () => {
        test('should convert simple model-driven format', () => {
            const modelDrivenInput: ModelDrivenJsonMapping = {
                typeInfo: {
                    interface: 'User',
                    importPath: './types/User'
                },
                structure: {
                    id: { column: 'u.id', type: 'number' },
                    name: { column: 'u.name', type: 'string' },
                    email: { from: 'u.email', type: 'string' }
                }
            };

            const result = converter.convert(modelDrivenInput);

            expect(result.format).toBe('model-driven');
            expect(result.mapping.rootEntity.columns).toEqual({
                id: 'u.id',
                name: 'u.name',
                email: 'u.email'
            });
            expect(result.typeProtection.protectedStringFields).toEqual(
                expect.arrayContaining(['u.name', 'u.email'])
            );
        });

        test('should convert model-driven format with nested structures', () => {
            const modelDrivenInput: ModelDrivenJsonMapping = {
                typeInfo: {
                    interface: 'UserWithProfile',
                    importPath: './types/User'
                },
                structure: {
                    id: { column: 'u.id', type: 'number' },
                    name: { column: 'u.name', type: 'string' },
                    profile: {
                        type: 'object',
                        from: 'p',
                        structure: {
                            bio: { column: 'bio', type: 'string' },
                            avatar: { column: 'avatar_url' }
                        }
                    }
                }
            };

            const result = converter.convert(modelDrivenInput);

            expect(result.mapping.nestedEntities).toHaveLength(1);
            const profileEntity = result.mapping.nestedEntities[0];
            expect(profileEntity.propertyName).toBe('profile');
            expect(profileEntity.relationshipType).toBe('object');
            expect(profileEntity.columns).toEqual({
                bio: 'bio',
                avatar: 'avatar_url'
            });
        });
    });

    describe('Legacy Format Conversion', () => {
        test('should convert legacy format without changes', () => {
            const legacyInput: JsonMapping = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { id: 'u.id', name: 'u.name' }
                },
                nestedEntities: [{
                    id: 'posts',
                    name: 'Posts',
                    parentId: 'user',
                    propertyName: 'posts',
                    relationshipType: 'array',
                    columns: { id: 'p.id', title: 'p.title' }
                }]
            };

            const result = converter.convert(legacyInput);

            expect(result.format).toBe('legacy');
            expect(result.mapping).toEqual(legacyInput);
            expect(result.typeProtection.protectedStringFields).toEqual([]);
        });
    });

    describe('Convenience Methods', () => {
        test('toLegacyMapping should return just the mapping', () => {
            const enhancedInput: EnhancedJsonMapping = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { id: 'u.id', name: 'u.name' }
                },
                nestedEntities: []
            };

            const mapping = converter.toLegacyMapping(enhancedInput);

            expect(mapping.rootName).toBe('user');
            expect(mapping.rootEntity.columns).toEqual({ id: 'u.id', name: 'u.name' });
        });

        test('getTypeProtection should return type protection config', () => {
            const enhancedInput: EnhancedJsonMapping = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: {
                        id: { column: 'u.id', type: 'number' },
                        name: { column: 'u.name', type: 'string' }
                    }
                },
                nestedEntities: []
            };

            const typeProtection = converter.getTypeProtection(enhancedInput);

            expect(typeProtection.protectedStringFields).toContain('u.name');
        });
    });

    describe('Validation', () => {
        test('should validate correct mapping', () => {
            const validInput: JsonMapping = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { id: 'u.id', name: 'u.name' }
                },
                nestedEntities: []
            };

            const errors = converter.validate(validInput);
            expect(errors).toHaveLength(0);
        });

        test('should detect validation errors', () => {
            const invalidInput = {
                rootEntity: {
                    columns: {}
                },
                nestedEntities: []
            } as any;

            const errors = converter.validate(invalidInput);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some(error => error.includes('rootName'))).toBe(true);
        });
    });

    describe('Upgrade Functionality', () => {
        test('should upgrade legacy mapping to enhanced', () => {
            const legacyInput: JsonMapping = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { id: 'u.id', name: 'u.name' }
                },
                nestedEntities: []
            };

            const typeInfo = {
                interface: 'User',
                importPath: './types/User'
            };

            const enhanced = converter.upgradeToEnhanced(legacyInput, typeInfo);

            expect(enhanced.typeInfo).toEqual(typeInfo);
            expect(enhanced.metadata?.version).toBe('1.0');
            expect(enhanced.rootEntity.columns).toEqual(legacyInput.rootEntity.columns);
        });
    });

    describe('Error Handling', () => {
        test('should throw error for unsupported format', () => {
            const unsupportedInput = { unknown: 'format' } as any;

            expect(() => converter.convert(unsupportedInput)).toThrow('Unsupported JSON mapping format');
        });
    });
});