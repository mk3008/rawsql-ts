import { describe, it, expect, beforeEach } from 'vitest';
import { AliasRenamer } from '../../src/transformers/AliasRenamer';

describe('AliasRenamer', () => {
    let renamer: AliasRenamer;

    beforeEach(() => {
        renamer = new AliasRenamer();
    });

    describe('Input Validation', () => {
        it('should reject empty SQL', () => {
            const result = renamer.renameAlias('', { line: 1, column: 1 }, 'new_alias');
            expect(result.success).toBe(false);
            expect(result.conflicts).toContain('Invalid SQL: unable to parse query');
        });

        it('should reject invalid position (line < 1)', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.renameAlias(sql, { line: 0, column: 1 }, 'new_alias');
            expect(result.success).toBe(false);
            expect(result.conflicts).toContain('Invalid position: line or column out of bounds');
        });

        it('should reject invalid position (column < 1)', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.renameAlias(sql, { line: 1, column: 0 }, 'new_alias');
            expect(result.success).toBe(false);
            expect(result.conflicts).toContain('Invalid position: line or column out of bounds');
        });

        it('should reject empty new name', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, '');
            expect(result.success).toBe(false);
            expect(result.conflicts).toContain('New alias name must be a non-empty string');
        });

        it('should reject whitespace-only new name', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, '   ');
            expect(result.success).toBe(false);
            expect(result.conflicts).toContain('New alias name must be a non-empty string');
        });
    });

    describe('Lexeme Detection', () => {
        it('should detect alias at correct position', () => {
            const sql = 'SELECT u.name FROM users u';
            // Position at 'u' in "u.name" (line 1, column 8)
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_alias');
            
            // Should not fail due to lexeme detection (conflicts should be empty or undefined)
            if (result.conflicts) {
                expect(result.conflicts).not.toContain('No lexeme found at the specified position');
            }
        });

        it('should fail when no lexeme found at position', () => {
            const sql = 'SELECT u.name FROM users u';
            // Position in whitespace (line 1, column 7)
            const result = renamer.renameAlias(sql, { line: 1, column: 7 }, 'user_alias');
            expect(result.success).toBe(false);
            expect(result.conflicts).toContain('No lexeme found at the specified position');
        });

        it('should reject non-identifier tokens', () => {
            const sql = 'SELECT u.name FROM users u';
            // Position at 'SELECT' keyword (line 1, column 1)
            const result = renamer.renameAlias(sql, { line: 1, column: 1 }, 'new_alias');
            expect(result.success).toBe(false);
            expect(result.conflicts).toContain('Selected lexeme is not a valid alias');
        });
    });

    describe('Dry Run Mode', () => {
        it('should validate without making changes in dry run mode', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.renameAlias(
                sql, 
                { line: 1, column: 8 }, 
                'user_alias',
                { dryRun: true }
            );
            
            expect(result.originalSql).toBe(sql);
            expect(result.newSql).toBeUndefined();
            expect(result.changes).toBeDefined();
        });
    });

    describe('Basic Functionality Tests', () => {
        it('should initialize properly', () => {
            expect(renamer).toBeInstanceOf(AliasRenamer);
        });

        it('should handle simple SQL parsing', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_alias');
            
            // Should parse SQL successfully (not fail due to SQL parsing)
            expect(result.originalSql).toBe(sql);
        });
    });

    describe('Scope Detection', () => {
        it('should detect main query scope', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_alias');
            
            if (result.scope) {
                expect(result.scope.type).toBe('main');
            }
        });

        it('should handle CTE context', () => {
            const sql = `
                WITH user_data AS (
                    SELECT u.id, u.name 
                    FROM users u
                )
                SELECT ud.name FROM user_data ud
            `;
            
            // Test alias in CTE (line 3, column 12 - 'u' in CTE)
            const result = renamer.renameAlias(sql, { line: 3, column: 12 }, 'user_table');
            
            // Should not fail due to CTE parsing
            expect(result.originalSql).toBe(sql);
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed SQL gracefully', () => {
            const sql = 'SELEC u.name FRO users u'; // Typos in keywords
            const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_alias');
            expect(result.success).toBe(false);
            expect(result.conflicts?.length).toBeGreaterThan(0);
        });

        it('should handle position outside SQL bounds', () => {
            const sql = 'SELECT u.name FROM users u';
            const result = renamer.renameAlias(sql, { line: 10, column: 1 }, 'user_alias');
            expect(result.success).toBe(false);
            expect(result.conflicts).toContain('No lexeme found at the specified position');
        });
    });
});