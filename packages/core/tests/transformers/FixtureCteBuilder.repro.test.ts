import { describe, it, expect } from 'vitest';
import { FixtureCteBuilder, FixtureTableDefinition } from '../../src/transformers/FixtureCteBuilder';
import { SqlPrinter } from '../../src/transformers/SqlPrinter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { SelectItem } from '../../src/models/Clause';
import { CastExpression, LiteralValue } from '../../src/models/ValueComponent';
import { SqlPrintTokenParser } from '../../src/parsers/SqlPrintTokenParser';

describe('FixtureCteBuilder Repro', () => {
    it('should correctly handle single quotes in fixture data', () => {
        const fixture: FixtureTableDefinition = {
            tableName: 'posts',
            columns: [{ name: 'title', typeName: 'text' }],
            rows: [['Bob\'s Post']]
        };

        const ctes = FixtureCteBuilder.buildFixtures([fixture]);
        const query = ctes[0].query;

        // Check the AST
        expect(query).toBeInstanceOf(SimpleSelectQuery);
        const simple = query as SimpleSelectQuery;
        const item = simple.selectClause.items[0];

        console.log('Item value type:', item.value.constructor.name);

        if (item.value instanceof CastExpression) {
            const cast = item.value as CastExpression;
            expect(cast.input).toBeInstanceOf(LiteralValue);
            const literal = cast.input as LiteralValue;
            // NEW: LiteralValue now stores the raw string value WITHOUT quotes
            expect(literal.value).toBe("Bob's Post");
            expect(literal.isStringLiteral).toBe(true);
        } else {
            // If not cast, maybe it's parsed differently?
            expect(item.value).toBeInstanceOf(CastExpression);
        }

        // Check the printed SQL
        const tokenParser = new SqlPrintTokenParser();
        const result = tokenParser.parse(query);
        const printer = new SqlPrinter();
        const sql = printer.print(result.token);

        console.log('Generated SQL:', sql);

        // It should be: SELECT CAST('Bob''s Post' AS text) AS "title"
        // The printer should escape the single quote
        expect(sql).toContain("'Bob''s Post'");
        expect(sql).not.toContain("'Bob''''s Post'");
    });
});
