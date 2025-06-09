import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

/**
 * Test cases for explicit column mapping
 */
describe('SqlParamInjector explicit column mapping', () => {
    test('maps parameter name to different column name', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.u_name from users as u') as SimpleSelectQuery;

        // Arrange: parameter name differs from column name
        const state = {
            user_name: {
                column: 'u_name',
                like: '%Alice%'
            }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Uses the explicit column name but keeps parameter name
        expect(formattedSql).toBe('select "u"."u_name" from "users" as "u" where "u"."u_name" like :user_name_like');

        // Assert: Parameter name stays as the original key
        expect(params).toEqual({
            user_name_like: '%Alice%'
        });
    });

    test('explicit column mapping with multiple conditions', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select p.prc, p.p_name from products as p') as SimpleSelectQuery;

        // Arrange: multiple conditions with column mapping
        const state = {
            price_range: {
                column: 'prc',
                min: 100,
                max: 1000
            }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Uses mapped column with parentheses for multiple conditions
        expect(formattedSql).toBe('select "p"."prc", "p"."p_name" from "products" as "p" where ("p"."prc" >= :price_range_min and "p"."prc" <= :price_range_max)');

        // Assert: Parameter names use the original key
        expect(params).toEqual({
            price_range_min: 100,
            price_range_max: 1000
        });
    });

    test('mixed explicit and implicit column mapping', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.user_id, u.u_name, u.email from users as u') as SimpleSelectQuery;

        // Arrange: mix of explicit and implicit mapping
        const state = {
            user_id: 10,                    // implicit mapping (parameter name = column name)
            user_name: {                    // explicit mapping
                column: 'u_name',
                like: '%Alice%'
            },
            email: { like: '%@example.com' } // implicit mapping
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Correct column mapping for all conditions
        expect(formattedSql).toBe('select "u"."user_id", "u"."u_name", "u"."email" from "users" as "u" where "u"."user_id" = :user_id and "u"."u_name" like :user_name_like and "u"."email" like :email_like');

        // Assert: Parameter names maintain their original keys
        expect(params).toEqual({
            user_id: 10,
            user_name_like: '%Alice%',
            email_like: '%@example.com'
        });
    });

    test('explicit column mapping with simple value', () => {
        // Arrange: parse base query
        const baseQuery = SelectQueryParser.parse('select u.u_id from users as u') as SimpleSelectQuery;

        // Arrange: explicit mapping with simple value (not object)
        const state = {
            user_id: {
                column: 'u_id',
                '=': 42
            }
        };

        // Act: inject parameters into the query model
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        // Act: format SQL and extract parameters
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);

        // Assert: Uses mapped column for equality condition
        expect(formattedSql).toBe('select "u"."u_id" from "users" as "u" where "u"."u_id" = :user_id');

        // Assert: Parameter uses original key name
        expect(params).toEqual({
            user_id: 42
        });
    });
});
