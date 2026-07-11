import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { PRESETS } from '../../src/parsers/SqlPrintTokenParser';
import { Formatter } from '../../src/transformers/Formatter';
import { ParameterCollector } from '../../src/transformers/ParameterCollector';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const singleLineOptions = {
    identifierEscape: 'none' as const,
    keywordCase: 'lower' as const,
    newline: 'space' as const,
};

describe('SqlFormatter parameter collection fast path', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('formats a parameter-free query without a second ParameterCollector traversal', () => {
        const query = SelectQueryParser.parse('select id from users where active = true');
        const collectSpy = vi.spyOn(ParameterCollector, 'collect').mockImplementation(() => {
            throw new Error('formatter must not perform a second parameter collection traversal');
        });

        const result = new SqlFormatter(singleLineOptions).format(query);

        expect(result).toEqual({
            formattedSql: 'select id from users where active = true',
            params: {},
        });
        expect(collectSpy).not.toHaveBeenCalled();
    });

    it('retains appearance order, assigned indexes, SQL, and indexed parameter results', () => {
        const query = SelectQueryParser.parse(`
            with active_users as (
                select id from users where status = :status
            )
            select id from active_users where tenant_id = :tenant_id or owner_id = :owner_id
        `);
        const parameters = ParameterCollector.collect(query);
        parameters[0].value = 'active';
        parameters[1].value = 42;
        parameters[2].value = 7;
        const collectSpy = vi.spyOn(ParameterCollector, 'collect').mockImplementation(() => {
            throw new Error('formatter must use parameters observed during token construction');
        });

        const result = new SqlFormatter({
            ...singleLineOptions,
            parameterStyle: 'indexed',
            parameterSymbol: '$',
        }).format(query);

        expect(result.formattedSql).toBe(
            'with active_users as (select id from users where status = $1) '
            + 'select id from active_users where tenant_id = $2 or owner_id = $3'
        );
        expect(result.params).toEqual(['active', 42, 7]);
        expect(parameters.map((parameter) => parameter.index)).toEqual([1, 2, 3]);
        expect(parameters.map((parameter) => parameter.name.value)).toEqual([
            'status',
            'tenant_id',
            'owner_id',
        ]);
        expect(collectSpy).not.toHaveBeenCalled();
    });

    it('preserves anonymous parameter order and result compatibility', () => {
        const query = SelectQueryParser.parse('select id from users where tenant_id = :tenant and state = :state');
        query.setParameter('tenant', 42);
        query.setParameter('state', 'active');

        const result = new SqlFormatter({
            ...singleLineOptions,
            parameterStyle: 'anonymous',
            parameterSymbol: '?',
        }).format(query);

        expect(result).toEqual({
            formattedSql: 'select id from users where tenant_id = ? and state = ?',
            params: [42, 'active'],
        });
    });

    it('deduplicates equal named parameters and preserves conflicting-value errors', () => {
        const equalQuery = SelectQueryParser.parse('select id from users where owner_id = :id or delegate_id = :id');
        equalQuery.setParameter('id', 100);

        expect(new SqlFormatter({
            ...singleLineOptions,
            parameterStyle: 'named',
            parameterSymbol: '@',
        }).format(equalQuery)).toEqual({
            formattedSql: 'select id from users where owner_id = @id or delegate_id = @id',
            params: { id: 100 },
        });

        const conflictQuery = SelectQueryParser.parse('select id from users where owner_id = :id or delegate_id = :id');
        const conflictingParameters = ParameterCollector.collect(conflictQuery);
        conflictingParameters[0].value = 100;
        conflictingParameters[1].value = 200;

        expect(() => new SqlFormatter({
            ...singleLineOptions,
            parameterStyle: 'named',
            parameterSymbol: '@',
        }).format(conflictQuery)).toThrowError(
            "Duplicate parameter name 'id' with different values detected during query composition."
        );
    });

    it('preserves parsed parameter source spelling in original style', () => {
        const query = SelectQueryParser.parse(
            'select id from users where tenant_id = :tenant and owner_id = @owner and rank_id = $1 and state = ${state}'
        );

        const result = new SqlFormatter({
            ...singleLineOptions,
            parameterStyle: 'original',
        }).format(query);

        expect(result).toEqual({
            formattedSql: 'select id from users where tenant_id = :tenant and owner_id = @owner and rank_id = $1 and state = ${state}',
            params: {
                tenant: null,
                owner: null,
                '1': null,
                state: null,
            },
        });
    });

    it('keeps the legacy Formatter formatted-SQL-plus-params result contract', () => {
        const query = SelectQueryParser.parse('select id from users where tenant_id = :tenant and state = :state');
        query.setParameter('tenant', 42);
        query.setParameter('state', 'active');

        const result = new Formatter().formatWithParameters(query, PRESETS.postgres);

        expect(result).toEqual({
            sql: 'select "id" from "users" where "tenant_id" = $1 and "state" = $2',
            params: [42, 'active'],
        });
    });
});
