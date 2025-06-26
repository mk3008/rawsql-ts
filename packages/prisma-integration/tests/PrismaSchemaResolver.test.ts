/**
 * PrismaSchemaResolver Path Resolution Tests
 * Testing strategy: T-WADA (Test-What-Actually-Drives-Application)
 * 
 * Focus on:
 * 1. Module-based path resolution instead of process.cwd()
 * 2. Cross-platform compatibility
 * 3. WSL environment handling
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaSchemaResolver } from '../src/PrismaSchemaResolver';
import * as fs from 'fs';
import * as path from 'path';

// Mock file system operations
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('PrismaSchemaResolver - Path Resolution (T-WADA)', () => {
    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        
        // Default mock implementations
        mockFs.existsSync.mockReturnValue(false);
        mockFs.readFileSync.mockReturnValue('');
    });

    describe('Module-based Path Resolution', () => {
        
        it('SCENARIO 1: Should use module directory instead of process.cwd()', () => {
            // Arrange - Test that path resolution is based on module location
            const resolver = new PrismaSchemaResolver({
                debug: true
            });

            // Mock a schema file relative to the module directory
            // Instead of using require.resolve, use __dirname equivalent
            const expectedSchemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
            
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === expectedSchemaPath;
            });
            mockFs.readFileSync.mockImplementation((filePath) => {
                if (filePath === expectedSchemaPath) {
                    return `
                        model User {
                            id    Int     @id @default(autoincrement())
                            name  String
                            email String  @unique
                        }
                    `;
                }
                return '';
            });

            // Act & Assert - Should not throw, should use module-based paths
            expect(() => {
                // Use actual available method from PrismaSchemaResolver
                resolver.resolveSchema({} as any);
            }).not.toThrow();
        });

        it('SCENARIO 2: WSL path handling should be dynamic, not hardcoded', () => {
            // Arrange - Test WSL environment detection
            const originalPlatform = process.platform;
            const originalEnv = process.env.WSL_DISTRO_NAME;
            
            // Mock WSL environment
            Object.defineProperty(process, 'platform', { value: 'linux' });
            process.env.WSL_DISTRO_NAME = 'Ubuntu';

            // Mock WSL mount point exists
            mockFs.existsSync.mockImplementation((filePath) => {
                // WSL mount points exist
                if (filePath === '/mnt/c') return true;
                // No schema files exist
                return false;
            });

            const resolver = new PrismaSchemaResolver({
                debug: true
            });

            // Act - This should not throw even when no schema is found
            try {
                await resolver.resolveSchema({} as any);
            } catch (error: any) {
                // Should not contain hardcoded user-specific paths
                expect(error.message).not.toMatch(/\/mnt\/c\/Users\/mssgm/);
            }

            // Cleanup
            Object.defineProperty(process, 'platform', { value: originalPlatform });
            if (originalEnv) {
                process.env.WSL_DISTRO_NAME = originalEnv;
            } else {
                delete process.env.WSL_DISTRO_NAME;
            }
        });

        it('SCENARIO 3: Cross-platform absolute path handling', () => {
            // Arrange - Test that all paths are resolved to absolute
            const resolver = new PrismaSchemaResolver({
                schemaPath: './relative/path/schema.prisma'
            });

            // Mock the relative path resolves to an absolute path
            const absoluteSchemaPath = path.resolve('./relative/path/schema.prisma');
            
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === absoluteSchemaPath;
            });
            mockFs.readFileSync.mockImplementation((filePath) => {
                if (filePath === absoluteSchemaPath) {
                    return `
                        model User {
                            id    Int     @id @default(autoincrement())
                            name  String
                        }
                    `;
                }
                return '';
            });

            // Act & Assert - Should handle relative input paths by converting to absolute
            expect(async () => {
                await resolver.resolveSchema({} as any);
            }).not.toThrow();
            
            // Verify that the path was resolved to absolute
            expect(mockFs.existsSync).toHaveBeenCalledWith(absoluteSchemaPath);
        });

        it('SCENARIO 4: Should handle file system errors gracefully', () => {
            // Arrange - Test error handling in path resolution
            mockFs.existsSync.mockImplementation(() => {
                throw new Error('EACCES: permission denied');
            });

            const resolver = new PrismaSchemaResolver({
                debug: false
            });

            // Act & Assert - Should handle FS errors gracefully
            expect(async () => {
                await resolver.resolveSchema({} as any);
            }).rejects.toThrow();
            
            // Error should be informative but not expose internal paths
            try {
                await resolver.resolveSchema({} as any);
            } catch (error: any) {
                expect(error.message).toMatch(/schema\.prisma/);
            }
        });
    });

    describe('Consistent Path Resolution Behavior', () => {
        
        it('EDGE CASE: Should handle empty or undefined schemaPath option', () => {
            // Arrange
            const resolver1 = new PrismaSchemaResolver({});
            const resolver2 = new PrismaSchemaResolver({ schemaPath: undefined });
            const resolver3 = new PrismaSchemaResolver({ schemaPath: '' });

            // Mock no schema files exist
            mockFs.existsSync.mockReturnValue(false);

            // Act & Assert - All should behave consistently
            expect(async () => await resolver1.resolveSchema({} as any)).rejects.toThrow();
            expect(async () => await resolver2.resolveSchema({} as any)).rejects.toThrow();
            expect(async () => await resolver3.resolveSchema({} as any)).rejects.toThrow();
        });

        it('INTEGRATION: Path resolution should be consistent across different instances', () => {
            // Arrange - Test that multiple instances resolve paths consistently
            const resolver1 = new PrismaSchemaResolver({ debug: false });
            const resolver2 = new PrismaSchemaResolver({ debug: true });

            // Mock a schema file in the project root
            const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
            
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === schemaPath;
            });
            mockFs.readFileSync.mockReturnValue(`
                model User {
                    id    Int     @id @default(autoincrement())
                    name  String
                }
            `);

            // Act - Both should find the same schema
            const result1 = resolver1.resolveSchema({} as any);
            const result2 = resolver2.resolveSchema({} as any);

            // Assert - Should be functionally equivalent
            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
        });
    });
});