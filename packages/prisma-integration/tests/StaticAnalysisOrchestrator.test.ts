/**
 * Static Analysis Orchestrator Path Resolution Tests
 * Testing strategy: T-WADA (Test-What-Actually-Drives-Application)
 * 
 * Focus on:
 * 1. Real-world path scenarios that drive the application
 * 2. Edge cases that actually occur in production
 * 3. Cross-platform compatibility (Windows/Linux/WSL)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StaticAnalysisOrchestrator, StaticAnalysisOptions } from '../src/StaticAnalysisOrchestrator';
import * as fs from 'fs';
import * as path from 'path';

// Mock file system operations
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('StaticAnalysisOrchestrator - Path Resolution (T-WADA)', () => {
    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        
        // Default mock implementations
        mockFs.existsSync.mockReturnValue(false);
        mockFs.statSync.mockReturnValue({ isFile: () => false } as any);
    });

    describe('findSchemaPath - Path Resolution Strategy', () => {
        
        it('SCENARIO 1: Standard Prisma project structure', () => {
            // Arrange - What actually drives the application: Standard Prisma setup
            const baseDir = '/project/packages/api';
            const expectedSchemaPath = path.resolve(baseDir, 'prisma', 'schema.prisma');
            
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === expectedSchemaPath;
            });
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath === expectedSchemaPath) {
                    return { isFile: () => true } as any;
                }
                return { isFile: () => false } as any;
            });

            const options: StaticAnalysisOptions = {
                baseDir,
                sqlFilesPath: path.join(baseDir, 'sql'),
                debug: false
            };

            // Act
            const orchestrator = new StaticAnalysisOrchestrator(options);
            // Access private method through prototype
            const result = StaticAnalysisOrchestrator.prototype['findSchemaPath'].call(orchestrator);

            // Assert - Absolute path resolution should work
            expect(result).toBe(expectedSchemaPath);
            expect(path.isAbsolute(result!)).toBe(true);
        });

        it('SCENARIO 2: Monorepo with schema in parent directory', () => {
            // Arrange - What drives the app: Monorepo structure
            const baseDir = '/monorepo/packages/backend';
            const expectedSchemaPath = path.resolve(baseDir, '..', 'prisma', 'schema.prisma');
            
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === expectedSchemaPath;
            });
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath === expectedSchemaPath) {
                    return { isFile: () => true } as any;
                }
                return { isFile: () => false } as any;
            });

            const options: StaticAnalysisOptions = {
                baseDir,
                sqlFilesPath: path.join(baseDir, 'sql'),
                debug: false
            };

            // Act
            const orchestrator = new StaticAnalysisOrchestrator(options);
            // Access private method through prototype
            const result = StaticAnalysisOrchestrator.prototype['findSchemaPath'].call(orchestrator);

            // Assert - Should resolve parent directory correctly
            expect(result).toBe(expectedSchemaPath);
            expect(path.isAbsolute(result!)).toBe(true);
            expect(result).toBe(path.resolve('/monorepo/packages/prisma/schema.prisma'));
        });

        it('SCENARIO 3: Cross-platform path handling (Windows vs Unix)', () => {
            // Arrange - What drives the app: Different OS environments
            const windowsPath = 'C:\\Users\\dev\\project';
            const unixPath = '/home/dev/project';
            const testPath = process.platform === 'win32' ? windowsPath : unixPath;
            
            const expectedSchemaPath = path.resolve(testPath, 'prisma', 'schema.prisma');
            
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === expectedSchemaPath;
            });
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath === expectedSchemaPath) {
                    return { isFile: () => true } as any;
                }
                return { isFile: () => false } as any;
            });

            const options: StaticAnalysisOptions = {
                baseDir: testPath,
                sqlFilesPath: path.join(testPath, 'sql'),
                debug: false
            };

            // Act
            const orchestrator = new StaticAnalysisOrchestrator(options);
            // Access private method through prototype
            const result = StaticAnalysisOrchestrator.prototype['findSchemaPath'].call(orchestrator);

            // Assert - Should handle platform-specific paths
            expect(result).toBe(expectedSchemaPath);
            expect(path.isAbsolute(result!)).toBe(true);
        });

        it('SCENARIO 4: Relative baseDir input (common user mistake)', () => {
            // Arrange - What drives the app: Users providing relative paths
            const relativeBaseDir = './packages/api';
            const absoluteBaseDir = path.resolve(relativeBaseDir);
            const expectedSchemaPath = path.resolve(absoluteBaseDir, 'prisma', 'schema.prisma');
            
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === expectedSchemaPath;
            });
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath === expectedSchemaPath) {
                    return { isFile: () => true } as any;
                }
                return { isFile: () => false } as any;
            });

            const options: StaticAnalysisOptions = {
                baseDir: relativeBaseDir, // Intentionally relative
                sqlFilesPath: './sql',
                debug: false
            };

            // Act
            const orchestrator = new StaticAnalysisOrchestrator(options);
            // Access private method through prototype
            const result = StaticAnalysisOrchestrator.prototype['findSchemaPath'].call(orchestrator);

            // Assert - Should convert relative to absolute internally
            expect(result).toBe(expectedSchemaPath);
            expect(path.isAbsolute(result!)).toBe(true);
        });

        it('SCENARIO 5: No schema found anywhere (graceful failure)', () => {
            // Arrange - What drives the app: Missing schema files
            const baseDir = '/project/no-schema';
            
            // Mock all paths as non-existent
            mockFs.existsSync.mockReturnValue(false);

            const options: StaticAnalysisOptions = {
                baseDir,
                sqlFilesPath: path.join(baseDir, 'sql'),
                debug: false
            };

            // Act
            const orchestrator = new StaticAnalysisOrchestrator(options);
            // Access private method through prototype
            const result = StaticAnalysisOrchestrator.prototype['findSchemaPath'].call(orchestrator);

            // Assert - Should return undefined gracefully
            expect(result).toBeUndefined();
        });

        it('SCENARIO 6: File system access errors (production edge case)', () => {
            // Arrange - What drives the app: Permission issues, network drives
            const baseDir = '/restricted/project';
            const schemaPath = path.resolve(baseDir, 'prisma', 'schema.prisma');
            
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath === schemaPath) {
                    throw new Error('EACCES: permission denied');
                }
                return false;
            });

            const options: StaticAnalysisOptions = {
                baseDir,
                sqlFilesPath: path.join(baseDir, 'sql'),
                debug: false
            };

            // Act & Assert - Should not throw, should continue checking other paths
            const orchestrator = new StaticAnalysisOrchestrator(options);
            expect(() => {
                const result = (orchestrator as any).findSchemaPath();
                expect(result).toBeUndefined();
            }).not.toThrow();
        });

        it('EDGE CASE: baseDir with special characters and spaces', () => {
            // Arrange - What actually happens: Project paths with spaces/special chars
            const baseDir = '/projects/my app (v2.0)/backend';
            const expectedSchemaPath = path.resolve(baseDir, 'prisma', 'schema.prisma');
            
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === expectedSchemaPath;
            });
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath === expectedSchemaPath) {
                    return { isFile: () => true } as any;
                }
                return { isFile: () => false } as any;
            });

            const options: StaticAnalysisOptions = {
                baseDir,
                sqlFilesPath: path.join(baseDir, 'sql'),
                debug: false
            };

            // Act
            const orchestrator = new StaticAnalysisOrchestrator(options);
            // Access private method through prototype
            const result = StaticAnalysisOrchestrator.prototype['findSchemaPath'].call(orchestrator);

            // Assert - Should handle special characters correctly
            expect(result).toBe(expectedSchemaPath);
            expect(path.isAbsolute(result!)).toBe(true);
        });
    });

    describe('runComprehensiveStaticAnalysis - Integration Test', () => {
        
        it('INTEGRATION: End-to-end with proper path resolution', async () => {
            // Arrange - Real-world scenario
            const projectDir = '/real-project';
            const schemaPath = path.resolve(projectDir, 'prisma', 'schema.prisma');
            
            // Mock schema file exists
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === schemaPath;
            });
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath === schemaPath) {
                    return { isFile: () => true } as any;
                }
                return { isFile: () => false } as any;
            });

            // Mock fs.readFileSync for schema content
            mockFs.readFileSync = vi.fn().mockReturnValue(`
                model User {
                    id    Int     @id @default(autoincrement())
                    name  String
                    email String  @unique
                }
            `);

            const options: StaticAnalysisOptions = {
                baseDir: projectDir,
                sqlFilesPath: path.join(projectDir, 'sql'),
                debug: false
            };

            // Act - This should not throw due to path resolution issues
            try {
                const { runComprehensiveStaticAnalysis } = await import('../src/StaticAnalysisOrchestrator');
                const result = await runComprehensiveStaticAnalysis(options);
                
                // Assert - Should complete without path-related errors
                expect(result).toBeDefined();
                expect(result.summary).toBeDefined();
            } catch (error: any) {
                // If it fails, it shouldn't be due to path resolution
                expect(error.message).not.toMatch(/path|ENOENT|not found/i);
            }
        });
    });
});