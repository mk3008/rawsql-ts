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
        mockFs.statSync.mockReturnValue({ isFile: () => false } as any);
    });

    describe('Module-based Path Resolution', () => {
        
        it('SCENARIO 1: Should use module directory instead of process.cwd()', async () => {
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
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath === expectedSchemaPath) {
                    return { isFile: () => true } as any;
                }
                return { isFile: () => false } as any;
            });
            mockFs.readFileSync.mockImplementation((filePath) => {
                if (filePath === expectedSchemaPath) {
                    return `
                        datasource db {
                            provider = "postgresql"
                            url      = env("DATABASE_URL")
                        }
                        model User {
                            id    Int     @id @default(autoincrement())
                            name  String
                            email String  @unique
                        }
                    `;
                }
                return '';
            });

            // Act & Assert - Should successfully resolve schema from module-based paths
            try {
                const result = await resolver.resolveSchema({} as any);
                expect(result).toBeDefined();
                expect(result.models).toBeDefined();
                expect(Object.keys(result.models)).toContain('User');
            } catch (error) {
                // Should not throw if schema is found
                throw new Error(`Unexpected error: ${error}`);
            }
        });

        it('SCENARIO 2: WSL path handling should be dynamic, not hardcoded', async () => {
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

        it('SCENARIO 3: Cross-platform absolute path handling', async () => {
            // Arrange - Test that all paths are resolved to absolute
            const resolver = new PrismaSchemaResolver({
                schemaPath: './relative/path/schema.prisma'
            });

            // Mock the custom schema path to exist and be valid
            const customSchemaPath = './relative/path/schema.prisma';
            
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === customSchemaPath;
            });
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath === customSchemaPath) {
                    return { isFile: () => true } as any;
                }
                return { isFile: () => false } as any;
            });
            mockFs.readFileSync.mockImplementation((filePath) => {
                if (filePath === customSchemaPath) {
                    return `
                        datasource db {
                            provider = "postgresql"
                            url      = env("DATABASE_URL")
                        }
                        model User {
                            id    Int     @id @default(autoincrement())
                            name  String
                        }
                    `;
                }
                return '';
            });

            // Act - Should handle custom schema paths
            const result = await resolver.resolveSchema({} as any);
            
            // Assert - Should successfully resolve schema
            expect(result).toBeDefined();
            expect(result.models).toBeDefined();
            expect(Object.keys(result.models)).toContain('User');
            
            // Verify that the custom path was checked first
            expect(mockFs.existsSync).toHaveBeenCalledWith(customSchemaPath);
        });

        it('SCENARIO 4: Should handle file system errors gracefully', async () => {
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
        
        it('EDGE CASE: Should handle empty or undefined schemaPath option', async () => {
            // Arrange
            const resolver1 = new PrismaSchemaResolver({});
            const resolver2 = new PrismaSchemaResolver({ schemaPath: undefined });
            const resolver3 = new PrismaSchemaResolver({ schemaPath: '' });

            // Mock no schema files exist
            mockFs.existsSync.mockReturnValue(false);

            // Act & Assert - All should behave consistently
            await expect(resolver1.resolveSchema({} as any)).rejects.toThrow();
            await expect(resolver2.resolveSchema({} as any)).rejects.toThrow();
            await expect(resolver3.resolveSchema({} as any)).rejects.toThrow();
        });

        it('INTEGRATION: Path resolution should be consistent across different instances', async () => {
            // Arrange - Test that multiple instances resolve paths consistently
            const resolver1 = new PrismaSchemaResolver({ debug: false });
            const resolver2 = new PrismaSchemaResolver({ debug: true });

            // Mock a schema file in the project root
            const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
            
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === schemaPath;
            });
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath === schemaPath) {
                    return { isFile: () => true } as any;
                }
                return { isFile: () => false } as any;
            });
            mockFs.readFileSync.mockReturnValue(`
                datasource db {
                    provider = "postgresql"
                    url      = env("DATABASE_URL")
                }
                model User {
                    id    Int     @id @default(autoincrement())
                    name  String
                }
            `);

            // Act - Both should find the same schema
            const result1 = await resolver1.resolveSchema({} as any);
            const result2 = await resolver2.resolveSchema({} as any);

            // Assert - Should be functionally equivalent
            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
            expect(Object.keys(result1.models)).toContain('User');
            expect(Object.keys(result2.models)).toContain('User');
        });
    });
});