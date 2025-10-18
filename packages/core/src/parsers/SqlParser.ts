import type { SelectQuery } from '../models/SelectQuery';
import { SqlTokenizer, StatementLexemeResult } from './SqlTokenizer';
import { SelectQueryParser } from './SelectQueryParser';

export type ParsedStatement = SelectQuery;

export interface SqlParserOptions {
    mode?: 'single' | 'multiple';
    skipEmptyStatements?: boolean;
}

export interface SqlParserManyOptions {
    skipEmptyStatements?: boolean;
}

/**
 * Canonical entry point for SQL parsing.
 * Today it delegates to SelectQueryParser, but it is designed to embrace INSERT/UPDATE/DDL parsers next.
 */
export class SqlParser {
    public static parse(sql: string, options: SqlParserOptions = {}): ParsedStatement {
        const skipEmpty = options.skipEmptyStatements ?? true;
        const mode = options.mode ?? 'single';
        const tokenizer = new SqlTokenizer(sql);

        // Acquire the first meaningful statement so future dispatching can inspect its leading keyword.
        const first = this.consumeNextStatement(tokenizer, 0, skipEmpty);
        if (!first) {
            throw new Error('[SqlParser] No SQL statements found in input.');
        }

        const parsed = this.dispatchParse(first.segment, 1);

        if (mode === 'single') {
            // Ensure callers opting into single-statement mode are protected against trailing statements.
            const remainder = this.consumeNextStatement(tokenizer, first.nextCursor, skipEmpty);
            if (remainder) {
                throw new Error('[SqlParser] Unexpected additional statement detected at index 2. Use parseMany or set mode to "multiple" to allow multiple statements.');
            }
        }

        return parsed;
    }

    public static parseMany(sql: string, options: SqlParserManyOptions = {}): ParsedStatement[] {
        const skipEmpty = options.skipEmptyStatements ?? true;
        const tokenizer = new SqlTokenizer(sql);
        const statements: ParsedStatement[] = [];
        let cursor = 0;
        let carry: string[] | null = null;
        let index = 0;

        while (true) {
            // Collect the next logical statement segment, carrying forward detached comments when necessary.
            const segment = tokenizer.readNextStatement(cursor, carry);
            carry = null;

            if (!segment) {
                break;
            }

            cursor = segment.nextPosition;

            if (segment.lexemes.length === 0) {
                // Preserve dangling comments so they can attach to the next real statement.
                if (segment.leadingComments && segment.leadingComments.length > 0) {
                    carry = segment.leadingComments;
                }
                if (skipEmpty || segment.rawText.trim().length === 0) {
                    continue;
                }
            }

            index++;
            statements.push(this.dispatchParse(segment, index));
        }

        return statements;
    }

    private static dispatchParse(segment: StatementLexemeResult, statementIndex: number): ParsedStatement {
        if (segment.lexemes.length === 0) {
            throw new Error(`[SqlParser] Statement ${statementIndex} does not contain any tokens.`);
        }

        const firstToken = segment.lexemes[0].value.toLowerCase();

        // Interpret common SELECT lead tokens including WITH-based CTEs and VALUES clauses.
        if (firstToken === 'select' || firstToken === 'with' || firstToken === 'values') {
            return this.parseSelectStatement(segment, statementIndex);
        }

        // Placeholder for future INSERT/UPDATE/DDL support.
        throw new Error(
            `[SqlParser] Statement ${statementIndex} starts with unsupported token "${segment.lexemes[0].value}". Support for additional statement types will be introduced soon.`
        );
    }

    private static parseSelectStatement(segment: StatementLexemeResult, statementIndex: number): SelectQuery {
        try {
            const result = SelectQueryParser.parseFromLexeme(segment.lexemes, 0);

            if (result.newIndex < segment.lexemes.length) {
                const unexpected = segment.lexemes[result.newIndex];
                const position = unexpected.position?.startPosition ?? segment.statementStart;
                throw new Error(
                    `[SqlParser] Unexpected token "${unexpected.value}" in statement ${statementIndex} at character ${position}.`
                );
            }

            return result.value;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`[SqlParser] Failed to parse SELECT statement ${statementIndex}: ${message}`);
        }
    }

    private static consumeNextStatement(
        tokenizer: SqlTokenizer,
        cursor: number,
        skipEmpty: boolean
    ): { segment: StatementLexemeResult; nextCursor: number } | null {
        let localCursor = cursor;
        let carry: string[] | null = null;

        // Advance until a statement with tokens is found or the input ends.
        while (true) {
            const segment = tokenizer.readNextStatement(localCursor, carry);
            carry = null;

            if (!segment) {
                return null;
            }

            localCursor = segment.nextPosition;

            if (segment.lexemes.length === 0) {
                // Retain comments so the next statement can inherit them when appropriate.
                if (segment.leadingComments && segment.leadingComments.length > 0) {
                    carry = segment.leadingComments;
                }
                if (skipEmpty || segment.rawText.trim().length === 0) {
                    continue;
                }
            }

            return { segment, nextCursor: localCursor };
        }
    }
}
