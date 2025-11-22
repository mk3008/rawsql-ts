import { describe, it, expect } from 'vitest';
import { DDLToFixtureConverter } from '../../src/transformers/DDLToFixtureConverter';

describe('DDLToFixtureConverter', () => {
    it('should convert simple CREATE TABLE', () => {
        const sql = `CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT
        );`;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(fixture).toEqual({
            users: {
                columns: [
                    { name: 'id', type: 'INTEGER', default: undefined },
                    { name: 'name', type: 'TEXT', default: undefined }
                ],
                rows: []
            }
        });
    });

    it('should handle default values', () => {
        const sql = `CREATE TABLE users (
            id INTEGER DEFAULT 1,
            name TEXT DEFAULT 'Alice',
            created_at TIMESTAMP DEFAULT now()
        );`;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(fixture.users.columns).toEqual([
            { name: 'id', type: 'INTEGER', default: '1' },
            { name: 'name', type: 'TEXT', default: "'Alice'" },
            { name: 'created_at', type: 'TIMESTAMP', default: 'now()' }
        ]);
    });

    it('should handle multiple tables', () => {
        const sql = `
            CREATE TABLE users (id INT);
            CREATE TABLE posts (id INT);
        `;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(Object.keys(fixture)).toEqual(['users', 'posts']);
    });

    it('should ignore non-DDL statements', () => {
        const sql = `
            CREATE TABLE users (id INT);
            INSERT INTO users VALUES (1);
            SELECT * FROM users;
        `;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(Object.keys(fixture)).toEqual(['users']);
    });

    it('should handle schema qualifiers', () => {
        const sql = `CREATE TABLE public.users (id INT);`;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(Object.keys(fixture)).toEqual(['public.users']);
    });
});
