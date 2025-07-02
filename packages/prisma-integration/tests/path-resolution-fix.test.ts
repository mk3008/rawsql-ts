import { describe, it, expect, beforeEach } from 'vitest';
import { AutoTypeCompatibilityValidator } from '../src/AutoTypeCompatibilityValidator';
import * as path from 'path';
import * as fs from 'fs';

describe('AutoTypeCompatibilityValidator - Path Resolution Fix', () => {
    describe('resolveInterfacePath', () => {
        it('should handle redundant directory prefixes in import paths', () => {
            // Create test directory structure
            const testBaseDir = '/tmp/test-project/static-analysis';
            const testFilePath = '/tmp/test-project/static-analysis/src/contracts/user.ts';
            
            // Create directories if they don't exist
            fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
            
            // Create test file
            fs.writeFileSync(testFilePath, `
                export interface User {
                    id: number;
                    name: string;
                }
            `);

            const validator = new AutoTypeCompatibilityValidator({
                baseDir: testBaseDir,
                debug: true
            });

            // Test with redundant prefix
            const redundantPath = 'static-analysis/src/contracts/user.ts';
            const resolved = (validator as any).resolveInterfacePath(redundantPath);
            
            // Should resolve to the correct path without duplication
            expect(resolved).toBe(testFilePath);
            
            // Clean up
            fs.rmSync('/tmp/test-project', { recursive: true, force: true });
        });

        it('should handle normal relative paths correctly', () => {
            // Create test directory structure
            const testBaseDir = '/tmp/test-project';
            const testFilePath = '/tmp/test-project/src/models/product.ts';
            
            // Create directories if they don't exist
            fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
            
            // Create test file
            fs.writeFileSync(testFilePath, `
                export interface Product {
                    id: number;
                    title: string;
                }
            `);

            const validator = new AutoTypeCompatibilityValidator({
                baseDir: testBaseDir,
                debug: false
            });

            // Test with normal relative path
            const normalPath = 'src/models/product.ts';
            const resolved = (validator as any).resolveInterfacePath(normalPath);
            
            expect(resolved).toBe(testFilePath);
            
            // Clean up
            fs.rmSync('/tmp/test-project', { recursive: true, force: true });
        });

        it('should handle absolute paths without modification', () => {
            const validator = new AutoTypeCompatibilityValidator({
                baseDir: '/some/base/dir'
            });

            const absolutePath = '/absolute/path/to/file.ts';
            const resolved = (validator as any).resolveInterfacePath(absolutePath);
            
            expect(resolved).toBe(absolutePath);
        });
    });
});