import { describe, it, expect } from 'vitest';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('SqlFormatter cast style', () => {
    it('emits ANSI CAST syntax by default', () => {
        const query = SelectQueryParser.parse('SELECT id::INTEGER FROM users');
        const sql = new SqlFormatter().format(query).formattedSql;

        expect(sql).toBe('select cast("id" as INTEGER) from "users"');
    });

    it('emits PostgreSQL :: syntax when preset requires it', () => {
        const query = SelectQueryParser.parse('SELECT id::INTEGER FROM users');
        const sql = new SqlFormatter({ preset: 'postgres' }).format(query).formattedSql;

        expect(sql).toBe('select "id"::INTEGER from "users"');
    });

    it('keeps PostgreSQL empty array constructors unquoted when emitting ANSI CAST syntax', () => {
        const query = SelectQueryParser.parse('SELECT array[]::text[]');
        const sql = new SqlFormatter().format(query).formattedSql;

        expect(sql).toBe('select cast(array[] as text[])');
    });

    it('keeps PostgreSQL empty array constructors unquoted inside function arguments', () => {
        const query = SelectQueryParser.parse('SELECT coalesce(tags.tag_slugs, array[]::text[]) FROM tags');
        const sql = new SqlFormatter().format(query).formattedSql;

        expect(sql).toBe('select coalesce("tags"."tag_slugs", cast(array[] as text[])) from "tags"');
    });

    it('keeps PostgreSQL empty array constructor casts in postgres preset function arguments', () => {
        const query = SelectQueryParser.parse('SELECT coalesce(tags.tag_slugs, array[]::text[]) FROM tags');
        const sql = new SqlFormatter({ preset: 'postgres' }).format(query).formattedSql;

        expect(sql).toBe('select coalesce("tags"."tag_slugs", array[]::text[]) from "tags"');
    });

    it('keeps PostgreSQL empty array constructors unquoted inside aggregate arguments', () => {
        const query = SelectQueryParser.parse('SELECT array_agg(array[]::text[] order by tag) FROM tags');
        const sql = new SqlFormatter().format(query).formattedSql;

        expect(sql).toBe('select array_agg(cast(array[] as text[]) order by "tag") from "tags"');
    });
});
