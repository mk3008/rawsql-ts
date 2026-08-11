import { VALID_PRESETS, type SqlFormatterOptions } from './SqlFormatter';

/** Stable failure categories reported when external formatter options are invalid. */
export type SqlFormatterOptionsValidationErrorCode =
    | 'SQL_FORMATTER_OPTIONS_NOT_OBJECT'
    | 'SQL_FORMATTER_OPTION_UNKNOWN'
    | 'SQL_FORMATTER_OPTION_VALUE_INVALID';

/** A typed validation failure from {@link parseSqlFormatterOptions}. */
export class SqlFormatterOptionsValidationError extends Error {
    /** Stable machine-readable failure category. */
    readonly code: SqlFormatterOptionsValidationErrorCode;
    /** Formatter option associated with the failure, when applicable. */
    readonly optionName?: string;

    /**
     * @param code Stable machine-readable failure category.
     * @param message Human-readable validation failure.
     * @param optionName Formatter option associated with the failure, when applicable.
     */
    constructor(code: SqlFormatterOptionsValidationErrorCode, message: string, optionName?: string) {
        super(message);
        this.name = 'SqlFormatterOptionsValidationError';
        this.code = code;
        this.optionName = optionName;
    }
}

type FormatterOptionName = keyof SqlFormatterOptions;
type FormatterOptionValue<Name extends FormatterOptionName> = Exclude<SqlFormatterOptions[Name], undefined>;
type FormatterOptionValidator<Name extends FormatterOptionName> =
    (value: unknown) => value is FormatterOptionValue<Name>;
// Required mapped keys detect option additions, while enumValidator requires
// every string-union member to be listed before the core package can compile.
type FormatterOptionValidators = {
    [Name in keyof Required<SqlFormatterOptions>]: FormatterOptionValidator<Name>;
};

const formatterOptionValidators = {
    andBreak: enumValidator<FormatterOptionValue<'andBreak'>>()('none', 'before', 'after'),
    betweenOneLine: isBoolean,
    caseOneLine: isBoolean,
    castStyle: enumValidator<FormatterOptionValue<'castStyle'>>()('postgres', 'standard'),
    columnAliasStyle: enumValidator<FormatterOptionValue<'columnAliasStyle'>>()('explicit', 'omit', 'as', 'implicit'),
    commaBreak: enumValidator<FormatterOptionValue<'commaBreak'>>()('none', 'before', 'after'),
    commentStyle: enumValidator<FormatterOptionValue<'commentStyle'>>()('block', 'smart'),
    constraintStyle: enumValidator<FormatterOptionValue<'constraintStyle'>>()('postgres', 'mysql'),
    cteCommaBreak: enumValidator<FormatterOptionValue<'cteCommaBreak'>>()('none', 'before', 'after'),
    exportComment: isExportComment,
    identifierEscape: isIdentifierEscape,
    identifierEscapeTarget: enumValidator<FormatterOptionValue<'identifierEscapeTarget'>>()('all', 'minimal'),
    inOneLine: isBoolean,
    indentChar: isString,
    indentNestedParentheses: isBoolean,
    indentSize: isNonNegativeInteger,
    insertColumnsOneLine: isBoolean,
    joinConditionContinuationIndent: isBoolean,
    joinConditionOrderByDeclaration: isBoolean,
    joinOnBreak: enumValidator<FormatterOptionValue<'joinOnBreak'>>()('none', 'before', 'after'),
    joinOneLine: isBoolean,
    keywordCase: enumValidator<FormatterOptionValue<'keywordCase'>>()('none', 'upper', 'lower', 'preserve'),
    newline: enumValidator<FormatterOptionValue<'newline'>>()('lf', 'crlf', 'cr', 'space', '\n', '\r\n', '\r', ' '),
    oneLineMaxLength: isOptionalLineLength,
    orBreak: enumValidator<FormatterOptionValue<'orBreak'>>()('none', 'before', 'after'),
    orderByDefaultDirectionStyle: enumValidator<FormatterOptionValue<'orderByDefaultDirectionStyle'>>()('omit', 'explicit'),
    parameterStyle: enumValidator<FormatterOptionValue<'parameterStyle'>>()('anonymous', 'indexed', 'named', 'original'),
    parameterSymbol: isParameterSymbol,
    parenthesesOneLine: isBoolean,
    preset: enumValidator<FormatterOptionValue<'preset'>>()(...VALID_PRESETS),
    sourceAliasStyle: enumValidator<FormatterOptionValue<'sourceAliasStyle'>>()('explicit', 'omit', 'as', 'implicit'),
    subqueryOneLine: isBoolean,
    valuesCommaBreak: enumValidator<FormatterOptionValue<'valuesCommaBreak'>>()('none', 'before', 'after'),
    valuesOneLine: isBoolean,
    whenOneLine: isBoolean,
    withClauseStyle: enumValidator<FormatterOptionValue<'withClauseStyle'>>()('standard', 'cte-oneline', 'full-oneline'),
} satisfies FormatterOptionValidators;

/**
 * Strictly parse untrusted input into formatter options.
 *
 * This trust-boundary API accepts only plain objects, rejects unknown own keys
 * and invalid values, omits undefined properties, and does not mutate its input.
 * The existing `SqlFormatter` constructor remains the typed internal API and
 * intentionally does not perform this strict check.
 *
 * @param value External JSON, MCP, or configuration input.
 * @returns A validated copy that can be passed directly to `SqlFormatter`.
 * @throws {SqlFormatterOptionsValidationError} When the input shape, option name,
 * or option value is invalid.
 *
 * API output shape review: this boundary returns validated options rather than
 * SQL or AST output, so it does not change formatter output or force reparsing.
 * @public
 */
export function parseSqlFormatterOptions(value: unknown): SqlFormatterOptions {
    if (!isPlainRecord(value)) {
        throw new SqlFormatterOptionsValidationError(
            'SQL_FORMATTER_OPTIONS_NOT_OBJECT',
            'SqlFormatter options must be a plain object.'
        );
    }

    const result: Record<string, unknown> = {};
    for (const propertyKey of Reflect.ownKeys(value)) {
        const optionName = String(propertyKey);
        if (typeof propertyKey !== 'string'
            || !Object.prototype.hasOwnProperty.call(formatterOptionValidators, optionName)) {
            throw new SqlFormatterOptionsValidationError(
                'SQL_FORMATTER_OPTION_UNKNOWN',
                `Unknown SqlFormatter option: ${optionName}.`,
                optionName
            );
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, propertyKey);
        if (!descriptor || !('value' in descriptor)) {
            throw new SqlFormatterOptionsValidationError(
                'SQL_FORMATTER_OPTION_VALUE_INVALID',
                `Invalid value for SqlFormatter option: ${optionName}.`,
                optionName
            );
        }
        const optionValue = descriptor.value as unknown;
        if (optionValue === undefined) {
            continue;
        }

        const validator = formatterOptionValidators[optionName as FormatterOptionName];
        if (!validator(optionValue)) {
            throw new SqlFormatterOptionsValidationError(
                'SQL_FORMATTER_OPTION_VALUE_INVALID',
                `Invalid value for SqlFormatter option: ${optionName}.`,
                optionName
            );
        }
        result[optionName] = copyOptionValue(optionValue);
    }

    return result as SqlFormatterOptions;
}

function copyOptionValue(value: unknown): unknown {
    if (isDelimiterPair(value)) {
        return { start: value.start, end: value.end };
    }
    return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function isNonNegativeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isDelimiterPair(value: unknown): value is { start: string; end: string } {
    if (!isPlainRecord(value)) {
        return false;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes('start') || !keys.includes('end')) {
        return false;
    }
    const start = Object.getOwnPropertyDescriptor(value, 'start');
    const end = Object.getOwnPropertyDescriptor(value, 'end');
    return Boolean(
        start && 'value' in start && typeof start.value === 'string'
        && end && 'value' in end && typeof end.value === 'string'
    );
}

function isIdentifierEscape(value: unknown): value is FormatterOptionValue<'identifierEscape'> {
    return enumValidator<Exclude<FormatterOptionValue<'identifierEscape'>, { start: string; end: string }>>()(
        'quote',
        'backtick',
        'bracket',
        'none'
    )(value) || isDelimiterPair(value);
}

function isParameterSymbol(value: unknown): value is FormatterOptionValue<'parameterSymbol'> {
    return typeof value === 'string' || isDelimiterPair(value);
}

function isExportComment(value: unknown): value is FormatterOptionValue<'exportComment'> {
    return typeof value === 'boolean'
        || enumValidator<Exclude<FormatterOptionValue<'exportComment'>, boolean>>()(
            'none',
            'full',
            'header-only',
            'top-header-only'
        )(value);
}

function isOptionalLineLength(value: unknown): value is FormatterOptionValue<'oneLineMaxLength'> {
    return value === null || isNonNegativeInteger(value);
}

function enumValidator<Expected extends string>() {
    return <const Values extends readonly Expected[]>(
        ...values: Values & ([Expected] extends [Values[number]] ? unknown : ['Missing formatter option value'])
    ): ((value: unknown) => value is Expected) => {
        return (value: unknown): value is Expected => typeof value === 'string' && values.includes(value as Expected);
    };
}
