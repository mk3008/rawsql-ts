import { describe, test, expect } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { FormatterConfig } from '../../src/transformers/FormatterConfig';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

describe('Formatter (pretty print) - From', () => {
    test('from clause with pretty indent and join', () => {
        const query = SelectQueryParser.parse('select * from users as u inner join posts as p on u.user_id = p.user_id') as SimpleSelectQuery;
        const config: FormatterConfig = {
            oneLiner: false,
            clauseIndent: { select: false, from: true },
            indentType: 'space',
            indentSize: 4,
        };
        const formatter = new Formatter({}, config);
        const sql = formatter.format(query);
        expect(sql).toBe(
            `select *\nfrom\n    "users" as "u"\n    inner join "posts" as "p" on "u"."user_id" = "p"."user_id"`
        );
    });
});
