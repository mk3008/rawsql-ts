import { IndentCharLogicalName, IndentCharOption, NewlineLogicalName, NewlineOption } from './LinePrinter';

export type IdentifierEscapeName = 'quote' | 'backtick' | 'bracket' | 'none';
export type IdentifierEscapeOption = IdentifierEscapeName | { start: string; end: string };

const INDENT_CHAR_MAP = {
    space: ' ',
    tab: '\t',
} as const satisfies Record<IndentCharLogicalName, string>;

const NEWLINE_MAP = {
    lf: '\n',
    crlf: '\r\n',
    cr: '\r',
} as const satisfies Record<NewlineLogicalName, '\n' | '\r\n' | '\r'>;

const IDENTIFIER_ESCAPE_MAP = {
    quote: { start: '"', end: '"' },
    backtick: { start: '`', end: '`' },
    bracket: { start: '[', end: ']' },
    none: { start: '', end: '' },
} as const satisfies Record<IdentifierEscapeName, { start: string; end: string }>;

export function resolveIndentCharOption(option?: IndentCharOption): IndentCharOption | undefined {
    if (option === undefined) {
        // Leave undefined so downstream defaults continue to apply.
        return undefined;
    }

    const normalized = typeof option === 'string' ? option.toLowerCase() : option;

    if (typeof normalized === 'string' && Object.prototype.hasOwnProperty.call(INDENT_CHAR_MAP, normalized)) {
        // Map logical names to their control character equivalents.
        return INDENT_CHAR_MAP[normalized as IndentCharLogicalName];
    }

    // Return the original value to preserve backward compatibility with control characters.
    return option;
}

export function resolveNewlineOption(option?: NewlineOption): NewlineOption | undefined {
    if (option === undefined) {
        // Preserve undefined so existing defaults stay intact.
        return undefined;
    }

    const normalized = typeof option === 'string' ? option.toLowerCase() : option;

    if (typeof normalized === 'string' && Object.prototype.hasOwnProperty.call(NEWLINE_MAP, normalized)) {
        // Translate logical newline names into their escape sequence counterparts.
        return NEWLINE_MAP[normalized as NewlineLogicalName];
    }

    // Return the provided raw newline to support legacy control character inputs.
    return option;
}

export function resolveIdentifierEscapeOption(option?: IdentifierEscapeOption): { start: string; end: string } | undefined {
    if (option === undefined) {
        // Allow undefined so presets can supply defaults.
        return undefined;
    }

    if (typeof option === 'string') {
        const normalized = option.toLowerCase() as IdentifierEscapeName;

        if (!Object.prototype.hasOwnProperty.call(IDENTIFIER_ESCAPE_MAP, normalized)) {
            throw new Error(`Unknown identifierEscape option: ${option}`);
        }

        // Spread into a new object to avoid mutating shared map entries.
        const mapped = IDENTIFIER_ESCAPE_MAP[normalized];
        return { start: mapped.start, end: mapped.end };
    }

    const start = option.start ?? '';
    const end = option.end ?? '';

    // Return a copy so callers do not mutate the input reference.
    return { start, end };
}
