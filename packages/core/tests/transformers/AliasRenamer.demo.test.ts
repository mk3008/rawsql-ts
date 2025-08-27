import { describe, it, expect } from 'vitest';
import { AliasRenamer } from '../../src/transformers/AliasRenamer';

/**
 * Demonstration tests showing AliasRenamer GUI integration capabilities
 */
describe('AliasRenamer GUI Integration Demo', () => {
    const renamer = new AliasRenamer();

    it('Demo: Basic alias renaming by GUI selection', () => {
        // Simulate user selecting 'u' in a SQL editor at line 1, column 8
        const sql = 'SELECT u.name, u.email FROM users u WHERE u.active = true';
        
        console.log('Original SQL:');
        console.log(sql);
        
        const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'customer');
        
        console.log('\nRename result:');
        console.log('Success:', result.success);
        console.log('New SQL:');
        console.log(result.newSql || 'No changes');
        
        expect(result.success).toBe(true);
        expect(result.newSql).toBe('SELECT customer.name, customer.email FROM users customer WHERE customer.active = true');
    });

    it('Demo: GUI conflict detection', () => {
        const sql = 'SELECT u.name, o.date FROM users u JOIN orders o ON u.id = o.user_id';
        
        console.log('\nConflict Detection Demo:');
        console.log('Original SQL:', sql);
        console.log('Trying to rename "u" to reserved keyword "select"...');
        
        const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'select');
        
        console.log('Result:', result.success ? 'SUCCESS' : 'BLOCKED');
        console.log('Conflicts:', result.conflicts);
        
        expect(result.success).toBe(false);
        expect(result.conflicts?.some(c => c.includes('reserved SQL keyword'))).toBe(true);
    });

    it('Demo: Dry run validation', () => {
        const sql = 'SELECT u.name FROM users u JOIN orders o ON u.id = o.user_id';
        
        console.log('\nDry Run Demo:');
        console.log('Original SQL:', sql);
        console.log('Dry run: rename "u" to "customer"');
        
        const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'customer', { dryRun: true });
        
        console.log('Validation result:', result.success ? 'VALID' : 'INVALID');
        console.log('Changes would be made:', result.changes?.length || 0, 'locations');
        console.log('SQL unchanged (dry run):', result.newSql === undefined);
        
        expect(result.success).toBe(true);
        expect(result.newSql).toBeUndefined(); // No actual changes in dry run
        expect(result.originalSql).toBe(sql);
    });

    it('Demo: Line-column position handling', () => {
        const multilineSQL = `SELECT u.name, u.email
FROM users u
WHERE u.active = true
  AND u.created_date > '2024-01-01'
ORDER BY u.name`;

        console.log('\nMulti-line SQL Demo:');
        console.log('Original SQL:');
        console.log(multilineSQL);
        console.log('\nSelecting "u" at line 2, column 12...');
        
        const result = renamer.renameAlias(multilineSQL, { line: 2, column: 12 }, 'usr');
        
        console.log('Rename result:');
        console.log(result.newSql);
        
        expect(result.success).toBe(true);
        expect(result.newSql).toContain('usr.name, usr.email');
        expect(result.newSql).toContain('FROM users usr');
        expect(result.newSql).toContain('usr.active');
        expect(result.newSql).toContain('usr.created_date');
        expect(result.newSql).toContain('ORDER BY usr.name');
    });

    it('Demo: Complex JOIN scenario', () => {
        const complexSQL = `SELECT u.name, p.title, o.date
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
INNER JOIN orders o ON u.id = o.user_id
WHERE u.active = true
  AND o.status = 'completed'
ORDER BY u.name, o.date DESC`;

        console.log('\nComplex JOIN Demo:');
        console.log('Original SQL:');
        console.log(complexSQL);
        console.log('\nRenaming "u" to "customer"...');
        
        const result = renamer.renameAlias(complexSQL, { line: 2, column: 12 }, 'customer');
        
        console.log('\nResult:');
        console.log(result.newSql);
        
        expect(result.success).toBe(true);
        if (result.newSql) {
            expect(result.newSql).toContain('customer.name');
            expect(result.newSql).toContain('FROM users customer');
            expect(result.newSql).toContain('customer.id = p.user_id');
            expect(result.newSql).toContain('customer.id = o.user_id');
            expect(result.newSql).toContain('customer.active');
            expect(result.newSql).toContain('ORDER BY customer.name');
            // Other aliases should remain unchanged
            expect(result.newSql).toContain('p.title');
            expect(result.newSql).toContain('o.date');
            expect(result.newSql).toContain('o.status');
        }
    });
});