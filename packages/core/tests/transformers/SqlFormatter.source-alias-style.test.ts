import { describe, expect, it } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter source alias style', () => {
    it('renders source aliases with explicit AS by default', () => {
        const query = SelectQueryParser.parse('select u.id from users u join accounts a on a.user_id = u.id');
        const sql = new SqlFormatter().format(query).formattedSql;

        expect(sql).toBe('select "u"."id" from "users" as "u" join "accounts" as "a" on "a"."user_id" = "u"."id"');
    });

    it('can render source aliases without inserting optional AS keywords', () => {
        const query = SelectQueryParser.parse('select u.id from users u join accounts a on a.user_id = u.id');
        const sql = new SqlFormatter({ sourceAliasStyle: 'omit' }).format(query).formattedSql;

        expect(sql).toBe('select "u"."id" from "users" "u" join "accounts" "a" on "a"."user_id" = "u"."id"');
    });

    it('keeps the legacy implicit source alias style value working', () => {
        const query = SelectQueryParser.parse('select u.id from users u');
        const sql = new SqlFormatter({ sourceAliasStyle: 'implicit' }).format(query).formattedSql;

        expect(sql).toBe('select "u"."id" from "users" "u"');
    });

    it('keeps the legacy as source alias style value working', () => {
        const query = SelectQueryParser.parse('select u.id from users u');
        const sql = new SqlFormatter({ sourceAliasStyle: 'as' }).format(query).formattedSql;

        expect(sql).toBe('select "u"."id" from "users" as "u"');
    });

    it('accepts explicit as the preferred source alias keyword value', () => {
        const query = SelectQueryParser.parse('select u.id from users u');
        const sql = new SqlFormatter({ sourceAliasStyle: 'explicit' }).format(query).formattedSql;

        expect(sql).toBe('select "u"."id" from "users" as "u"');
    });

    it('keeps column aliases explicit when source aliases are implicit', () => {
        const query = SelectQueryParser.parse('select u.id as user_id from users u');
        const sql = new SqlFormatter({ sourceAliasStyle: 'omit' }).format(query).formattedSql;

        expect(sql).toBe('select "u"."id" as "user_id" from "users" "u"');
    });
});
