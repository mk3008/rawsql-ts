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

    it('should process INSERT statements', () => {
        const sql = `
            CREATE TABLE users (id INT, name TEXT);
            INSERT INTO users VALUES (1, 'Alice');
            INSERT INTO users (name, id) VALUES ('Bob', 2);
        `;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(fixture.users.rows).toEqual([
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" }
        ]);
    });

    it('should handle default values in INSERT', () => {
        const sql = `
            CREATE TABLE users (
                id INT, 
                active BOOLEAN DEFAULT true,
                role TEXT DEFAULT 'user'
            );
            INSERT INTO users (id) VALUES (1);
        `;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(fixture.users.rows[0]).toEqual({
            id: 1,
            active: true,
            role: 'user'
        });
    });

    it('should normalize DEFAULT NULL literals to actual null', () => {
        const sql = `
            CREATE TABLE records (
                id INT,
                numeric_null INT DEFAULT NULL,
                quoted_null TEXT DEFAULT 'NULL',
                mixed_case_null TEXT DEFAULT 'nUlL',
                bool_flag BOOLEAN DEFAULT false
            );
            INSERT INTO records (id) VALUES (1);
        `;

        const fixture = DDLToFixtureConverter.convert(sql);
        expect(fixture.records.rows[0]).toEqual({
            id: 1,
            numeric_null: null,
            quoted_null: null,
            mixed_case_null: null,
            bool_flag: false
        });
    });

    it('should handle nextval sequences', () => {
        const sql = `
            CREATE TABLE users (
                id INT DEFAULT nextval('users_id_seq'),
                name TEXT
            );
            INSERT INTO users (name) VALUES ('Alice');
            INSERT INTO users (name) VALUES ('Bob');
        `;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(fixture.users.rows).toEqual([
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" }
        ]);
    });

    it('should handle timestamp defaults', () => {
        const sql = `
            CREATE TABLE logs (
                msg TEXT,
                created_at TIMESTAMP DEFAULT now()
            );
            INSERT INTO logs (msg) VALUES ('test');
        `;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(fixture.logs.rows[0].msg).toBe("test");
        expect(fixture.logs.rows[0].created_at).toBe("2023-01-01 00:00:00");
    });

    it('should throw error for missing NOT NULL column without default', () => {
        const sql = `
            CREATE TABLE users (
                id INT NOT NULL,
                name TEXT
            );
            INSERT INTO users (name) VALUES ('Alice');
        `;
        expect(() => DDLToFixtureConverter.convert(sql)).toThrow(/cannot be null/);
    });

    it('should ignore INSERTs for unknown tables', () => {
        const sql = `
            CREATE TABLE users (id INT);
            INSERT INTO unknown_table VALUES (1);
        `;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(Object.keys(fixture)).toEqual(['users']);
        expect(fixture.users.rows).toEqual([]);
    });

    it('should ignore unsupported INSERT forms', () => {
        const sql = `
            CREATE TABLE users (id INT);
            INSERT INTO users SELECT * FROM other_table;
        `;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(fixture.users.rows).toEqual([]);
    });

    it('should handle schema qualifiers', () => {
        const sql = `
            CREATE TABLE public.users (id INT);
            INSERT INTO public.users VALUES (1);
        `;
        const fixture = DDLToFixtureConverter.convert(sql);
        expect(Object.keys(fixture)).toEqual(['public.users']);
        expect(fixture['public.users'].rows).toEqual([{ id: 1 }]);
    });

    it('should apply ALTER TABLE SET DEFAULT to fixture metadata and inserts', () => {
        const sql = `
            CREATE SEQUENCE t_seq2;

            CREATE TABLE t_default_nextval_alter (
              id bigint PRIMARY KEY,
              name text
            );

            ALTER TABLE t_default_nextval_alter
              ALTER COLUMN id SET DEFAULT nextval('t_seq2');

            INSERT INTO t_default_nextval_alter (name) VALUES ('Alice');
            INSERT INTO t_default_nextval_alter (name) VALUES ('Bob');
        `;

        const fixture = DDLToFixtureConverter.convert(sql);
        expect(fixture.t_default_nextval_alter.columns).toEqual([
            { name: 'id', type: 'bigint', default: "nextval('t_seq2')" },
            { name: 'name', type: 'text', default: undefined }
        ]);
        expect(fixture.t_default_nextval_alter.rows).toEqual([
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' }
        ]);
    });

    it('should apply ALTER TABLE SET DEFAULT for non-sequence expressions', () => {
        const sql = `
            CREATE TABLE t_default_now_alter (
              message text,
              created_at timestamptz
            );

            ALTER TABLE t_default_now_alter
              ALTER COLUMN created_at SET DEFAULT now();

            INSERT INTO t_default_now_alter (message) VALUES ('hello');
        `;

        const fixture = DDLToFixtureConverter.convert(sql);
        expect(fixture.t_default_now_alter.columns).toEqual([
            { name: 'message', type: 'text', default: undefined },
            { name: 'created_at', type: 'timestamptz', default: 'now()' }
        ]);
        expect(fixture.t_default_now_alter.rows).toEqual([
            { message: 'hello', created_at: '2023-01-01 00:00:00' }
        ]);
    });
});
