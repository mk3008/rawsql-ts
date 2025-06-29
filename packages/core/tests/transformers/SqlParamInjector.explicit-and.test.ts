import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

/**
 * Test cases for explicit AND conditions using and: [] syntax
 */
describe('SqlParamInjector explicit AND conditions', () => {
    test('basic explicit AND conditions', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select p.price from products as p') as SimpleSelectQuery;

        // Arrange: explicit AND conditions
        const state = {
            price_range: {
                and: [
                    { column: 'price', min: 100 },
                    { column: 'price', max: 1000 }
                ]
            }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Explicit AND conditions are combined
        expect(formattedSql).toBe('select "p"."price" from "products" as "p" where "p"."price" >= :price_range_and_0_min and "p"."price" <= :price_range_and_1_max');

        // Assert: Parameter names include and index
        expect(params).toEqual({
            price_range_and_0_min: 100,
            price_range_and_1_max: 1000
        });
    });

    test('explicit AND across different columns', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select p.price, p.name, p.category_id from products as p') as SimpleSelectQuery;

        // Arrange: AND conditions across different columns
        const state = {
            search_criteria: {
                and: [
                    { column: 'name', like: '%phone%' },
                    { column: 'price', min: 100 },
                    { column: 'category_id', '=': 5 }
                ]
            }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Each AND condition is added separately with AND logic
        expect(formattedSql).toBe('select "p"."price", "p"."name", "p"."category_id" from "products" as "p" where "p"."name" like :search_criteria_and_0_like and "p"."price" >= :search_criteria_and_1_min and "p"."category_id" = :search_criteria_and_2_eq');

        // Assert: All parameters are present
        expect(params).toEqual({
            search_criteria_and_0_like: '%phone%',
            search_criteria_and_1_min: 100,
            search_criteria_and_2_eq: 5
        });
    });

    test('multiple explicit AND groups', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select p.price, p.name, p.stock from products as p') as SimpleSelectQuery;

        // Arrange: multiple AND groups
        const state = {
            price_range: {
                and: [
                    { column: 'price', min: 100 },
                    { column: 'price', max: 1000 }
                ]
            },
            inventory: {
                and: [
                    { column: 'stock', '>': 0 },
                    { column: 'name', like: '%available%' }
                ]
            }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Both AND groups are processed
        expect(formattedSql).toBe('select "p"."price", "p"."name", "p"."stock" from "products" as "p" where "p"."price" >= :price_range_and_0_min and "p"."price" <= :price_range_and_1_max and "p"."stock" > :inventory_and_0_gt and "p"."name" like :inventory_and_1_like');

        // Assert: All parameters with correct naming
        expect(params).toEqual({
            price_range_and_0_min: 100,
            price_range_and_1_max: 1000,
            inventory_and_0_gt: 0,
            inventory_and_1_like: '%available%'
        });
    });

    test('single condition in explicit AND', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select p.name from products as p') as SimpleSelectQuery;

        // Arrange: single condition in AND array
        const state = {
            search: {
                and: [
                    { column: 'name', like: '%phone%' }
                ]
            }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Single condition is processed correctly
        expect(formattedSql).toBe('select "p"."name" from "products" as "p" where "p"."name" like :search_and_0_like');

        // Assert: Parameter naming is consistent
        expect(params).toEqual({
            search_and_0_like: '%phone%'
        });
    });

    test('explicit AND with multiple operators per condition', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select p.price, p.discount from products as p') as SimpleSelectQuery;

        // Arrange: multiple operators in single AND condition
        const state = {
            complex_range: {
                and: [
                    { column: 'price', min: 100, max: 1000 },  // This should create multiple conditions
                    { column: 'discount', '>': 0 }
                ]
            }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Each operator creates a separate condition
        expect(formattedSql).toBe('select "p"."price", "p"."discount" from "products" as "p" where "p"."price" >= :complex_range_and_0_min and "p"."price" <= :complex_range_and_0_max and "p"."discount" > :complex_range_and_1_gt');

        // Assert: All parameters are present
        expect(params).toEqual({
            complex_range_and_0_min: 100,
            complex_range_and_0_max: 1000,
            complex_range_and_1_gt: 0
        });
    });
});
