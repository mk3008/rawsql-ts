import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

/**
 * Test cases for OR condition support in SqlParamInjector
 */
describe('SqlParamInjector OR conditions', () => {
    test('injects OR conditions for phone number search', () => {
        // Arrange: parse base query with explicit columns
        const baseQuery = SelectQueryParser.parse('select c.tel1, c.tel2 from customer as c') as SimpleSelectQuery;

        // Arrange: prepare state object with OR conditions
        const state = {
            tel: {
                or: [
                    { column: 'tel1', like: '%080%' },
                    { column: 'tel2', like: '%080%' }
                ]
            }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL contains OR conditions wrapped in parentheses
        expect(formattedSql).toBe('select "c"."tel1", "c"."tel2" from "customer" as "c" where ("c"."tel1" like :tel_or_0_like or "c"."tel2" like :tel_or_1_like)');

        // Assert: parameters object contains the OR condition parameters
        expect(params).toEqual({
            tel_or_0_like: '%080%',
            tel_or_1_like: '%080%'
        });
    });

    test('injects OR conditions with multiple operators', () => {
        // Arrange: parse base query with explicit columns
        const baseQuery = SelectQueryParser.parse('select p.name, p.price, p.category_id from product as p') as SimpleSelectQuery;

        // Arrange: prepare state object with OR conditions using different operators
        const state = {
            search: {
                or: [
                    { column: 'name', like: '%phone%' },
                    { column: 'price', min: 100, max: 1000 },
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

        // Assert: SQL contains complex OR conditions
        expect(formattedSql).toBe('select "p"."name", "p"."price", "p"."category_id" from "product" as "p" where ("p"."name" like :search_or_0_like or ("p"."price" >= :search_or_1_min and "p"."price" <= :search_or_1_max) or "p"."category_id" = :search_or_2_eq)');

        // Assert: parameters object contains all OR condition parameters
        expect(params).toEqual({
            search_or_0_like: '%phone%',
            search_or_1_min: 100,
            search_or_1_max: 1000,
            search_or_2_eq: 5
        });
    });

    test('combines OR conditions with regular AND conditions', () => {
        // Arrange: parse base query with explicit columns
        const baseQuery = SelectQueryParser.parse('select c.active, c.tel1, c.tel2, c.region from customer as c') as SimpleSelectQuery;

        // Arrange: prepare state object with both OR and regular conditions
        const state = {
            active: true,
            tel: {
                or: [
                    { column: 'tel1', like: '%080%' },
                    { column: 'tel2', like: '%080%' }
                ]
            },
            region: 'Tokyo'
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL contains both OR and AND conditions
        expect(formattedSql).toBe('select "c"."active", "c"."tel1", "c"."tel2", "c"."region" from "customer" as "c" where "c"."active" = :active and ("c"."tel1" like :tel_or_0_like or "c"."tel2" like :tel_or_1_like) and "c"."region" = :region');

        // Assert: parameters object contains all parameters
        expect(params).toEqual({
            active: true,
            tel_or_0_like: '%080%',
            tel_or_1_like: '%080%',
            region: 'Tokyo'
        });
    });

    test('injects OR conditions with ilike for case-insensitive search', () => {
        // Arrange: parse base query with explicit columns
        const baseQuery = SelectQueryParser.parse('select u.first_name, u.last_name, u.email from users as u') as SimpleSelectQuery;

        // Arrange: prepare state object with OR conditions using ilike
        const state = {
            search: {
                or: [
                    { column: 'first_name', ilike: '%john%' },
                    { column: 'last_name', ilike: '%smith%' },
                    { column: 'email', like: '%@example.com' }
                ]
            }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL contains OR conditions with both ilike and like
        expect(formattedSql).toBe('select "u"."first_name", "u"."last_name", "u"."email" from "users" as "u" where ("u"."first_name" ilike :search_or_0_ilike or "u"."last_name" ilike :search_or_1_ilike or "u"."email" like :search_or_2_like)');

        // Assert: parameters object contains the OR condition parameters
        expect(params).toEqual({
            search_or_0_ilike: '%john%',
            search_or_1_ilike: '%smith%',
            search_or_2_like: '%@example.com'
        });
    });
});
