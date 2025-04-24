import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SelectValueCollector } from '../../src/transformers/SelectValueCollector';
import { Formatter } from '../../src/transformers/Formatter';
import { FunctionCall, LiteralValue, ValueComponent, ValueList } from '../../src/models/ValueComponent';
import { ValueParser } from '../../src/parsers/ValueParser';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

describe('overrideSelectColumnExpression', () => {
    test('overrides a selectable column expression (accounting closing adjustment)', () => {
        // Arrange
        const query = SelectQueryParser.parse(`SELECT j.journal_date FROM journals j`) as SimpleSelectQuery;

        // Act
        query.overrideSelectItemRaw('journal_date', expr => `greatest(${expr}, DATE '2025-01-01')`);

        // Assert
        const formatter = new Formatter();
        const sql = formatter.format(query);
        expect(sql).toBe(`select greatest("j"."journal_date", DATE \'2025-01-01\') as "journal_date" from "journals" as "j"`);
    });
});
