import { describe, it, expect } from 'vitest';
import { FixtureCteBuilder } from '../../src/transformers/FixtureCteBuilder';
import { LiteralValue } from '../../src/models/ValueComponent';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';

describe('FixtureCteBuilder BigInt Precision', () => {
    it('should preserve precision for large integers', () => {
        const largeInt = BigInt("9007199254740993"); // MAX_SAFE_INTEGER + 2

        const fixtures = [{
            tableName: 'users',
            columns: [{ name: 'id', typeName: 'bigint' }],
            rows: [[largeInt]]
        }];

        const commonTables = FixtureCteBuilder.buildFixtures(fixtures);
        const query = commonTables[0].query as SimpleSelectQuery;
        const selectItem = query.selectClause.items[0];

        // The value might be a CastExpression wrapping a LiteralValue
        // or just a LiteralValue depending on whether a type was specified
        let literalValue: LiteralValue;
        if ('input' in selectItem.value && 'castType' in selectItem.value) {
            // It's a CastExpression
            literalValue = (selectItem.value as any).input as LiteralValue;
        } else {
            literalValue = selectItem.value as LiteralValue;
        }

        // Check if the value is preserved as a string, not a number with precision loss
        // Number(9007199254740993n) -> 9007199254740992 (loss of precision)

        // We expect the value to be stored in a way that preserves the exact digits
        expect(literalValue.value).toBe("9007199254740993");
    });
});
