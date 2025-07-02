import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AutoTypeCompatibilityValidator } from '../src/AutoTypeCompatibilityValidator';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('AutoTypeCompatibilityValidator - Path Resolution Fix', () => {
    let tempDir: string;
    
    beforeEach(() => {
        // Create unique temporary directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rawsql-prisma-test-'));
    });
    
    afterEach(() => {
        // Clean up after each test
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('resolveInterfacePath', () => {
        it('should handle redundant directory prefixes in import paths', () => {
            // Create test directory structure
            const testBaseDir = path.join(tempDir, 'static-analysis');
            const testFilePath = path.join(testBaseDir, 'src', 'contracts', 'user.ts');
            
            // Create directories and file
            fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
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
        });

        it('should handle normal relative paths correctly', () => {
            // Create test directory structure
            const testBaseDir = tempDir;
            const testFilePath = path.join(testBaseDir, 'src', 'models', 'product.ts');
            
            // Create directories and file
            fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
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
        });

        it('should handle absolute paths without modification', () => {
            const validator = new AutoTypeCompatibilityValidator({
                baseDir: '/some/base/dir'
            });

            const absolutePath = '/absolute/path/to/file.ts';
            const resolved = (validator as any).resolveInterfacePath(absolutePath);
            
            expect(resolved).toBe(absolutePath);
        });

        it('should fallback to standard resolution when no redundant prefix is found', () => {
            // Create test directory structure
            const testBaseDir = path.join(tempDir, 'project');
            const testFilePath = path.join(testBaseDir, 'types', 'common.ts');
            
            // Create directories and file
            fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
            fs.writeFileSync(testFilePath, `
                export interface Common {
                    value: string;
                }
            `);

            const validator = new AutoTypeCompatibilityValidator({
                baseDir: testBaseDir
            });

            // Test with path that doesn't contain redundant prefix
            const normalPath = 'types/common.ts';
            const resolved = (validator as any).resolveInterfacePath(normalPath);
            
            expect(resolved).toBe(testFilePath);
        });
    });
});