import { describe, it, expect } from 'vitest';
import { ParameterDetector } from '../../src/utils/ParameterDetector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';

describe('ParameterDetector', () => {
    describe('extractParameterNames', () => {
        it('should extract parameter names from SQL with hardcoded parameters', () => {
            // Arrange
            const sql = 'select year_month from sale_summary where year_month = :ym limit :limit';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Act
            const paramNames = ParameterDetector.extractParameterNames(query);

            // Assert
            expect(paramNames).toEqual(['ym', 'limit']);
        });

        it('should return empty array for SQL without parameters', () => {
            // Arrange
            const sql = 'select id, name from users where active = true';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Act
            const paramNames = ParameterDetector.extractParameterNames(query);

            // Assert
            expect(paramNames).toEqual([]);
        });

        it('should extract multiple parameters from complex SQL', () => {
            // Arrange
            const sql = 'select * from users where created_at >= :start_date and status = :status and limit :page_size offset :offset_value';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Act
            const paramNames = ParameterDetector.extractParameterNames(query);

            // Assert
            expect(paramNames).toEqual(['start_date', 'status', 'page_size', 'offset_value']);
        });
    });

    describe('hasParameter', () => {
        it('should return true for existing parameter', () => {
            // Arrange
            const sql = 'select * from users where id = :user_id';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Act & Assert
            expect(ParameterDetector.hasParameter(query, 'user_id')).toBe(true);
        });

        it('should return false for non-existing parameter', () => {
            // Arrange
            const sql = 'select * from users where id = :user_id';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Act & Assert
            expect(ParameterDetector.hasParameter(query, 'other_param')).toBe(false);
        });
    });

    describe('separateFilters', () => {
        it('should separate hardcoded parameters from dynamic filters', () => {
            // Arrange
            const sql = 'select * from users where created_at >= :start_date and status = :status';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const filter = {
                start_date: '2024-01-01',
                status: 'active',
                name: 'John', // This should be a dynamic filter (not in SQL)
                age: 25       // This should be a dynamic filter (not in SQL)
            };

            // Act
            const { hardcodedParams, dynamicFilters } = ParameterDetector.separateFilters(query, filter);

            // Assert
            expect(hardcodedParams).toEqual({
                start_date: '2024-01-01',
                status: 'active'
            });
            expect(dynamicFilters).toEqual({
                name: 'John',
                age: 25
            });
        });

        it('should handle filter with only hardcoded parameters', () => {
            // Arrange
            const sql = 'select * from users where id = :user_id limit :limit';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const filter = {
                user_id: 123,
                limit: 10
            };

            // Act
            const { hardcodedParams, dynamicFilters } = ParameterDetector.separateFilters(query, filter);

            // Assert
            expect(hardcodedParams).toEqual({
                user_id: 123,
                limit: 10
            });
            expect(dynamicFilters).toEqual({});
        });

        it('should handle filter with only dynamic parameters', () => {
            // Arrange
            const sql = 'select * from users where active = true';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const filter = {
                name: 'John',
                status: 'premium'
            };

            // Act
            const { hardcodedParams, dynamicFilters } = ParameterDetector.separateFilters(query, filter);

            // Assert
            expect(hardcodedParams).toEqual({});
            expect(dynamicFilters).toEqual({
                name: 'John',
                status: 'premium'
            });
        });

        it('should handle empty filter', () => {
            // Arrange
            const sql = 'select * from users where id = :user_id';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const filter = {};

            // Act
            const { hardcodedParams, dynamicFilters } = ParameterDetector.separateFilters(query, filter);

            // Assert
            expect(hardcodedParams).toEqual({});
            expect(dynamicFilters).toEqual({});
        });
    });
});