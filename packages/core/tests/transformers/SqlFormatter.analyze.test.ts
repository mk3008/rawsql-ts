import { describe, expect, it } from 'vitest';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { AnalyzeStatement } from '../../src/models/DDLStatements';
import { QualifiedName, IdentifierString } from '../../src/models/ValueComponent';

describe('SqlFormatter.analyze', () => {
    it('formats ANALYZE with verbose flag and column list', () => {
        const statement = new AnalyzeStatement({
            verbose: true,
            target: new QualifiedName(['public'], new IdentifierString('users')),
            columns: [new IdentifierString('id'), new IdentifierString('name')],
        });
        const formatter = new SqlFormatter();

        const { formattedSql } = formatter.format(statement);

        expect(formattedSql).toBe('analyze verbose "public"."users" ("id", "name")');
        expect(formattedSql).not.toContain('\n');
    });

    it('keeps ANALYZE column list on one line when commaBreak is after', () => {
        const statement = new AnalyzeStatement({
            verbose: true,
            target: new QualifiedName(['public'], new IdentifierString('users')),
            columns: [new IdentifierString('id'), new IdentifierString('name')],
        });
        const formatter = new SqlFormatter({ commaBreak: 'after' });

        const { formattedSql } = formatter.format(statement);

        expect(formattedSql).toBe('analyze verbose "public"."users" ("id", "name")');
        expect(formattedSql).not.toContain('\n');
    });

    it('formats minimal ANALYZE without target', () => {
        const statement = new AnalyzeStatement();
        const formatter = new SqlFormatter();

        const { formattedSql } = formatter.format(statement);

        expect(formattedSql).toBe('analyze');
    });
});
