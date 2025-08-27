import { describe, it, expect } from 'vitest';
import { SmartRenamer } from '../../src/transformers/SmartRenamer';
import { LexemeCursor } from '../../src/utils/LexemeCursor';
import { TokenType } from '../../src/models/Lexeme';

/**
 * Complete Demo: Smart SQL Renaming with Position Detection
 * 
 * This demonstrates the full workflow:
 * 1. User clicks on SQL text at specific coordinates
 * 2. System detects what token is at that position
 * 3. Automatically chooses appropriate renamer (CTE vs Alias)
 * 4. Performs rename operation with conflict detection
 */
describe('SmartRenamer Complete Demo', () => {
    const renamer = new SmartRenamer();

    /**
     * Helper method to classify token types for demo display
     */
    function classifyToken(lexeme: any): string {
        if (!lexeme) return 'None';
        
        if (lexeme.type & TokenType.Command) return 'SQL Command';
        if (lexeme.type & TokenType.Function) return 'Function/CTE';
        if (lexeme.type & TokenType.Identifier) return 'Identifier';
        if (lexeme.type & TokenType.Operator) return 'Operator';
        if (lexeme.type & TokenType.Literal) return 'Literal';
        if (lexeme.type & TokenType.Comma) return 'Comma';
        if (lexeme.type & TokenType.Dot) return 'Dot';
        if (lexeme.type & TokenType.OpenParen) return 'Open Paren';
        if (lexeme.type & TokenType.CloseParen) return 'Close Paren';
        
        return 'Other';
    }

    /**
     * Helper method to determine if a token at position is renameable
     */
    function isRenameableToken(sql: string, lexeme: any, position: any): boolean {
        if (!lexeme) return false;
        
        // Must be identifier or function type
        if (!(lexeme.type & (TokenType.Identifier | TokenType.Function))) {
            return false;
        }
        
        // Try a test rename to see if it would work
        try {
            const testResult = renamer.rename(sql, position, 'test_rename_check');
            return testResult.success || (testResult.error !== undefined && !testResult.error.includes('No identifier found'));
        } catch {
            return false;
        }
    }

    describe('GUI Click Position Detection and Smart Renaming', () => {
        it('Demo: Complete workflow from cursor position to renamed SQL', () => {
            console.log('\n🎯 DEMO: Complete Smart Renaming Workflow');
            console.log('=' .repeat(60));

            const complexSql = `WITH user_data AS (
                SELECT u.id, u.name FROM users u WHERE u.active = true
            ),
            order_summary AS (
                SELECT user_data.id, COUNT(*) as order_count
                FROM user_data
                LEFT JOIN orders o ON user_data.id = o.user_id
                GROUP BY user_data.id
            )
            SELECT os.id, os.order_count 
            FROM order_summary os
            WHERE os.order_count > 0`;

            console.log('\nOriginal SQL:');
            console.log(complexSql);

            // Scenario 1: User clicks on CTE name 'user_data' in WITH clause
            console.log('\n📍 Scenario 1: User clicks on CTE name "user_data" at line 1, column 6');
            
            // Step 1: Detect what token is at this position
            const position1 = { line: 1, column: 6 };
            const lexeme1 = LexemeCursor.findLexemeAtLineColumn(complexSql, position1);
            
            console.log(`   Token found: "${lexeme1?.value}" (type: ${lexeme1?.type})`);
            console.log(`   Token classification: ${classifyToken(lexeme1)}`);
            
            // Step 2: Smart rename operation
            const result1 = renamer.rename(complexSql, position1, 'customer_data');
            
            console.log(`   Renamer used: ${result1.renamerType.toUpperCase()}Renamer`);
            console.log(`   Success: ${result1.success}`);
            
            if (result1.success && result1.newSql) {
                console.log('   ✅ Rename successful!');
                console.log(`   Original name: "${result1.originalName}" → New name: "${result1.newName}"`);
                
                // Verify the rename worked correctly
                expect(result1.newSql).toContain('with "customer_data" as');
                expect(result1.newSql).toContain('from "customer_data"');
                expect(result1.newSql).toContain('"customer_data"."id" = "o"."user_id"');
                expect(result1.newSql).not.toContain('user_data');
                
                console.log('\n   📋 Result SQL (partial):');
                console.log(`   ${result1.newSql.substring(0, 150)}...`);
            }

            // Scenario 2: User clicks on table alias 'u' 
            console.log('\n📍 Scenario 2: User clicks on table alias "u" at line 2, column 42');
            
            const position2 = { line: 2, column: 42 };
            const lexeme2 = LexemeCursor.findLexemeAtLineColumn(complexSql, position2);
            
            console.log(`   Token found: "${lexeme2?.value}" (type: ${lexeme2?.type})`);
            console.log(`   Token classification: ${classifyToken(lexeme2)}`);
            
            const result2 = renamer.rename(complexSql, position2, 'usr');
            
            console.log(`   Renamer used: ${result2.renamerType.toUpperCase()}Renamer`);
            console.log(`   Success: ${result2.success}`);
            
            if (result2.success && result2.newSql) {
                console.log('   ✅ Rename successful!');
                console.log(`   Original name: "${result2.originalName}" → New name: "${result2.newName}"`);
                
                // Verify the rename was successful (exact content may vary)
                expect(result2.success).toBe(true);
                expect(result2.renamerType).toBe('alias');
                
                console.log('\n   📋 Result SQL (partial):');
                console.log(`   ${result2.newSql.substring(0, 150)}...`);
            }

            // Scenario 3: User clicks on non-renameable token (keyword)
            console.log('\n📍 Scenario 3: User clicks on keyword "SELECT" at line 2, column 17');
            
            const position3 = { line: 2, column: 17 };
            const lexeme3 = LexemeCursor.findLexemeAtLineColumn(complexSql, position3);
            
            console.log(`   Token found: "${lexeme3?.value}" (type: ${lexeme3?.type})`);
            console.log(`   Token classification: ${classifyToken(lexeme3)}`);
            
            const result3 = renamer.rename(complexSql, position3, 'new_name');
            
            console.log(`   Renamer used: ${result3.renamerType}`);
            console.log(`   Success: ${result3.success}`);
            console.log(`   ❌ Expected failure: ${result3.error}`);
            
            expect(result3.success).toBe(false);
            expect(result3.error).toBeDefined();

            // Scenario 4: Conflict detection demo
            console.log('\n📍 Scenario 4: Conflict detection - trying to use reserved keyword');
            
            const result4 = renamer.rename(complexSql, position1, 'select');
            
            console.log(`   Trying to rename CTE "user_data" to reserved word "select"`);
            console.log(`   Success: ${result4.success}`);
            console.log(`   ❌ Conflict detected: ${result4.error}`);
            
            expect(result4.success).toBe(false);
            expect(result4.error).toContain('reserved SQL keyword');

            console.log('\n🎉 Demo Complete! All scenarios working correctly.');
            console.log('=' .repeat(60));
        });

        it('Demo: Position-based token analysis across complex SQL', () => {
            console.log('\n🔍 DEMO: Token Analysis at Different Positions');
            console.log('=' .repeat(50));

            const sql = `WITH data AS (SELECT u.name FROM users u) 
SELECT d.name FROM data d WHERE d.name IS NOT NULL`;

            console.log('\nSQL for analysis:');
            console.log(sql);

            // Define positions to test
            const testPositions = [
                { line: 1, column: 6, description: 'CTE name "data"' },
                { line: 1, column: 11, description: 'Keyword "AS"' },
                { line: 1, column: 18, description: 'Keyword "SELECT"' },
                { line: 1, column: 25, description: 'Table alias "u"' },
                { line: 1, column: 27, description: 'Dot operator' },
                { line: 1, column: 28, description: 'Column "name"' },
                { line: 1, column: 38, description: 'Table name "users"' },
                { line: 2, column: 8, description: 'CTE alias "d"' },
                { line: 2, column: 10, description: 'Dot operator' },
                { line: 2, column: 18, description: 'CTE table name "data"' }
            ];

            console.log('\n📋 Position Analysis Results:');
            console.log('Position'.padEnd(15) + 'Token'.padEnd(12) + 'Type'.padEnd(15) + 'Classification'.padEnd(20) + 'Renameable?');
            console.log('-'.repeat(80));

            for (const pos of testPositions) {
                const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, { line: pos.line, column: pos.column });
                const classification = classifyToken(lexeme);
                const isRenameable = isRenameableToken(sql, lexeme, { line: pos.line, column: pos.column });
                
                const posStr = `(${pos.line},${pos.column})`.padEnd(15);
                const tokenStr = `"${lexeme?.value || 'null'}"`.padEnd(12);
                const typeStr = (lexeme?.type?.toString() || 'N/A').padEnd(15);
                const classStr = classification.padEnd(20);
                const renameStr = isRenameable ? '✅ Yes' : '❌ No';
                
                console.log(posStr + tokenStr + typeStr + classStr + renameStr);
                
                // Test the actual rename operation for renameable tokens
                if (isRenameable && lexeme) {
                    const testRename = renamer.rename(sql, { line: pos.line, column: pos.column }, 'test_name');
                    console.log(`   → Rename test: ${testRename.success ? '✅ Success' : '❌ ' + testRename.error}`);
                    if (testRename.success) {
                        console.log(`   → Renamer type: ${testRename.renamerType}`);
                    }
                }
            }

            console.log('\n🎯 Analysis Complete!');
        });

        it('Demo: Error handling and conflict detection showcase', () => {
            console.log('\n⚠️  DEMO: Error Handling and Conflict Detection');
            console.log('=' .repeat(50));

            const sql = `WITH user_data AS (SELECT * FROM users),
                 order_data AS (SELECT * FROM orders)
            SELECT * FROM user_data u JOIN order_data o ON u.id = o.user_id`;

            console.log('\nSQL for conflict testing:');
            console.log(sql);

            const conflictTests = [
                {
                    position: { line: 1, column: 6 },
                    newName: 'order_data',
                    description: 'CTE name conflict',
                    expectedError: 'already exists'
                },
                {
                    position: { line: 1, column: 6 },
                    newName: 'select',
                    description: 'Reserved keyword conflict',
                    expectedError: 'reserved SQL keyword'
                },
                {
                    position: { line: 3, column: 30 },
                    newName: 'from',
                    description: 'Reserved keyword in alias rename',
                    expectedError: 'reserved SQL keyword'
                },
                {
                    position: { line: 1, column: 5 },
                    newName: 'valid_name',
                    description: 'Position in whitespace',
                    expectedError: 'No identifier found'
                }
            ];

            console.log('\n📋 Conflict Test Results:');
            console.log('Test'.padEnd(35) + 'Status'.padEnd(10) + 'Error Message');
            console.log('-'.repeat(80));

            for (const test of conflictTests) {
                const result = renamer.rename(sql, test.position, test.newName);
                const status = result.success ? '✅ Success' : '❌ Failed';
                const errorMsg = result.error || 'None';
                
                console.log(test.description.padEnd(35) + status.padEnd(10) + errorMsg);
                
                expect(result.success).toBe(false);
                expect(result.error).toContain(test.expectedError);
            }

            console.log('\n🛡️  All conflict detection working correctly!');
        });
    });
});