import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { DuplicateCTEError, InvalidCTENameError, CTENotFoundError } from '../../src/models/CTEError';

describe('SelectQuery CTE Error Handling', () => {
    describe('addCTE error cases', () => {
        test('should throw InvalidCTENameError for empty name', () => {
            // Red: Test validation for empty CTE name
            const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts');
            
            expect(() => {
                query.addCTE('', cteQuery);
            }).toThrow(InvalidCTENameError);
        });

        test('should throw InvalidCTENameError for whitespace-only name', () => {
            // Red: Test validation for whitespace-only CTE name
            const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts');
            
            expect(() => {
                query.addCTE('   ', cteQuery);
            }).toThrow(InvalidCTENameError);
        });

        test('should throw DuplicateCTEError for duplicate CTE name', () => {
            // Red: Test duplicate CTE name detection
            const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery1 = SelectQueryParser.parse('SELECT id FROM accounts');
            const cteQuery2 = SelectQueryParser.parse('SELECT id FROM orders');
            
            query.addCTE('duplicate_name', cteQuery1);
            
            expect(() => {
                query.addCTE('duplicate_name', cteQuery2);
            }).toThrow(DuplicateCTEError);
        });

        test('should include CTE name in DuplicateCTEError', () => {
            // Red: Test error message contains CTE name
            const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery1 = SelectQueryParser.parse('SELECT id FROM accounts');
            const cteQuery2 = SelectQueryParser.parse('SELECT id FROM orders');
            
            query.addCTE('test_cte', cteQuery1);
            
            expect(() => {
                query.addCTE('test_cte', cteQuery2);
            }).toThrow("CTE 'test_cte' already exists");
        });
    });

    describe('removeCTE error cases', () => {
        test('should throw CTENotFoundError for non-existent CTE', () => {
            // Red: Test removal of non-existent CTE
            const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            
            expect(() => {
                query.removeCTE('non_existent');
            }).toThrow(CTENotFoundError);
        });

        test('should include CTE name in CTENotFoundError', () => {
            // Red: Test error message contains CTE name
            const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            
            expect(() => {
                query.removeCTE('missing_cte');
            }).toThrow("CTE 'missing_cte' not found");
        });
    });

    describe('replaceCTE error cases', () => {
        test('should throw InvalidCTENameError for empty name in replaceCTE', () => {
            // Red: Test validation in replaceCTE
            const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts');
            
            expect(() => {
                query.replaceCTE('', cteQuery);
            }).toThrow(InvalidCTENameError);
        });
    });

    describe('Error instance properties', () => {
        test('DuplicateCTEError should include cteName property', () => {
            // Red: Test error object properties
            const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery1 = SelectQueryParser.parse('SELECT id FROM accounts');
            const cteQuery2 = SelectQueryParser.parse('SELECT id FROM orders');
            
            query.addCTE('property_test', cteQuery1);
            
            try {
                query.addCTE('property_test', cteQuery2);
                expect.fail('Should have thrown DuplicateCTEError');
            } catch (error) {
                expect(error).toBeInstanceOf(DuplicateCTEError);
                expect((error as DuplicateCTEError).cteName).toBe('property_test');
            }
        });

        test('CTENotFoundError should include cteName property', () => {
            // Red: Test error object properties
            const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            
            try {
                query.removeCTE('property_test');
                expect.fail('Should have thrown CTENotFoundError');
            } catch (error) {
                expect(error).toBeInstanceOf(CTENotFoundError);
                expect((error as CTENotFoundError).cteName).toBe('property_test');
            }
        });
    });
});