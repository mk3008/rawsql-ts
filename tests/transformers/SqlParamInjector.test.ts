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
        expect(formattedSql).toBe('select "a"."article_id", "a"."article_name", "a"."price" from "article" as "a" where "a"."price" >= :price_min and "a"."price" <= :price_max and "a"."article_name" LIKE :article_name');

        // Assert: parameters object matches expected state values
        expect(params).toEqual({ price_min: 10, price_max: 100, article_name: '%super%' });
    });
});
