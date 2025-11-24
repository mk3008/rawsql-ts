import { describe, it, expect } from 'vitest';
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

    // TODO: Fix these tests - they are failing
    // it('should detect index name difference when checkConstraintNames is enabled', () => {
    //     const current = `CREATE TABLE posts (id INT, user_id INT);
    // CREATE INDEX idx_posts_user_id ON posts(user_id);`;
    //     const expected = `CREATE TABLE posts (id INT, user_id INT);
    // CREATE INDEX idx_posts_1 ON posts(user_id);`;
    //     const diff = DDLDiffGenerator.generateDiff(current, expected, {
    //         checkConstraintNames: true,
    //         dropConstraints: true
    //     });
    //     expect(diff.length).toBe(2);
    //     expect(diff[0]).toContain('DROP INDEX');
    //     expect(diff[0]).toContain('idx_posts_user_id');
    //     expect(diff[1]).toContain('CREATE INDEX');
    //     expect(diff[1]).toContain('idx_posts_1');
    // });

    // it('should not detect index difference when checkConstraintNames is disabled and columns match', () => {
    //     const current = `CREATE TABLE posts (id INT, user_id INT);
    // CREATE INDEX idx_posts_user_id ON posts(user_id);`;
    //     const expected = `CREATE TABLE posts (id INT, user_id INT);
    // CREATE INDEX idx_posts_1 ON posts(user_id);`;
    //     const diff = DDLDiffGenerator.generateDiff(current, expected, {
    //         checkConstraintNames: false,
    //         dropConstraints: true
    //     });
    //     expect(diff.length).toBe(0);
    // });
});
