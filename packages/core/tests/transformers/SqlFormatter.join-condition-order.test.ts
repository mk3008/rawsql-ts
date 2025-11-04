import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter joinConditionOrderByDeclaration option', () => {
    const sql = [
        'select *',
        'from account a',
        'inner join invoice i on i.account_id = a.id and i.region = a.region',
    ].join('\n');

    it('keeps operand order unchanged by default', () => {
        // Parse the unformatted SQL once so formatter settings are the only variable.
        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
        });

        // Format without the declaration-order option to capture baseline behavior.
        const result = formatter.format(query);

        const expected = [
            'select',
            '  *',
            'from',
            '  "account" as "a"',
            '  inner join "invoice" as "i" on "i"."account_id" = "a"."id" and "i"."region" = "a"."region"',
        ].join('\n');

        expect(result.formattedSql).toBe(expected);
    });

    it('reorders JOIN comparisons by table declaration when enabled', () => {
        // Reuse the same AST to ensure the option alone triggers the normalization.
        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
            joinConditionOrderByDeclaration: true,
        });

        // Format with the option enabled so the left operand follows declaration order.
        const result = formatter.format(query);

        const expected = [
            'select',
            '  *',
            'from',
            '  "account" as "a"',
            '  inner join "invoice" as "i" on "a"."id" = "i"."account_id" and "a"."region" = "i"."region"',
        ].join('\n');

        expect(result.formattedSql).toBe(expected);
    });
});
