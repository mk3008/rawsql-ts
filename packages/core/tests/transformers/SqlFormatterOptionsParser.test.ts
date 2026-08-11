import { describe, expect, it } from 'vitest';
import {
    parseSqlFormatterOptions,
    SelectQueryParser,
    SqlFormatter,
    SqlFormatterOptionsValidationError,
    type SqlFormatterOptions,
} from '../../src';

describe('parseSqlFormatterOptions', () => {
    it('parses empty and representative formatter options', () => {
        expect(parseSqlFormatterOptions({})).toEqual({});
        expect(parseSqlFormatterOptions({
            preset: 'postgres',
            keywordCase: 'upper',
            indentSize: 4,
            parameterSymbol: { start: ':', end: '' },
        })).toEqual({
            preset: 'postgres',
            keywordCase: 'upper',
            indentSize: 4,
            parameterSymbol: { start: ':', end: '' },
        });
    });

    it.each(Object.entries(validOptionExamples))('accepts the valid %s option category', (optionName, optionValue) => {
        expect(parseSqlFormatterOptions({ [optionName]: optionValue })).toEqual({ [optionName]: optionValue });
    });

    it.each([
        ['boolean export comments', 'exportComment', true],
        ['legacy join break alias', 'joinOnBreak', 'after'],
        ['custom indentation string', 'indentChar', '..'],
        ['raw newline control string', 'newline', '\r\n'],
    ])('preserves the supported %s value', (_label, optionName, optionValue) => {
        expect(parseSqlFormatterOptions({ [optionName]: optionValue })).toEqual({ [optionName]: optionValue });
    });

    it.each(['unknownOption', 'toString', 'constructor', '__proto__'])('rejects unknown own key %s', (optionName) => {
        const input = JSON.parse(`{"${optionName}":true}`) as unknown;

        expectValidationError(input, 'SQL_FORMATTER_OPTION_UNKNOWN', optionName);
    });

    it.each([
        ['invalid enum', { keywordCase: 'sideways' }, 'keywordCase'],
        ['invalid boolean', { valuesOneLine: 'yes' }, 'valuesOneLine'],
        ['negative integer', { indentSize: -1 }, 'indentSize'],
        ['fractional integer', { oneLineMaxLength: 1.5 }, 'oneLineMaxLength'],
        ['unsafe integer', { indentSize: Number.MAX_SAFE_INTEGER + 1 }, 'indentSize'],
        ['delimiter with missing end', { parameterSymbol: { start: ':' } }, 'parameterSymbol'],
        ['delimiter with extra key', { identifierEscape: { start: '[', end: ']', target: 'all' } }, 'identifierEscape'],
        ['delimiter with invalid value', { parameterSymbol: { start: ':', end: 1 } }, 'parameterSymbol'],
    ])('rejects %s', (_label, input, optionName) => {
        expectValidationError(input, 'SQL_FORMATTER_OPTION_VALUE_INVALID', optionName);
    });

    it.each([
        ['null', null],
        ['array', []],
        ['string', 'upper'],
        ['number', 1],
        ['boolean', true],
        ['custom prototype', Object.create({ keywordCase: 'upper' })],
    ])('rejects non-plain-object input: %s', (_label, input) => {
        expectValidationError(input, 'SQL_FORMATTER_OPTIONS_NOT_OBJECT');
    });

    it('rejects an accessor option without invoking external code', () => {
        let getterCalled = false;
        const input = {};
        Object.defineProperty(input, 'keywordCase', {
            enumerable: true,
            get: () => {
                getterCalled = true;
                throw new Error('Getter must not run.');
            },
        });

        expectValidationError(input, 'SQL_FORMATTER_OPTION_VALUE_INVALID', 'keywordCase');
        expect(getterCalled).toBe(false);
    });

    it('does not mutate or reuse mutable parts of the input', () => {
        const delimiter = { start: ':', end: '' };
        const input = { parameterSymbol: delimiter, keywordCase: 'upper', preset: undefined };
        const snapshot = structuredClone(input);

        const parsed = parseSqlFormatterOptions(input);

        expect(input).toEqual(snapshot);
        expect(parsed).toEqual({ parameterSymbol: delimiter, keywordCase: 'upper' });
        expect(parsed.parameterSymbol).not.toBe(delimiter);
    });

    it('returns options that can be passed directly to SqlFormatter', () => {
        const options: SqlFormatterOptions = parseSqlFormatterOptions({
            keywordCase: 'upper',
            parameterStyle: 'original',
        });
        const query = SelectQueryParser.parse('select :customer_id as customer_id');

        expect(new SqlFormatter(options).format(query).formattedSql).toContain('SELECT');
    });
});

const validOptionExamples = {
    andBreak: 'before',
    betweenOneLine: true,
    caseOneLine: true,
    castStyle: 'standard',
    columnAliasStyle: 'explicit',
    commaBreak: 'after',
    commentStyle: 'smart',
    constraintStyle: 'mysql',
    cteCommaBreak: 'before',
    exportComment: 'header-only',
    identifierEscape: 'backtick',
    identifierEscapeTarget: 'minimal',
    inOneLine: true,
    indentChar: 'tab',
    indentNestedParentheses: true,
    indentSize: 2,
    insertColumnsOneLine: true,
    joinConditionContinuationIndent: true,
    joinConditionOrderByDeclaration: true,
    joinOnBreak: 'before',
    joinOneLine: true,
    keywordCase: 'preserve',
    newline: 'lf',
    oneLineMaxLength: null,
    orBreak: 'after',
    orderByDefaultDirectionStyle: 'explicit',
    parameterStyle: 'original',
    parameterSymbol: '$',
    parenthesesOneLine: true,
    preset: 'sqlite',
    sourceAliasStyle: 'implicit',
    subqueryOneLine: true,
    valuesCommaBreak: 'after',
    valuesOneLine: true,
    whenOneLine: true,
    withClauseStyle: 'full-oneline',
} as const satisfies Required<SqlFormatterOptions>;

function expectValidationError(
    input: unknown,
    code: SqlFormatterOptionsValidationError['code'],
    optionName?: string
): void {
    try {
        parseSqlFormatterOptions(input);
        throw new Error('Expected formatter option validation to fail.');
    } catch (error) {
        expect(error).toBeInstanceOf(SqlFormatterOptionsValidationError);
        expect(error).toMatchObject({ code, optionName });
    }
}
