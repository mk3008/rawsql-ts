import { describe, it, expect, test } from 'vitest';
import { DDLDiffGenerator } from '../../src/transformers/DDLDiffGenerator';

describe('DDLDiffGenerator', () => {
    it('should generate CREATE TABLE for missing table', () => {
        const current = '';
        const expected = `CREATE TABLE users (id INT)`;
        const diff = DDLDiffGenerator.generateDiff(current, expected);
        expect(diff.length).toBe(1);
        expect(diff[0]).toContain('CREATE TABLE "users"');
    });

    it('should generate ALTER TABLE ADD COLUMN', () => {
        const current = `CREATE TABLE users (id INT)`;
        const expected = `CREATE TABLE users (id INT, name TEXT)`;
        const diff = DDLDiffGenerator.generateDiff(current, expected);
        expect(diff.length).toBe(1);
        expect(diff[0]).toContain('ALTER TABLE "users" ADD COLUMN "name" TEXT');
    });

    it('should generate ALTER TABLE ADD CONSTRAINT', () => {
        const current = `CREATE TABLE users (id INT)`;
        const expected = `CREATE TABLE users (id INT PRIMARY KEY)`;
        const diff = DDLDiffGenerator.generateDiff(current, expected);
        expect(diff.length).toBe(1);
        expect(diff[0]).toContain('ALTER TABLE "users" ADD PRIMARY KEY("id")');
    });

    it('should handle drop columns if enabled', () => {
        const current = `CREATE TABLE users (id INT, name TEXT)`;
        const expected = `CREATE TABLE users (id INT)`;
        const diff = DDLDiffGenerator.generateDiff(current, expected, { dropColumns: true });
        expect(diff.length).toBe(1);
        expect(diff[0]).toContain('ALTER TABLE "users" DROP COLUMN "name"');
    });

    it('should handle drop constraints if enabled', () => {
        const current = `CREATE TABLE users (id INT CONSTRAINT pk_users PRIMARY KEY)`;
        const expected = `CREATE TABLE users (id INT)`;
        const diff = DDLDiffGenerator.generateDiff(current, expected, { dropConstraints: true });
        expect(diff.length).toBe(1);
        expect(diff[0]).toContain('ALTER TABLE "users" DROP CONSTRAINT "pk_users"');
    });

    it('should not drop constraints if disabled', () => {
        const current = `CREATE TABLE users (id INT CONSTRAINT pk_users PRIMARY KEY)`;
        const expected = `CREATE TABLE users (id INT)`;
        const diff = DDLDiffGenerator.generateDiff(current, expected, { dropConstraints: false });
        expect(diff.length).toBe(0);
    });

    test('should drop index with different name when checkConstraintNames is true', () => {
        const sql1 = `
            CREATE TABLE users (id INTEGER);
            CREATE INDEX idx_users_id ON users(id);
        `;
        const sql2 = `
            CREATE TABLE users (id INTEGER);
            CREATE INDEX idx_users_id_v2 ON users(id);
        `;

        const diffs = DDLDiffGenerator.generateDiff(sql1, sql2, {
            checkConstraintNames: true
        });

        expect(diffs.length).toBe(2);
        expect(diffs[0]).toContain('CREATE INDEX');
        expect(diffs[0]).toContain('idx_users_id_v2');
        expect(diffs[1]).toContain('DROP INDEX');
        expect(diffs[1]).toContain('idx_users_id');
    });

    test('should not drop index with different name when checkConstraintNames is false', () => {
        const sql1 = `
            CREATE TABLE users (id INTEGER);
            CREATE INDEX idx_users_id ON users(id);
        `;
        const sql2 = `
            CREATE TABLE users (id INTEGER);
            CREATE INDEX idx_users_id_v2 ON users(id);
        `;

        const diffs = DDLDiffGenerator.generateDiff(sql1, sql2, {
            checkConstraintNames: false
        });

        expect(diffs.length).toBe(0);
    });

    test('should not drop primary key with different name even when checkConstraintNames is true', () => {
        const sql1 = `
            CREATE TABLE posts (
                id INTEGER,
                user_id INTEGER,
                title TEXT
            );
            ALTER TABLE posts ADD CONSTRAINT pkey PRIMARY KEY (id);
        `;
        const sql2 = `
            CREATE TABLE posts (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                title TEXT
            );
        `;

        const diffs = DDLDiffGenerator.generateDiff(sql1, sql2, {
            checkConstraintNames: true,
            dropConstraints: true
        });

        expect(diffs.length).toBe(0);
    });
});
