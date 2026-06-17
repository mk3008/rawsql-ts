import { describe, expect, it } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { BinaryExpression, ParameterExpression } from '../../src/models/ValueComponent';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';

describe('SqlFormatter parameter original style', () => {
    it('preserves parsed parameter placeholder spelling', () => {
        const query = SelectQueryParser.parse(
            'select * from users where tenant_id = :tenant_id and owner_id = @owner_id and rank_id = $1 and state = ${state}'
        );

        const formatter = new SqlFormatter({
            parameterStyle: 'original',
            keywordCase: 'lower',
            identifierEscape: 'none',
            newline: 'space'
        });

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(
            'select * from users where tenant_id = :tenant_id and owner_id = @owner_id and rank_id = $1 and state = ${state}'
        );
        expect(result.params).toEqual({
            tenant_id: null,
            owner_id: null,
            '1': null,
            state: null
        });
    });

    it('preserves anonymous parsed placeholders in output', () => {
        const query = SelectQueryParser.parse('select * from users where id = ?');

        const formatter = new SqlFormatter({
            parameterStyle: 'original',
            identifierEscape: 'none',
            newline: 'space'
        });

        const result = formatter.format(query);

        expect(result.formattedSql).toBe('select * from users where id = ?');
    });

    it('falls back to configured named output for generated parameters without source spelling', () => {
        const query = SelectQueryParser.parse('select id from users where id = :old_user_id') as SimpleSelectQuery;
        const condition = query.whereClause!.condition as BinaryExpression;
        condition.right = new ParameterExpression('user_id', 42);

        const formatter = new SqlFormatter({
            parameterStyle: 'original',
            parameterSymbol: '@',
            identifierEscape: 'none',
            newline: 'space'
        });

        const result = formatter.format(query);

        expect(result.formattedSql).toBe('select id from users where id = @user_id');
        expect(result.params).toEqual({ user_id: 42 });
    });

    it('still rewrites parsed parameters when a concrete output style is selected', () => {
        const query = SelectQueryParser.parse('select * from users where id = @user_id');

        const formatter = new SqlFormatter({
            parameterStyle: 'named',
            parameterSymbol: ':',
            identifierEscape: 'none',
            newline: 'space'
        });

        const result = formatter.format(query);

        expect(result.formattedSql).toBe('select * from users where id = :user_id');
        expect(result.params).toEqual({ user_id: null });
    });
});
