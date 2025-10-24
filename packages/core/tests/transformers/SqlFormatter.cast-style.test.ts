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
});
