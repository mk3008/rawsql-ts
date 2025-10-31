import { describe, it, expect } from 'vitest';
import { DeleteQueryParser } from '../src/parsers/DeleteQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('SqlFormatter delete formatting', () => {
    it('preserves line comments around delete statements', () => {
        const sql = [
            '-- c1',
            'delete from users',
            'where',
            '    -- c2',
            '    active = false            -- c3',
            '    and -- c4',
            "    last_login_at < now() - interval '2 years'  -- c5",
            ';',
        ].join('\n');

        const deleteQuery = DeleteQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            exportComment: true,
            commentStyle: 'block',
            keywordCase: 'lower',
            newline: '\n',
        });

        const { formattedSql } = formatter.format(deleteQuery);

        const expected = [
            '/* c1 */',
            'delete from "users"',
            'where',
            '/* c2 */',
            '"active" = false /* c3 */',
            'and /* c4 */',
            '"last_login_at" < now() - interval \'2 years\' /* c5 */',
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });
});
