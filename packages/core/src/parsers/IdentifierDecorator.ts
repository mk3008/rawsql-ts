import { SQL_SPECIAL_VALUE_KEYWORDS } from "../utils/SqlSpecialValueKeywords";
import { TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";

export class IdentifierDecorator {
    start: string;
    end: string;
    target: 'all' | 'minimal';

    constructor(identifierEscape?: { start?: string; end?: string; target?: 'all' | 'minimal' }) {
        this.start = identifierEscape?.start ?? '"';
        this.end = identifierEscape?.end ?? '"';
        this.target = identifierEscape?.target ?? 'all';
    }

    decorate(text: string): string {
        if (this.target === 'minimal' && this.canRenderBare(text)) {
            return text;
        }
        return this.start + this.escapeIdentifierText(text) + this.end;
    }

    private canRenderBare(text: string): boolean {
        return /^[a-z_][a-z0-9_]*$/.test(text) &&
            !UNSAFE_BARE_IDENTIFIERS.has(text) &&
            this.isPlainIdentifierToken(text);
    }

    private isPlainIdentifierToken(text: string): boolean {
        const lexemes = new SqlTokenizer(text).readLexmes();
        return lexemes.length === 1 && lexemes[0].type === TokenType.Identifier && lexemes[0].value === text;
    }

    private escapeIdentifierText(text: string): string {
        if (!this.end) {
            return text;
        }
        return text.split(this.end).join(this.end + this.end);
    }
}

const UNSAFE_BARE_IDENTIFIERS = new Set([
    // Core SQL syntax and literals.
    'all',
    'and',
    'any',
    'as',
    'between',
    'by',
    'case',
    'cross',
    'delete',
    'distinct',
    'else',
    'end',
    'except',
    'exists',
    'false',
    'fetch',
    'for',
    'from',
    'full',
    'group',
    'having',
    'in',
    'inner',
    'insert',
    'intersect',
    'into',
    'is',
    'join',
    'left',
    'like',
    'limit',
    'not',
    'null',
    'offset',
    'on',
    'or',
    'order',
    'outer',
    'right',
    'select',
    'set',
    'table',
    'then',
    'true',
    'union',
    'update',
    'using',
    'values',
    'when',
    'where',
    'with',

    // SQL value keywords / special bare expressions.
    ...SQL_SPECIAL_VALUE_KEYWORDS
]);
