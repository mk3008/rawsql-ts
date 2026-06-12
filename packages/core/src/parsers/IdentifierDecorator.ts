export type IdentifierEscapeMode = 'all' | 'minimal';

export class IdentifierDecorator {
    start: string;
    end: string;
    mode: IdentifierEscapeMode;

    constructor(identifierEscape?: { start?: string; end?: string }, mode: IdentifierEscapeMode = 'all') {
        this.start = identifierEscape?.start ?? '"';
        this.end = identifierEscape?.end ?? '"';
        this.mode = mode;
    }

    decorate(text: string): string {
        if (!this.start && !this.end) {
            return text;
        }
        if (this.mode === 'minimal' && !this.needsEscape(text)) {
            return text;
        }
        return this.start + text + this.end;
    }

    private needsEscape(text: string): boolean {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) {
            return true;
        }
        return RESERVED_WORDS.has(text.toLowerCase());
    }
}

const RESERVED_WORDS = new Set([
    'all',
    'and',
    'as',
    'between',
    'by',
    'case',
    'create',
    'delete',
    'distinct',
    'else',
    'end',
    'exists',
    'false',
    'from',
    'group',
    'having',
    'in',
    'insert',
    'into',
    'is',
    'join',
    'left',
    'like',
    'limit',
    'not',
    'null',
    'on',
    'or',
    'order',
    'right',
    'select',
    'set',
    'then',
    'true',
    'union',
    'update',
    'user',
    'values',
    'when',
    'where',
    'with',
]);
