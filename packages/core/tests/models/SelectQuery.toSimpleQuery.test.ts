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
            const query1 = SelectQueryParser.parse('SELECT id FROM users');
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
            const query1 = SelectQueryParser.parse('SELECT id, name FROM employees');
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
            const query1 = SelectQueryParser.parse('SELECT id FROM table1');
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