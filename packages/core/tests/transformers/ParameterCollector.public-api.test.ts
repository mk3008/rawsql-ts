import { describe, expect, it } from 'vitest';
import { ParameterCollector, SelectQueryParser } from '../../src';

describe('ParameterCollector public API', () => {
    it('preserves occurrence order and original placeholder spelling', () => {
        const query = SelectQueryParser.parse(
            'select * from users where tenant_id = :tenant and owner_id = :tenant and rank_id = $1 and state = ?'
        );

        const parameters = ParameterCollector.collect(query);

        expect(parameters.map((parameter) => ({
            name: parameter.name.value,
            sourceText: parameter.sourceText,
        }))).toEqual([
            { name: 'tenant', sourceText: ':tenant' },
            { name: 'tenant', sourceText: ':tenant' },
            { name: '1', sourceText: '$1' },
            { name: '', sourceText: '?' },
        ]);
    });
});
