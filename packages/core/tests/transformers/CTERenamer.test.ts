import { describe, test, expect, beforeEach } from 'vitest';
import { CTERenamer } from '../../src/transformers/CTERenamer';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';

describe('CTERenamer', () => {
    let renamer: CTERenamer;
    let formatter: Formatter;

    beforeEach(() => {
        renamer = new CTERenamer();
        formatter = new Formatter();
    });

    /**
     * Helper function to validate SQL syntax by re-parsing
     */
    function validateSqlSyntax(sql: string): void {
        try {
            const reparsedQuery = SelectQueryParser.parse(sql);
            expect(reparsedQuery).toBeDefined();
        } catch (error) {
            throw new Error(`Generated SQL is syntactically invalid: ${sql}\nError: ${error}`);
        }
    }

    /**
     * Helper function to normalize SQL for comparison
     */
    function normalizeSql(sql: string): string {
        return sql.replace(/\s+/g, ' ').trim();
    }

    describe('Input Validation', () => {
        test('should throw error for null query', () => {
            expect(() => {
                renamer.renameCTE(null as any, 'old_name', 'new_name');
            }).toThrow('Query cannot be null or undefined');
        });

        test('should throw error for empty old name', () => {
            const sql = `SELECT 1`;
            const query = SelectQueryParser.parse(sql);
            
            expect(() => {
                renamer.renameCTE(query, '', 'new_name');
            }).toThrow('Old CTE name must be a non-empty string');
        });

        test('should throw error for empty new name', () => {
            const sql = `SELECT 1`;
            const query = SelectQueryParser.parse(sql);
            
            expect(() => {
                renamer.renameCTE(query, 'old_name', '');
            }).toThrow('New CTE name must be a non-empty string');
        });

        test('should throw error for same old and new names', () => {
            const sql = `WITH user_data AS (SELECT id FROM users) SELECT * FROM user_data`;
            const query = SelectQueryParser.parse(sql);
            
            expect(() => {
                renamer.renameCTE(query, 'user_data', 'user_data');
            }).toThrow('Old and new CTE names cannot be the same');
        });

        test('should handle names with whitespace', () => {
            const sql = `WITH user_data AS (SELECT id FROM users) SELECT * FROM user_data`;
            const query = SelectQueryParser.parse(sql);
            
            // Should not throw - whitespace should be trimmed
            expect(() => {
                renamer.renameCTE(query, '  user_data  ', '  customer_data  ');
            }).not.toThrow();
        });
    });

    describe('Basic CTE Renaming', () => {
        test('should rename a simple CTE without dependencies', () => {
            const sql = `
                WITH user_data AS (
                    SELECT id, name FROM users
                )
                SELECT * FROM user_data
            `;
            
            const query = SelectQueryParser.parse(sql);
            renamer.renameCTE(query, 'user_data', 'customer_data');
            
            const result = formatter.format(query);
            validateSqlSyntax(result);
            
            expect(normalizeSql(result).toLowerCase()).toContain('customer_data');
            expect(normalizeSql(result).toLowerCase()).not.toContain('user_data');
        });

        test('should throw error when CTE does not exist', () => {
            const sql = `
                WITH user_data AS (
                    SELECT id, name FROM users
                )
                SELECT * FROM user_data
            `;
            
            const query = SelectQueryParser.parse(sql);
            
            expect(() => {
                renamer.renameCTE(query, 'nonexistent_cte', 'new_name');
            }).toThrow();
        });

        test('should throw error when new name already exists', () => {
            const sql = `
                WITH user_data AS (
                    SELECT id, name FROM users
                ),
                order_data AS (
                    SELECT id, user_id FROM orders
                )
                SELECT * FROM user_data JOIN order_data ON user_data.id = order_data.user_id
            `;
            
            const query = SelectQueryParser.parse(sql);
            
            expect(() => {
                renamer.renameCTE(query, 'user_data', 'order_data');
            }).toThrow();
        });
    });

    describe('CTE with Dependencies', () => {
        test('should rename CTE and update all references in dependent CTEs', () => {
            const sql = `
                WITH user_data AS (
                    SELECT id, name FROM users
                ),
                order_summary AS (
                    SELECT user_data.id, COUNT(*) as order_count
                    FROM user_data
                    JOIN orders ON user_data.id = orders.user_id
                    GROUP BY user_data.id
                )
                SELECT * FROM order_summary
            `;
            
            const query = SelectQueryParser.parse(sql);
            renamer.renameCTE(query, 'user_data', 'customer_data');
            
            const result = formatter.format(query);
            validateSqlSyntax(result);
            
            const normalized = normalizeSql(result).toLowerCase();
            expect(normalized).toContain('customer_data');
            expect(normalized).not.toContain('user_data');
            
            // Verify both CTE definition and references in dependent CTE are updated
            expect(normalized).toMatch(/"customer_data".*as.*select.*"id".*"name".*from.*"users"/);
            expect(normalized).toMatch(/"order_summary".*as.*select.*"customer_data"\."id"/);
            expect(normalized).toMatch(/from.*"customer_data".*join.*"orders".*on.*"customer_data"\."id"/);
        });

        test('should handle multiple dependent CTEs', () => {
            const sql = `
                WITH base_data AS (
                    SELECT id, status FROM accounts
                ),
                active_data AS (
                    SELECT * FROM base_data WHERE status = 'active'
                ),
                summary_data AS (
                    SELECT COUNT(*) as total FROM base_data
                )
                SELECT * FROM active_data UNION ALL SELECT * FROM summary_data
            `;
            
            const query = SelectQueryParser.parse(sql);
            renamer.renameCTE(query, 'base_data', 'account_data');
            
            const result = formatter.format(query);
            validateSqlSyntax(result);
            
            // Check if CTE was actually renamed by inspecting the withClause
            const withClause = (query as any).withClause;
            expect(withClause).toBeDefined();
            expect(withClause.tables).toBeDefined();
            
            const cteNames = withClause.tables.map((cte: any) => cte.aliasExpression.table.name);
            expect(cteNames).toContain('account_data');
            expect(cteNames).not.toContain('base_data');
        });
    });
});