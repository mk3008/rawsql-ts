import { describe, expect, it } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const formatMinimal = (sql: string): string => {
    const query = SelectQueryParser.parse(sql);
    return new SqlFormatter({
        preset: 'postgres',
        identifierEscapeTarget: 'minimal'
    }).format(query).formattedSql;
};

describe('SqlFormatter identifierEscape minimal', () => {
    it('removes quotes from safe lowercase identifiers', () => {
        expect(formatMinimal('select "email" from "public"."users"')).toBe('select email from public.users');
    });

    it('keeps quotes when unquoting would produce SQL special expressions', () => {
        expect(formatMinimal('select "current_user", "current_timestamp" from "users"')).toBe(
            'select "current_user", "current_timestamp" from users'
        );
    });

    it('keeps quotes for system information identifiers that would become special expressions', () => {
        expect(formatMinimal('select "current_catalog", "current_role", "current_schema", "session_user", "user" from "users"')).toBe(
            'select "current_catalog", "current_role", "current_schema", "session_user", "user" from users'
        );
    });

    it('does not quote bare SQL special expressions parsed as values', () => {
        expect(formatMinimal('select current_timestamp, current_user, session_user, user from users')).toBe(
            'select current_timestamp, current_user, session_user, user from users'
        );
    });

    it('treats qualified SQL special value words as identifiers', () => {
        expect(formatMinimal('select users.current_user, users.current_timestamp from current_user')).toBe(
            'select users."current_user", users."current_timestamp" from "current_user"'
        );
    });

    it('keeps quotes for reserved words, mixed case, and invalid bare identifier shapes', () => {
        expect(formatMinimal('select "select", "UserName", "user-id", "test text" from "table"')).toBe(
            'select "select", "UserName", "user-id", "test text" from "table"'
        );
    });

    it('keeps quotes for existing tokenizer keywords not listed as core SQL syntax', () => {
        expect(formatMinimal('select "lateral", "window", "key", "date" from "users"')).toBe(
            'select "lateral", "window", key, "date" from users'
        );
    });

    it('applies the same minimal rule to each qualified name part', () => {
        expect(formatMinimal('select "users"."email", "users"."current_timestamp" from "users"')).toBe(
            'select users.email, users."current_timestamp" from users'
        );
    });

    it('uses the preset symbol when minimal quoting is required', () => {
        const query = SelectQueryParser.parse('select "current_timestamp" from "users"');
        const formattedSql = new SqlFormatter({
            preset: 'mysql',
            identifierEscapeTarget: 'minimal'
        }).format(query).formattedSql;

        expect(formattedSql).toBe('select `current_timestamp` from users');
    });

    it('combines minimal target with an explicit escape symbol', () => {
        const query = SelectQueryParser.parse('select "current_timestamp", "email" from "users"');
        const formattedSql = new SqlFormatter({
            identifierEscape: 'backtick',
            identifierEscapeTarget: 'minimal'
        }).format(query).formattedSql;

        expect(formattedSql).toBe('select `current_timestamp`, email from users');
    });
});
