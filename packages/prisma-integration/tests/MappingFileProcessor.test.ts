/**
 * Test for the new ModelDrivenJsonMapping integration.
 */

import { describe, it, expect } from 'vitest';
import {
    detectMappingFormat,
    loadAndConvertMappingFile,
    findAndConvertMappingFiles
} from '../src/MappingFileProcessor';
import * as path from 'path';

describe('MappingFileProcessor', () => {
    describe('detectMappingFormat', () => {
        it('should detect model-driven format', () => {
            const modelDrivenData = {
                typeInfo: {
                    interface: 'Todo',
                    importPath: 'src/contracts/todo.ts'
                },
                structure: {
                    id: { from: 'todo_id' },
                    title: { from: 'title', type: 'string' }
                }
            };

            const format = detectMappingFormat(modelDrivenData);
            expect(format).toBe('model-driven');
        });

        it('should detect unified format', () => {
            const unifiedData = {
                rootName: 'todo',
                rootEntity: {
                    id: 'todo',
                    name: 'Todo',
                    columns: {
                        id: 'todo_id',
                        title: 'title'
                    }
                }
            };

            const format = detectMappingFormat(unifiedData);
            expect(format).toBe('unified');
        });

        it('should detect legacy format', () => {
            const legacyData = {
                rootName: 'todo',
                rootEntity: {
                    name: 'Todo',
                    columns: {
                        id: 'todo_id'
                    }
                }
            };

            const format = detectMappingFormat(legacyData);
            expect(format).toBe('legacy');
        });
    });

    describe('loadAndConvertMappingFile', () => {
        it('should throw error for non-existent file', () => {
            expect(() => {
                loadAndConvertMappingFile('/path/to/nonexistent.json');
            }).toThrow('Mapping file not found');
        });
    });
});
