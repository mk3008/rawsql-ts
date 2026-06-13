import { describe, expect, it } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter order by default direction style', () => {
    it('omits ASC by default', () => {
        const query = SelectQueryParser.parse('select id from users order by created_at asc, id asc');
        const sql = new SqlFormatter().format(query).formattedSql;

        expect(sql).toBe('select "id" from "users" order by "created_at", "id"');
    });

    it('can render the default ASC direction explicitly', () => {
        const query = SelectQueryParser.parse('select id from users order by created_at asc, id asc');
        const sql = new SqlFormatter({ orderByDefaultDirectionStyle: 'explicit' }).format(query).formattedSql;

        expect(sql).toBe('select "id" from "users" order by "created_at" asc, "id" asc');
    });

    it('keeps DESC unchanged when ASC is explicit', () => {
        const query = SelectQueryParser.parse('select id from users order by created_at desc, id asc');
        const sql = new SqlFormatter({ orderByDefaultDirectionStyle: 'explicit' }).format(query).formattedSql;

        expect(sql).toBe('select "id" from "users" order by "created_at" desc, "id" asc');
    });

    it('renders ASC for order items that omit a direction', () => {
        const query = SelectQueryParser.parse('select * from ranked_customers rc order by rc.tier asc, rc.gross_amount desc, rc.customer_id');
        const sql = new SqlFormatter({
            identifierEscape: 'none',
            keywordCase: 'lower',
            commaBreak: 'before',
            sourceAliasStyle: 'implicit',
            orderByDefaultDirectionStyle: 'explicit'
        }).format(query).formattedSql;

        expect(sql).toContain('rc.customer_id asc');
    });
});
