import { describe, test, expect } from 'vitest';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('SqlFormatter VALUES comments', () => {
    test('preserves comments around VALUES tuples', () => {
        const formatter = new SqlFormatter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            exportComment: true,
            valuesCommaBreak: 'before'
        });

        const sql = `--c1
values
--c2
(1, 'Alice'),
(2, 'Bob')
--c3`;

        const result = formatter.format(SelectQueryParser.parse(sql));

        expect(result.formattedSql).toContain('/* c1 */');
        expect(result.formattedSql).toContain('/* c2 */');
        expect(result.formattedSql).toContain("(1, 'Alice')");
        expect(result.formattedSql).toContain('/* c3 */');
    });
});
