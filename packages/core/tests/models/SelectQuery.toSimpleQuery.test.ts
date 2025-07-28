import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { BinarySelectQuery } from '../../src/models/BinarySelectQuery';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { ValuesQuery } from '../../src/models/ValuesQuery';
import { TupleExpression, LiteralValue } from '../../src/models/ValueComponent';

describe('SelectQuery toSimpleQuery() conversion', () => {
    const formatter = new SqlFormatter();

    describe('SimpleSelectQuery.toSimpleQuery()', () => {
        test('should return same instance for SimpleSelectQuery', () => {
            // Test identity function for SimpleSelectQuery
            const query = SelectQueryParser.parse('SELECT * FROM users WHERE id = 1').toSimpleQuery();
            
            const result = query.toSimpleQuery();
            
            expect(result).toBe(query); // Same instance
            expect(result).toBeInstanceOf(SimpleSelectQuery);
        });

        test('should maintain CTE functionality after toSimpleQuery()', () => {
            // Test that CTE methods work on the returned instance
            const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const simpleQuery = query.toSimpleQuery();
            simpleQuery.addCTE('active_accounts', cteQuery);
            
            expect(simpleQuery.hasCTE('active_accounts')).toBe(true);
            expect(simpleQuery.getCTENames()).toEqual(['active_accounts']);
        });
    });

    describe('BinarySelectQuery.toSimpleQuery()', () => {
        test('should convert BinarySelectQuery to SimpleSelectQuery', () => {
            // Test conversion of UNION query
            const query1 = SelectQueryParser.parse('SELECT id, name FROM users').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id, name FROM customers');
            const binaryQuery = query1.toUnion(query2);
            
            const result = binaryQuery.toSimpleQuery();
            
            expect(result).not.toBe(binaryQuery); // Different instance
            expect(result).toBeInstanceOf(SimpleSelectQuery);
            expect(binaryQuery).toBeInstanceOf(BinarySelectQuery);
        });

        test('should enable CTE management on converted BinarySelectQuery', () => {
            // Test that converted binary query supports CTE operations
            const query1 = SelectQueryParser.parse('SELECT id FROM users').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id FROM customers');
            const binaryQuery = query1.toUnion(query2);
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const simpleQuery = binaryQuery.toSimpleQuery();
            simpleQuery.addCTE('active_accounts', cteQuery, { materialized: true });
            
            const formatted = formatter.format(simpleQuery);
            
            expect(simpleQuery.hasCTE('active_accounts')).toBe(true);
            expect(formatted.formattedSql.trim()).toContain('"active_accounts" as materialized');
        });

        test('should produce valid SQL with complex UNION and CTE', () => {
            // Test full workflow: UNION -> toSimpleQuery -> addCTE -> format
            const query1 = SelectQueryParser.parse('SELECT id, name FROM employees').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id, name FROM contractors');
            const binaryQuery = query1.toUnionAll(query2);
            const cteQuery = SelectQueryParser.parse('SELECT id FROM departments WHERE active = true');
            
            const result = binaryQuery.toSimpleQuery()
                .addCTE('active_departments', cteQuery);
            
            const formatted = formatter.format(result);
            
            // Should contain both CTE and the subquery representation of the UNION
            expect(formatted.formattedSql.trim()).toContain('with "active_departments"');
            expect(formatted.formattedSql.trim()).toContain('union all');
        });
    });

    describe('Method chaining patterns', () => {
        test('should support fluent API: binary -> toSimpleQuery -> CTE operations', () => {
            // Test the recommended usage pattern
            const query1 = SelectQueryParser.parse('SELECT id FROM table1').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id FROM table2');
            const cte1 = SelectQueryParser.parse('SELECT id FROM temp1');
            const cte2 = SelectQueryParser.parse('SELECT id FROM temp2');
            
            const result = query1.toUnion(query2)
                .toSimpleQuery()
                .addCTE('temp_data1', cte1)
                .addCTE('temp_data2', cte2, { materialized: false });
            
            expect(result.hasCTE('temp_data1')).toBe(true);
            expect(result.hasCTE('temp_data2')).toBe(true);
            expect(result.getCTENames()).toEqual(['temp_data1', 'temp_data2']);
        });
    });

    describe('BinarySelectQuery ORDER BY handling', () => {
        // NOTE: In SQL standard, ORDER BY in UNION context applies to the entire result set.
        // Table prefixes (e.g., "a.column") would be invalid SQL syntax in ORDER BY clauses
        // following UNION operations. Only column names without prefixes or positional notation
        // (ORDER BY 1, 2) are valid. This implementation correctly handles valid SQL cases.
        
        test('should move ORDER BY from right query to SimpleQuery when converting', () => {
            // Test ORDER BY removal from right query and movement to SimpleQuery
            const query1 = SelectQueryParser.parse('SELECT id, name FROM users').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id, name FROM customers ORDER BY name ASC');
            const binaryQuery = query1.toUnion(query2);
            
            const result = binaryQuery.toSimpleQuery();
            const formatted = formatter.format(result);
            
            // ORDER BY should be at SimpleQuery level, not in the subquery
            expect(result.orderByClause).not.toBeNull();
            
            // Verify ORDER BY is at the outermost level (after the subquery)
            // Should be: SELECT * FROM (...) AS "bq" ORDER BY "name"
            const sql = formatted.formattedSql.trim();
            expect(sql).toMatch(/\)\s+as\s+"bq"\s+order\s+by\s+"name"/i);
            
            // The binary query itself should no longer have ORDER BY on the right side
            const binaryFormatted = formatter.format(binaryQuery);
            // Should not contain ORDER BY before UNION
            expect(binaryFormatted.formattedSql).not.toMatch(/order\s+by\s+[^)]+\)\s*$/i);
        });

        test('should handle multiple ORDER BY clauses correctly', () => {
            // Test when both queries have ORDER BY - should use right query's ORDER BY
            const query1 = SelectQueryParser.parse('SELECT id, name FROM users ORDER BY id DESC').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id, name FROM customers ORDER BY name ASC, id DESC');
            const binaryQuery = query1.toUnion(query2);
            
            const result = binaryQuery.toSimpleQuery();
            const formatted = formatter.format(result);
            
            // Should have ORDER BY at SimpleQuery level from right query
            expect(result.orderByClause).not.toBeNull();
            
            // Verify ORDER BY is moved to outermost level and contains columns from right query
            const sql = formatted.formattedSql.trim();
            expect(sql).toMatch(/\)\s+as\s+"bq"\s+order\s+by\s+"name"[^,]*,\s*"id"/i);
            
            // Original binary query should have ORDER BY removed from right side
            const binaryFormatted = formatter.format(binaryQuery);
            // Left query still has its ORDER BY (not removed)
            expect(binaryFormatted.formattedSql).toContain('order by "id" desc union');
            // But right query's ORDER BY should be removed
            expect(binaryFormatted.formattedSql).not.toMatch(/customers.*order\s+by.*$/i);
        });

        test('should work with nested binary queries', () => {
            // Test ORDER BY handling with nested binary operations
            const query1 = SelectQueryParser.parse('SELECT id FROM table1').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id FROM table2 ORDER BY id ASC');
            const query3 = SelectQueryParser.parse('SELECT id FROM table3');
            
            const binaryQuery1 = query1.toUnion(query2);
            const binaryQuery2 = binaryQuery1.toSimpleQuery().toUnion(query3);
            
            const result = binaryQuery2.toSimpleQuery();
            const formatted = formatter.format(result);
            
            // Should extract ORDER BY from the rightmost query that has it
            expect(result.orderByClause).not.toBeNull();
            
            // ORDER BY should be at the outermost level
            const sql = formatted.formattedSql.trim();
            expect(sql).toMatch(/\)\s+as\s+"bq"\s+order\s+by\s+"id"/i);
            
            // Verify the nested structure doesn't have ORDER BY in the middle
            expect(sql).not.toMatch(/table2.*order.*union/i);
        });

        test('should handle case with no ORDER BY in any query', () => {
            // Test when no queries have ORDER BY
            const query1 = SelectQueryParser.parse('SELECT id FROM users').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id FROM customers');
            const binaryQuery = query1.toUnion(query2);
            
            const result = binaryQuery.toSimpleQuery();
            
            // Should have no ORDER BY clause
            expect(result.orderByClause).toBeNull();
        });

        test('should verify ORDER BY is actually removed from original query', () => {
            // Create queries and verify ORDER BY removal
            const query1 = SelectQueryParser.parse('SELECT id FROM users').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id FROM customers ORDER BY id DESC').toSimpleQuery();
            
            // Store original ORDER BY state
            expect(query2.orderByClause).not.toBeNull();
            const originalOrderBy = query2.orderByClause;
            
            const binaryQuery = query1.toUnion(query2);
            const result = binaryQuery.toSimpleQuery();
            
            // Original query should have ORDER BY removed
            expect(query2.orderByClause).toBeNull();
            
            // Result should have the ORDER BY
            expect(result.orderByClause).not.toBeNull();
            expect(result.orderByClause).toBe(originalOrderBy);
        });
    });

    describe('ValuesQuery.toSimpleQuery()', () => {
        test('should convert ValuesQuery to SimpleSelectQuery', () => {
            // Test conversion of VALUES query
            const tuple1 = new TupleExpression([new LiteralValue('1'), new LiteralValue('John')]);
            const tuple2 = new TupleExpression([new LiteralValue('2'), new LiteralValue('Jane')]);
            const valuesQuery = new ValuesQuery([tuple1, tuple2], ['id', 'name']);
            
            const result = valuesQuery.toSimpleQuery();
            
            expect(result).not.toBe(valuesQuery); // Different instance
            expect(result).toBeInstanceOf(SimpleSelectQuery);
            expect(valuesQuery).toBeInstanceOf(ValuesQuery);
        });

        test('should enable CTE management on converted ValuesQuery', () => {
            // Test that converted VALUES query supports CTE operations
            const tuple = new TupleExpression([new LiteralValue('1'), new LiteralValue('test')]);
            const valuesQuery = new ValuesQuery([tuple], ['id', 'name']);
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const simpleQuery = valuesQuery.toSimpleQuery();
            simpleQuery.addCTE('active_accounts', cteQuery);
            
            const formatted = formatter.format(simpleQuery);
            
            expect(simpleQuery.hasCTE('active_accounts')).toBe(true);
            expect(formatted.formattedSql.trim()).toContain('"active_accounts"');
        });
    });
});