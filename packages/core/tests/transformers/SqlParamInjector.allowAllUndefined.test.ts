import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

describe('SqlParamInjector - allowAllUndefined option', () => {
    test('throws error by default when all parameters are undefined', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.id, u.name from users as u') as SimpleSelectQuery;
        // State with all undefined values
        const state = { id: undefined, name: undefined };

        // Act & Assert: expect injection to throw error by default
        const injector = new SqlParamInjector();
        expect(() => {
            injector.inject(baseQuery, state);
        }).toThrowError(/All parameters are undefined/);
    });

    test('throws error by default when single parameter is undefined', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.id from users as u') as SimpleSelectQuery;
        // State with single undefined value
        const state = { id: undefined };

        // Act & Assert: expect injection to throw error by default
        const injector = new SqlParamInjector();
        expect(() => {
            injector.inject(baseQuery, state);
        }).toThrowError(/All parameters are undefined/);
    });

    test('allows all undefined parameters when allowAllUndefined is true', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.id, u.name from users as u') as SimpleSelectQuery;
        // State with all undefined values
        const state = { id: undefined, name: undefined };

        // Act: inject parameters with allowAllUndefined option
        const injector = new SqlParamInjector({ allowAllUndefined: true });
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL should have no WHERE clause and empty params
        expect(formattedSql).toBe('select "u"."id", "u"."name" from "users" as "u"');
        expect(params).toEqual({});
    });

    test('allows single undefined parameter when allowAllUndefined is true', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.id from users as u') as SimpleSelectQuery;
        // State with single undefined value
        const state = { id: undefined };

        // Act: inject parameters with allowAllUndefined option
        const injector = new SqlParamInjector({ allowAllUndefined: true });
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL should have no WHERE clause and empty params
        expect(formattedSql).toBe('select "u"."id" from "users" as "u"');
        expect(params).toEqual({});
    });

    test('works normally when not all parameters are undefined', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.id, u.name from users as u') as SimpleSelectQuery;
        // State with mixed defined and undefined values
        const state = { id: 123, name: undefined };

        // Act: inject parameters (should work normally)
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL should contain WHERE clause with only defined parameter
        expect(formattedSql).toBe('select "u"."id", "u"."name" from "users" as "u" where "u"."id" = :id');
        expect(params).toEqual({ id: 123 });
    });

    test('works normally with empty state object', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.id from users as u') as SimpleSelectQuery;
        // Empty state object
        const state = {};

        // Act: inject parameters (should work normally)
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL should have no WHERE clause and empty params
        expect(formattedSql).toBe('select "u"."id" from "users" as "u"');
        expect(params).toEqual({});
    });

    test('allowAllUndefined works with tableColumnResolver constructor', () => {
        // Custom tableColumnResolver
        const customResolver = (tableName: string) => {
            if (tableName.toLowerCase() === 'users') return ['id', 'name'];
            return [];
        };

        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.* from users as u') as SimpleSelectQuery;
        // State with all undefined values
        const state = { id: undefined, name: undefined };

        // Act: inject parameters with allowAllUndefined option and custom resolver
        const injector = new SqlParamInjector(customResolver, { allowAllUndefined: true });
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: SQL should have no WHERE clause and empty params
        expect(formattedSql).toBe('select "u".* from "users" as "u"');
        expect(params).toEqual({});
    });

    test('throws error with tableColumnResolver when allowAllUndefined is false', () => {
        // Custom tableColumnResolver
        const customResolver = (tableName: string) => {
            if (tableName.toLowerCase() === 'users') return ['id', 'name'];
            return [];
        };

        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.* from users as u') as SimpleSelectQuery;
        // State with all undefined values
        const state = { id: undefined, name: undefined };

        // Act & Assert: expect injection to throw error
        const injector = new SqlParamInjector(customResolver);
        expect(() => {
            injector.inject(baseQuery, state);
        }).toThrowError(/All parameters are undefined/);
    });
});