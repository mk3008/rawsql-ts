import { describe, it, expect } from 'vitest';
import { ParameterDetector } from '../../src/utils/ParameterDetector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';
import { DynamicQueryBuilder } from '../../src/transformers/DynamicQueryBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('ParameterDetector', () => {
    describe('extractParameterNames', () => {
        it('extracts parameter names from SQL with explicit placeholders', () => {
            // Arrange
            const sql = 'select year_month from sale_summary where year_month = :ym limit :limit';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Act
            const paramNames = ParameterDetector.extractParameterNames(query);

            // Assert
            expect(paramNames).toEqual(['ym', 'limit']);
        });

        it('returns empty array when SQL has no placeholders', () => {
            // Arrange
            const sql = 'select id, name from users where active = true';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Act
            const paramNames = ParameterDetector.extractParameterNames(query);

            // Assert
            expect(paramNames).toEqual([]);
        });

        it('extracts all placeholders from a complex query', () => {
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
        it('detects an existing parameter', () => {
            // Arrange
            const sql = 'select * from users where id = :user_id';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Act & Assert
            expect(ParameterDetector.hasParameter(query, 'user_id')).toBe(true);
        });

        it('rejects non-existing parameter names', () => {
            // Arrange
            const sql = 'select * from users where id = :user_id';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            // Act & Assert
            expect(ParameterDetector.hasParameter(query, 'other_param')).toBe(false);
        });
    });

    describe('separateFilters', () => {
        it('splits filters into hardcoded and dynamic groups', () => {
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

        it('returns only hardcoded filters when provided', () => {
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

        it('returns only dynamic filters when no placeholders exist', () => {
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

        it('treats positional parameters as hardcoded when column comparisons match', () => {
            // Arrange
            const sql = 'select id, name from customers where id = $1';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const filter = {
                id: 10,
                name: 'Alice'
            };

            // Act
            const { hardcodedParams, dynamicFilters } = ParameterDetector.separateFilters(query, filter);

            // Assert
            expect(hardcodedParams).toEqual({
                '1': 10
            });
            expect(dynamicFilters).toEqual({
                name: 'Alice'
            });
        });

        it('fails via DynamicQueryBuilder when expressions leave placeholders unresolved', () => {
            // Arrange
            const sql = 'select * from users where id + :offset = :target';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const filter = { id: 5 };
            const formatter = new SqlFormatter({ preset: 'postgres' });
            const builder = new DynamicQueryBuilder();

            // Act
            const { formattedSql } = formatter.format(query);
            const build = () => builder.buildQuery(sql, { filter });

            // Assert
            expect(formattedSql).toBe('select * from \"users\" where \"id\" + $1 = $2');
            expect(build).toThrow(/Missing values for hardcoded placeholders .*:offset.*:target/);
        });

        it('fails via DynamicQueryBuilder when expressions leave placeholders unresolved - index param style', () => {
            // Arrange
            const sql = 'select * from users where id + $3 = $6';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const filter = { id: 5 };
            const formatter = new SqlFormatter({ preset: 'postgres' });
            const builder = new DynamicQueryBuilder();

            // Act
            const { formattedSql } = formatter.format(query);
            const build = () => builder.buildQuery(sql, { filter });

            // Assert
            expect(formattedSql).toBe('select * from \"users\" where \"id\" + $1 = $2');
            expect(build).toThrow(/Missing values for hardcoded placeholders .*\$3.*\$6/);
        });

        it('renumbers arbitrary indexed queries for unaliased tables', () => {
            // Arrange
            const sql = 'select id, name from customers where id = $99';
            const filter = { id: 10 };
            const builder = new DynamicQueryBuilder();
            const formatter = new SqlFormatter({ preset: 'postgres' });

            // Act
            const query = builder.buildQuery(sql, { filter });
            const { formattedSql, params } = formatter.format(query);

            // Assert
            expect(formattedSql).toBe('select \"id\", \"name\" from \"customers\" where \"id\" = $1');
            expect(params).toEqual([10]);
        });

        it('renumbers arbitrary indexed queries for aliased tables', () => {
            // Arrange
            const sql = 'select c.id, c.name from customers as c where c.id = $99';
            const filter = { id: 10 };
            const builder = new DynamicQueryBuilder();
            const formatter = new SqlFormatter({ preset: 'postgres' });

            // Act
            const query = builder.buildQuery(sql, { filter });
            const { formattedSql, params } = formatter.format(query);

            // Assert
            expect(formattedSql).toBe('select \"c\".\"id\", \"c\".\"name\" from \"customers\" as \"c\" where \"c\".\"id\" = $1');
            expect(params).toEqual([10]);
        });

        it('handles CTE + positional parameter filtering with renumbered $n', () => {
            // Arrange
            const sql = [
                'with a as (select id, name from table_a)',
                'select * from a where id = $1',
            ].join('\n');
            const filter = { id: 1, name: 'Alice' };
            const builder = new DynamicQueryBuilder();
            const formatter = new SqlFormatter({ preset: 'postgres' });

            // Act
            const query = builder.buildQuery(sql, { filter });
            const { formattedSql, params } = formatter.format(query);

            // Assert
            expect(formattedSql).toBe(
                'with \"a\" as (select \"id\", \"name\" from \"table_a\" where \"name\" = $1) select * from \"a\" where \"id\" = $2'
            );
            expect(params).toEqual(['Alice', 1]);
        });

        it('throws when empty filter leaves a hardcoded placeholder without a value', () => {
            // Arrange
            const sql = 'select * from users where id = :user_id';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const filter = {};

            // Assert
            expect(() => ParameterDetector.separateFilters(query, filter)).toThrow(
                /Missing values for hardcoded placeholders .*:user_id/
            );
        });
    });
});
