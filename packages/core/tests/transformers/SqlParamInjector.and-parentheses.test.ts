import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

/**
 * Test cases for parentheses in AND conditions (implicit AND from multiple operators)
 */
describe('SqlParamInjector AND conditions with parentheses', () => {
    test('single condition does not get parentheses', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select a.price from articles as a') as SimpleSelectQuery;

        // Arrange: single condition
        const state = {
            price: { min: 100 }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: No parentheses for single condition
        expect(formattedSql).toBe('select "a"."price" from "articles" as "a" where "a"."price" >= :price_min');

        // Assert: parameters object matches
        expect(params).toEqual({
            price_min: 100
        });
    });

    test('multiple conditions get wrapped in parentheses', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select a.price from articles as a') as SimpleSelectQuery;

        // Arrange: multiple conditions (implicit AND)
        const state = {
            price: { min: 100, max: 1000 }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Multiple conditions wrapped in parentheses
        expect(formattedSql).toBe('select "a"."price" from "articles" as "a" where ("a"."price" >= :price_min and "a"."price" <= :price_max)');

        // Assert: parameters object matches
        expect(params).toEqual({
            price_min: 100,
            price_max: 1000
        });
    });

    test('three conditions get wrapped in parentheses', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select a.price, a.name from articles as a') as SimpleSelectQuery;

        // Arrange: three conditions on price
        const state = {
            price: { min: 100, max: 1000, '!=': 500 }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Three conditions wrapped in parentheses
        expect(formattedSql).toBe('select "a"."price", "a"."name" from "articles" as "a" where ("a"."price" >= :price_min and "a"."price" <= :price_max and "a"."price" != :price_neq)');

        // Assert: parameters object matches
        expect(params).toEqual({
            price_min: 100,
            price_max: 1000,
            price_neq: 500
        });
    });

    test('multiple parameters with mixed conditions', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select a.price, a.name, a.active from articles as a') as SimpleSelectQuery;

        // Arrange: mix of single and multiple conditions
        const state = {
            price: { min: 100, max: 1000 }, // multiple - should get parentheses
            name: { like: '%phone%' },      // single - no parentheses
            active: true                    // simple - no parentheses
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Only price conditions get parentheses
        expect(formattedSql).toBe('select "a"."price", "a"."name", "a"."active" from "articles" as "a" where ("a"."price" >= :price_min and "a"."price" <= :price_max) and "a"."name" like :name_like and "a"."active" = :active');

        // Assert: parameters object matches
        expect(params).toEqual({
            price_min: 100,
            price_max: 1000,
            name_like: '%phone%',
            active: true
        });
    });
});
