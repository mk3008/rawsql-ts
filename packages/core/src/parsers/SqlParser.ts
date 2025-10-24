import type { Lexeme } from '../models/Lexeme';
import type { SelectQuery } from '../models/SelectQuery';
import type { InsertQuery } from '../models/InsertQuery';
import type { UpdateQuery } from '../models/UpdateQuery';
import type { DeleteQuery } from '../models/DeleteQuery';
import type { CreateTableQuery } from '../models/CreateTableQuery';
import type { MergeQuery } from '../models/MergeQuery';
import type {
    DropTableStatement,
    DropIndexStatement,
    CreateIndexStatement,
    AlterTableStatement,
    DropConstraintStatement
} from '../models/DDLStatements';
import { SqlTokenizer, StatementLexemeResult } from './SqlTokenizer';
import { SelectQueryParser } from './SelectQueryParser';
import { InsertQueryParser } from './InsertQueryParser';
import { UpdateQueryParser } from './UpdateQueryParser';
import { DeleteQueryParser } from './DeleteQueryParser';
import { CreateTableParser } from './CreateTableParser';
import { MergeQueryParser } from './MergeQueryParser';
import { WithClauseParser } from './WithClauseParser';
import { DropTableParser } from './DropTableParser';
import { DropIndexParser } from './DropIndexParser';
import { CreateIndexParser } from './CreateIndexParser';
import { AlterTableParser } from './AlterTableParser';
import { DropConstraintParser } from './DropConstraintParser';

export type ParsedStatement =
    | SelectQuery
    | InsertQuery
    | UpdateQuery
    | DeleteQuery
    | CreateTableQuery
    | MergeQuery
    | DropTableStatement
    | DropIndexStatement
    | CreateIndexStatement
    | AlterTableStatement
    | DropConstraintStatement;

export interface SqlParserOptions {
    mode?: 'single' | 'multiple';
    skipEmptyStatements?: boolean;
}

export interface SqlParserManyOptions {
    skipEmptyStatements?: boolean;
}

/**
 * Canonical entry point for SQL parsing.
 * Delegates to dedicated parsers for SELECT, INSERT, UPDATE, and DELETE statements, and is designed to embrace additional statement types next.
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

        if (firstToken === 'with') {
            const commandAfterWith = this.getCommandAfterWith(segment.lexemes);
            if (commandAfterWith === 'insert into') {
                return this.parseInsertStatement(segment, statementIndex);
            }
            if (commandAfterWith === 'update') {
                return this.parseUpdateStatement(segment, statementIndex);
            }
            if (commandAfterWith === 'delete from') {
                return this.parseDeleteStatement(segment, statementIndex);
            }
            if (commandAfterWith === 'merge into') {
                return this.parseMergeStatement(segment, statementIndex);
            }
            return this.parseSelectStatement(segment, statementIndex);
        }

        if (firstToken === 'select' || firstToken === 'values') {
            return this.parseSelectStatement(segment, statementIndex);
        }

        if (firstToken === 'insert into') {
            return this.parseInsertStatement(segment, statementIndex);
        }

        if (firstToken === 'update') {
            return this.parseUpdateStatement(segment, statementIndex);
        }

        if (firstToken === 'delete from') {
            return this.parseDeleteStatement(segment, statementIndex);
        }

        if (firstToken === 'create table' || firstToken === 'create temporary table') {
            return this.parseCreateTableStatement(segment, statementIndex);
        }

        if (firstToken === 'merge into') {
            return this.parseMergeStatement(segment, statementIndex);
        }

        if (firstToken === 'create index' || firstToken === 'create unique index') {
            return this.parseCreateIndexStatement(segment, statementIndex);
        }

        if (firstToken === 'drop table') {
            return this.parseDropTableStatement(segment, statementIndex);
        }

        if (firstToken === 'drop index') {
            return this.parseDropIndexStatement(segment, statementIndex);
        }

        if (firstToken === 'alter table') {
            return this.parseAlterTableStatement(segment, statementIndex);
        }

        if (firstToken === 'drop constraint') {
            return this.parseDropConstraintStatement(segment, statementIndex);
        }

        throw new Error(`[SqlParser] Statement ${statementIndex} starts with unsupported token "${segment.lexemes[0].value}". Support for additional statement types will be introduced soon.`);
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

    private static parseInsertStatement(segment: StatementLexemeResult, statementIndex: number): InsertQuery {
        try {
            const result = InsertQueryParser.parseFromLexeme(segment.lexemes, 0);

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
            throw new Error(`[SqlParser] Failed to parse INSERT statement ${statementIndex}: ${message}`);
        }
    }

    private static parseUpdateStatement(segment: StatementLexemeResult, statementIndex: number): UpdateQuery {
        try {
            const result = UpdateQueryParser.parseFromLexeme(segment.lexemes, 0);

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
            throw new Error(`[SqlParser] Failed to parse UPDATE statement ${statementIndex}: ${message}`);
        }
    }

    private static parseDeleteStatement(segment: StatementLexemeResult, statementIndex: number): DeleteQuery {
        try {
            const result = DeleteQueryParser.parseFromLexeme(segment.lexemes, 0);

            // Guard against trailing tokens that would indicate multiple statements in DELETE parsing.
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
            throw new Error(`[SqlParser] Failed to parse DELETE statement ${statementIndex}: ${message}`);
        }
    }

    private static parseCreateTableStatement(segment: StatementLexemeResult, statementIndex: number): CreateTableQuery {
        try {
            const result = CreateTableParser.parseFromLexeme(segment.lexemes, 0);

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
            throw new Error(`[SqlParser] Failed to parse CREATE TABLE statement ${statementIndex}: ${message}`);
        }
    }

    private static parseDropTableStatement(segment: StatementLexemeResult, statementIndex: number): DropTableStatement {
        try {
            const result = DropTableParser.parseFromLexeme(segment.lexemes, 0);
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
            throw new Error(`[SqlParser] Failed to parse DROP TABLE statement ${statementIndex}: ${message}`);
        }
    }

    private static parseDropIndexStatement(segment: StatementLexemeResult, statementIndex: number): DropIndexStatement {
        try {
            const result = DropIndexParser.parseFromLexeme(segment.lexemes, 0);
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
            throw new Error(`[SqlParser] Failed to parse DROP INDEX statement ${statementIndex}: ${message}`);
        }
    }

    private static parseCreateIndexStatement(segment: StatementLexemeResult, statementIndex: number): CreateIndexStatement {
        try {
            const result = CreateIndexParser.parseFromLexeme(segment.lexemes, 0);
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
            throw new Error(`[SqlParser] Failed to parse CREATE INDEX statement ${statementIndex}: ${message}`);
        }
    }

    private static parseAlterTableStatement(segment: StatementLexemeResult, statementIndex: number): AlterTableStatement {
        try {
            const result = AlterTableParser.parseFromLexeme(segment.lexemes, 0);
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
            throw new Error(`[SqlParser] Failed to parse ALTER TABLE statement ${statementIndex}: ${message}`);
        }
    }

    private static parseDropConstraintStatement(segment: StatementLexemeResult, statementIndex: number): DropConstraintStatement {
        try {
            const result = DropConstraintParser.parseFromLexeme(segment.lexemes, 0);
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
            throw new Error(`[SqlParser] Failed to parse DROP CONSTRAINT statement ${statementIndex}: ${message}`);
        }
    }

    private static parseMergeStatement(segment: StatementLexemeResult, statementIndex: number): MergeQuery {
        try {
            const result = MergeQueryParser.parseFromLexeme(segment.lexemes, 0);

            if (result.newIndex < segment.lexemes.length) {
                // Guard against trailing tokens that would indicate parsing stopped prematurely.
                const unexpected = segment.lexemes[result.newIndex];
                const position = unexpected.position?.startPosition ?? segment.statementStart;
                throw new Error(
                    `[SqlParser] Unexpected token "${unexpected.value}" in statement ${statementIndex} at character ${position}.`
                );
            }

            return result.value;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`[SqlParser] Failed to parse MERGE statement ${statementIndex}: ${message}`);
        }
    }

    private static getCommandAfterWith(lexemes: Lexeme[]): string | null {
        try {
            const clone = this.cloneLexemeArray(lexemes);
            const withResult = WithClauseParser.parseFromLexeme(clone, 0);
            const next = lexemes[withResult.newIndex];
            return next?.value.toLowerCase() ?? null;
        } catch {
            return null;
        }
    }

    private static cloneLexemeArray(lexemes: Lexeme[]): Lexeme[] {
        return lexemes.map((lexeme) => ({
            ...lexeme,
            comments: lexeme.comments ? [...lexeme.comments] : null,
            positionedComments: lexeme.positionedComments
                ? lexeme.positionedComments.map(pc => ({ position: pc.position, comments: [...pc.comments] }))
                : undefined,
            position: lexeme.position ? { ...lexeme.position } : undefined
        }));
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




