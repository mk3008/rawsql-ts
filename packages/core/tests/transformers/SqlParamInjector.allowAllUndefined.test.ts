/**
 * Tests for SqlParamInjector - allowAllUndefined option
 * 
 * This test suite validates the SqlParamInjector's allowAllUndefined option
 * which prevents accidental full-table queries when all parameters are undefined.
 * 
 * The SqlParamInjector transforms SQL by injecting WHERE conditions based on 
 * parameter values, and this new option ensures safety by requiring explicit
 * permission when all parameters would be ignored.
 */

import { describe, it, expect } from 'vitest';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlParamInjector allowAllUndefined option', () => {
    const formatter = new SqlFormatter();

    describe('inject', () => {
        it('should throw error by default when all parameters are undefined to prevent accidental full-table queries', () => {
            // Arrange
            const injector = new SqlParamInjector();
            const inputQuery = 'select u.id, u.name from users as u';
            const state = { id: undefined, name: undefined };

            // Act & Assert
            expect(() => {
                injector.inject(inputQuery, state);
            }).toThrowError(/All parameters are undefined/);
        });

        it('should throw error by default when single parameter is undefined', () => {
            // Arrange
            const injector = new SqlParamInjector();
            const inputQuery = 'select u.id from users as u';
            const state = { id: undefined };

            // Act & Assert
            expect(() => {
                injector.inject(inputQuery, state);
            }).toThrowError(/All parameters are undefined/);
        });

        it('should allow all undefined parameters when allowAllUndefined option is explicitly set to true', () => {
            // Arrange
            const injector = new SqlParamInjector({ allowAllUndefined: true });
            const inputQuery = 'select u.id, u.name from users as u';
            const state = { id: undefined, name: undefined };

            // Act
            const result = injector.inject(inputQuery, state);
            const { formattedSql, params } = formatter.format(result);

            // Assert
            const expectedSql = 'select "u"."id", "u"."name" from "users" as "u"';
            const expectedParams = {};
            
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual(expectedParams);
        });

        it('should allow single undefined parameter when allowAllUndefined option is true', () => {
            // Arrange
            const injector = new SqlParamInjector({ allowAllUndefined: true });
            const inputQuery = 'select u.id from users as u';
            const state = { id: undefined };

            // Act
            const result = injector.inject(inputQuery, state);
            const { formattedSql, params } = formatter.format(result);

            // Assert
            const expectedSql = 'select "u"."id" from "users" as "u"';
            const expectedParams = {};
            
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual(expectedParams);
        });

        it('should work normally when not all parameters are undefined regardless of allowAllUndefined setting', () => {
            // Arrange
            const injector = new SqlParamInjector();
            const inputQuery = 'select u.id, u.name from users as u';
            const state = { id: 123, name: undefined };

            // Act
            const result = injector.inject(inputQuery, state);
            const { formattedSql, params } = formatter.format(result);

            // Assert
            const expectedSql = 'select "u"."id", "u"."name" from "users" as "u" where "u"."id" = :id';
            const expectedParams = { id: 123 };
            
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual(expectedParams);
        });

        it('should work normally with empty state object without throwing error', () => {
            // Arrange
            const injector = new SqlParamInjector();
            const inputQuery = 'select u.id from users as u';
            const state = {};

            // Act
            const result = injector.inject(inputQuery, state);
            const { formattedSql, params } = formatter.format(result);

            // Assert
            const expectedSql = 'select "u"."id" from "users" as "u"';
            const expectedParams = {};
            
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual(expectedParams);
        });

        it('should support allowAllUndefined option with custom tableColumnResolver constructor', () => {
            // Arrange
            const customResolver = (tableName: string) => {
                if (tableName.toLowerCase() === 'users') return ['id', 'name'];
                return [];
            };
            const injector = new SqlParamInjector(customResolver, { allowAllUndefined: true });
            const inputQuery = 'select u.* from users as u';
            const state = { id: undefined, name: undefined };

            // Act
            const result = injector.inject(inputQuery, state);
            const { formattedSql, params } = formatter.format(result);

            // Assert
            const expectedSql = 'select "u".* from "users" as "u"';
            const expectedParams = {};
            
            expect(formattedSql).toBe(expectedSql);
            expect(params).toEqual(expectedParams);
        });

        it('should throw error with custom tableColumnResolver when allowAllUndefined is false by default', () => {
            // Arrange
            const customResolver = (tableName: string) => {
                if (tableName.toLowerCase() === 'users') return ['id', 'name'];
                return [];
            };
            const injector = new SqlParamInjector(customResolver);
            const inputQuery = 'select u.* from users as u';
            const state = { id: undefined, name: undefined };

            // Act & Assert
            expect(() => {
                injector.inject(inputQuery, state);
            }).toThrowError(/All parameters are undefined/);
        });
    });
});