import { describe, it, expect } from 'vitest';
import { FixtureCteBuilder } from '../../src/transformers/FixtureCteBuilder';

describe('FixtureCteBuilder.fromJSON', () => {
    it('should convert JSON fixture definitions to FixtureTableDefinition format', () => {
        const json = {
            users: {
                columns: [
                    { name: 'id', type: 'integer' },
                    { name: 'name', type: 'text' }
                ],
                rows: [
                    { id: 1, name: 'Alice' },
                    { id: 2, name: 'Bob' }
                ]
            }
        };

        const fixtures = FixtureCteBuilder.fromJSON(json);

        expect(fixtures).toHaveLength(1);
        expect(fixtures[0].tableName).toBe('users');
        expect(fixtures[0].columns).toHaveLength(2);
        expect(fixtures[0].columns[0]).toEqual({ name: 'id', typeName: 'integer', defaultValue: undefined });
        expect(fixtures[0].columns[1]).toEqual({ name: 'name', typeName: 'text', defaultValue: undefined });
        expect(fixtures[0].rows).toHaveLength(2);
        expect(fixtures[0].rows[0]).toEqual([1, 'Alice']);
        expect(fixtures[0].rows[1]).toEqual([2, 'Bob']);
    });

    it('should handle single quotes in string values', () => {
        const json = {
            posts: {
                columns: [
                    { name: 'title', type: 'text' }
                ],
                rows: [
                    { title: "Bob's Post" }
                ]
            }
        };

        const fixtures = FixtureCteBuilder.fromJSON(json);

        expect(fixtures).toHaveLength(1);
        expect(fixtures[0].rows[0]).toEqual(["Bob's Post"]);
    });

    it('should handle null values', () => {
        const json = {
            users: {
                columns: [
                    { name: 'id', type: 'integer' },
                    { name: 'email', type: 'text' }
                ],
                rows: [
                    { id: 1, email: null }
                ]
            }
        };

        const fixtures = FixtureCteBuilder.fromJSON(json);

        expect(fixtures[0].rows[0]).toEqual([1, null]);
    });

    it('should handle missing values as null', () => {
        const json = {
            users: {
                columns: [
                    { name: 'id', type: 'integer' },
                    { name: 'name', type: 'text' },
                    { name: 'email', type: 'text' }
                ],
                rows: [
                    { id: 1, name: 'Alice' } // email is missing
                ]
            }
        };

        const fixtures = FixtureCteBuilder.fromJSON(json);

        expect(fixtures[0].rows[0]).toEqual([1, 'Alice', null]);
    });

    it('should handle empty rows array', () => {
        const json = {
            users: {
                columns: [
                    { name: 'id', type: 'integer' }
                ],
                rows: []
            }
        };

        const fixtures = FixtureCteBuilder.fromJSON(json);

        expect(fixtures[0].rows).toEqual([]);
    });

    it('should handle missing rows property', () => {
        const json = {
            users: {
                columns: [
                    { name: 'id', type: 'integer' }
                ]
            }
        };

        const fixtures = FixtureCteBuilder.fromJSON(json);

        expect(fixtures[0].rows).toEqual([]);
    });

    it('should handle multiple tables', () => {
        const json = {
            users: {
                columns: [{ name: 'id', type: 'integer' }],
                rows: [{ id: 1 }]
            },
            posts: {
                columns: [{ name: 'id', type: 'integer' }],
                rows: [{ id: 1 }]
            }
        };

        const fixtures = FixtureCteBuilder.fromJSON(json);

        expect(fixtures).toHaveLength(2);
        expect(fixtures[0].tableName).toBe('users');
        expect(fixtures[1].tableName).toBe('posts');
    });

    it('should handle column default values', () => {
        const json = {
            users: {
                columns: [
                    { name: 'id', type: 'integer', default: "nextval('users_id_seq')" },
                    { name: 'name', type: 'text' }
                ],
                rows: [{ id: 1, name: 'Alice' }]
            }
        };

        const fixtures = FixtureCteBuilder.fromJSON(json);

        expect(fixtures[0].columns[0].defaultValue).toBe("nextval('users_id_seq')");
    });

    it('should handle various data types', () => {
        const json = {
            test: {
                columns: [
                    { name: 'int_col', type: 'integer' },
                    { name: 'str_col', type: 'text' },
                    { name: 'bool_col', type: 'boolean' },
                    { name: 'null_col', type: 'text' }
                ],
                rows: [
                    { int_col: 42, str_col: 'hello', bool_col: true, null_col: null }
                ]
            }
        };

        const fixtures = FixtureCteBuilder.fromJSON(json);

        expect(fixtures[0].rows[0]).toEqual([42, 'hello', true, null]);
    });
});
