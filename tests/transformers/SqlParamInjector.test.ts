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
});
