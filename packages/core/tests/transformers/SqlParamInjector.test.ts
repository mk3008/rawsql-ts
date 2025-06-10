import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

describe('SqlParamInjector', () => {
    test('injects state into SelectQuery and produces SQL with parameters', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.user_id from users as u') as SimpleSelectQuery;

        // Arrange: prepare state object
        const state = { user_id: 10 };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL contains WHERE clause with named parameter
        expect(formattedSql).toBe('select "u"."user_id" from "users" as "u" where "u"."user_id" = :user_id');

        // Assert: parameters object matches original state
        expect(params).toEqual({ user_id: 10 });
    });

    test('injects range and LIKE parameters into SelectQuery for articles', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select a.article_id, a.article_name, a.price from article as a') as SimpleSelectQuery;

        // Arrange: prepare state object with price range and article_name LIKE search
        const state = {
            price: { min: 10, max: 100 },
            article_name: { like: '%super%' }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL contains conditions for price range and article_name LIKE query
        expect(formattedSql).toBe('select "a"."article_id", "a"."article_name", "a"."price" from "article" as "a" where ("a"."price" >= :price_min and "a"."price" <= :price_max) and "a"."article_name" like :article_name_like');

        // Assert: parameters object matches expected state values
        expect(params).toEqual({ price_min: 10, price_max: 100, article_name_like: '%super%' });
    });

    test('throws error when column is not found due to case/underscore differences', () => {
        // Arrange: parse base query with exactly named columns
        const baseQuery = SelectQueryParser.parse('select a.article_id, a.article_name from article as a') as SimpleSelectQuery;
        // Arrange: prepare state object with key differing in case/underscore (e.g., "articleId" instead of "article_id")
        const state = { articleId: 100 };

        // Act & Assert: expect injection to throw error because column "articleId" is not found (search is case sensitive and requires underscore)
        const injector = new SqlParamInjector();
        expect(() => {
            injector.inject(baseQuery, state);
        }).toThrowError(/Column 'articleId' not found in query/);
    });

    test('matches columns ignoring case and underscores when option enabled', () => {
        // Arrange: parse base query with exactly named columns
        const baseQuery = SelectQueryParser.parse('select a.article_id, a.article_name from article as a') as SimpleSelectQuery;
        // Arrange: prepare state object with key "articleId" that should match "article_id"
        const state = { articleId: 100 };

        // Act: inject parameters into the query model with option enabled
        const injector = new SqlParamInjector({ ignoreCaseAndUnderscore: true });
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: full SQL output must exactly match expected string
        expect(formattedSql).toBe('select "a"."article_id", "a"."article_name" from "article" as "a" where "a"."article_id" = :articleId');
        // Assert: parameters object matches expected state
        expect(params).toEqual({ articleId: 100 });
    });

    test('injects state using custom tableColumnResolver', () => {
        // Custom tableColumnResolver returns columns for "users" table
        const customResolver = (tableName: string) => {
            // For testing purposes, return fixed column names for the "users" table
            if (tableName.toLowerCase() === 'users') return ['user_id', 'created_at'];
            return [];
        };

        // Parse a base query with expected columns
        const baseQuery = SelectQueryParser.parse('select u.* from users as u') as SimpleSelectQuery;
        // Prepare state object matching columns from customResolver
        const state = { user_id: 20, created_at: '2020-01-01' };

        // Create injector with the customResolver
        const injector = new SqlParamInjector(customResolver);
        const injectedQuery = injector.inject(baseQuery, state);

        // Format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL and parameters correctly reflect the custom resolver mapping
        expect(formattedSql).toBe('select "u".* from "users" as "u" where "u"."user_id" = :user_id and "u"."created_at" = :created_at');
        expect(params).toEqual({ user_id: 20, created_at: '2020-01-01' });
    });

    test('injects state when query is provided as a string', () => {
        // Arrange: query string and state object
        const queryString = 'select u.user_id from users as u';
        const state = { user_id: 30 };

        // Act: inject parameters using query string
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(queryString, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL and parameters are correctly generated from a string query
        expect(formattedSql).toBe('select "u"."user_id" from "users" as "u" where "u"."user_id" = :user_id');
        expect(params).toEqual({ user_id: 30 });
    });

    test('injects full SQL with additional operator conditions for price', () => {
        // Arrange: parse base query with one column "price"
        const baseQuery = SelectQueryParser.parse('select a.price from article as a') as SimpleSelectQuery;

        // Arrange: prepare state with additional operator conditions for 'price'
        const state = {
            price: {
                in: [10, 20, 30],
                any: [100, 200],
                '<': 50,
                '>': 20,
                '!=': 25,
                '<>': 30,
                '<=': 45,
                '>=': 22,
            }
        };

        // Act: inject parameters using the state with additional operators
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Updated expected full SQL string with correct Postgres ANY syntax and parentheses for multiple conditions
        const expectedSql =
            'select "a"."price" from "article" as "a" where ' +
            '("a"."price" in (:price_in_0, :price_in_1, :price_in_2) and ' +
            '"a"."price" = any(:price_any) and ' +
            '"a"."price" < :price_lt and ' +
            '"a"."price" > :price_gt and ' +
            '"a"."price" != :price_neq and ' +
            '"a"."price" <> :price_ne and ' +
            '"a"."price" <= :price_le and ' +
            '"a"."price" >= :price_ge)';

        // Assert: full SQL string must exactly match expected value
        expect(formattedSql).toBe(expectedSql);

        // Assert: parameters object matches expected state values
        expect(params).toEqual({
            price_in_0: 10,
            price_in_1: 20,
            price_in_2: 30,
            price_any: [100, 200],
            price_lt: 50,
            price_gt: 20,
            price_neq: 25,
            price_ne: 30,
            price_le: 45,
            price_ge: 22
        });
    });

    test('injects explicit "=" operator and shorthand equality for price', () => {
        // State with explicit '='
        const stateWithEq = { price: { '=': 10 } };
        // Shorthand state
        const stateShorthand = { price: 10 };

        // Act & Assert for explicit '='
        let injector = new SqlParamInjector();
        let injected = injector.inject('select a.price from article as a', stateWithEq);
        let { formattedSql, params } = new SqlFormatter().format(injected);
        expect(formattedSql).toBe('select "a"."price" from "article" as "a" where "a"."price" = :price');
        expect(params).toEqual({ price: 10 });

        // Act & Assert for shorthand
        injector = new SqlParamInjector();
        injected = injector.inject('select a.price from article as a', stateShorthand);
        ({ formattedSql, params } = new SqlFormatter().format(injected));
        expect(formattedSql).toBe('select "a"."price" from "article" as "a" where "a"."price" = :price');
        expect(params).toEqual({ price: 10 });
    });

    test('supports various primitive types including Date and null', () => {
        // Arrange: select multiple columns
        const baseQuery = SelectQueryParser.parse(
            'select u.count, u.ratio, u.active, u.deleted, u.created_at from users as u'
        ) as SimpleSelectQuery;
        const now = new Date('2020-01-01T00:00:00.000Z');
        const state = {
            count: 42,
            ratio: 3.14,
            active: true,
            deleted: null,           // explicit null should produce a filter
            created_at: now
        };

        // Act: inject and format
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);
        const { formattedSql, params } = new SqlFormatter().format(injectedQuery);

        // Assert: SQL string includes deleted filter when null is explicit
        expect(formattedSql).toBe(
            'select "u"."count", "u"."ratio", "u"."active", "u"."deleted", "u"."created_at" ' +
            'from "users" as "u" where ' +
            '"u"."count" = :count and ' +
            '"u"."ratio" = :ratio and ' +
            '"u"."active" = :active and ' +
            '"u"."deleted" = :deleted and ' +
            '"u"."created_at" = :created_at'
        );
        // Assert: params object holds correct values (including deleted:null)
        expect(params).toEqual({
            count: 42,
            ratio: 3.14,
            active: true,
            deleted: null,
            created_at: now
        });
    });

    test('ignores undefined state values', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.id from users as u') as SimpleSelectQuery;
        // State with undefined value should be skipped
        const state = { id: undefined };
        // Act: inject and format
        const injector = new SqlParamInjector();
        const injected = injector.inject(baseQuery, state);
        const { formattedSql, params } = new SqlFormatter().format(injected);
        // Assert: no WHERE and empty params
        expect(formattedSql).toBe('select "u"."id" from "users" as "u"');
        expect(params).toEqual({});
    });

    /*
    coding time exception test
    test('throws error for unsupported operator in state', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select a.price from article as a') as SimpleSelectQuery;
        // Arrange: state with an unsupported key "test"
        const state = { price: { test: 'bad' } };

        // Act & Assert: injection must throw an unsupported-operator error
        const injector = new SqlParamInjector();
        expect(() => injector.inject(baseQuery, state))
            .toThrowError(/Unsupported operator 'test'/);
    });
    */
});

