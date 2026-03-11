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
    CreateSchemaStatement,
    DropSchemaStatement,
    AlterTableStatement,
    DropConstraintStatement,
    AnalyzeStatement,
    ExplainStatement,
    CreateSequenceStatement,
    AlterSequenceStatement,
    CommentOnStatement,
    VacuumStatement,
    ReindexStatement,
    ClusterStatement,
    CheckpointStatement
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
import { AnalyzeStatementParser } from './AnalyzeStatementParser';
import { ExplainStatementParser } from './ExplainStatementParser';
import { CreateSequenceParser, AlterSequenceParser } from './SequenceParser';
import { CreateSchemaParser } from './CreateSchemaParser';
import { DropSchemaParser } from './DropSchemaParser';
import { VacuumStatementParser } from './VacuumStatementParser';
import { ReindexStatementParser } from './ReindexStatementParser';
import { ClusterStatementParser } from './ClusterStatementParser';
import { CheckpointStatementParser } from './CheckpointStatementParser';
import { CommentOnParser } from './CommentOnParser';

export type ParsedStatement =
    | SelectQuery
    | InsertQuery
    | UpdateQuery
    | DeleteQuery
    | CreateTableQuery
    | MergeQuery
    | DropTableStatement
    | DropIndexStatement
    | DropSchemaStatement
    | CreateIndexStatement
    | CreateSchemaStatement
    | CreateSequenceStatement
    | AlterTableStatement
    | AlterSequenceStatement
    | CommentOnStatement
    | DropConstraintStatement
    | AnalyzeStatement
    | ExplainStatement
    | VacuumStatement
    | ReindexStatement
    | ClusterStatement
    | CheckpointStatement;

export interface SqlParserOptions {
    mode?: 'single' | 'multiple';
    skipEmptyStatements?: boolean;
}

export interface SqlParserManyOptions {
    skipEmptyStatements?: boolean;
}

type ParserResult<T> = {
    value: T;
    newIndex: number;
};

type LexemeParser<T> = (lexemes: Lexeme[], startIndex: number) => ParserResult<T>;

/**
 * Canonical entry point for SQL parsing.
 * Delegates to dedicated parsers for SELECT, INSERT, UPDATE, and DELETE statements, and is designed to embrace additional statement types next.
 */
export class SqlParser {
    public static parse(sql: string, options: SqlParserOptions = {}): ParsedStatement {
        const skipEmpty = options.skipEmptyStatements ?? true;
        const mode = options.mode ?? 'single';
        const tokenizer = new SqlTokenizer(sql);

        // Fast path for the common single-statement parse used by benchmarks and most callers.
        if (mode === 'single' && skipEmpty) {
            const first = this.readNextMeaningfulStatement(tokenizer, 0);
            if (!first) {
                throw new Error('[SqlParser] No SQL statements found in input.');
            }

            const parsed = this.dispatchParse(first, 1);
            const remainder = this.readNextMeaningfulStatement(tokenizer, first.nextPosition);
            if (remainder) {
                throw new Error('[SqlParser] Unexpected additional statement detected at index 2. Use parseMany or set mode to "multiple" to allow multiple statements.');
            }

            return parsed;
        }

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

        switch (firstToken) {
            case 'select':
            case 'values':
                return this.parseSelectStatement(segment, statementIndex);

            case 'with': {
                const commandAfterWith = this.getCommandAfterWith(segment.lexemes);
                switch (commandAfterWith) {
                    case 'insert into':
                        return this.parseInsertStatement(segment, statementIndex);
                    case 'update':
                        return this.parseUpdateStatement(segment, statementIndex);
                    case 'delete from':
                        return this.parseDeleteStatement(segment, statementIndex);
                    case 'merge into':
                        return this.parseMergeStatement(segment, statementIndex);
                    default:
                        return this.parseSelectStatement(segment, statementIndex);
                }
            }
            case 'insert into':
                return this.parseInsertStatement(segment, statementIndex);

            case 'update':
                return this.parseUpdateStatement(segment, statementIndex);

            case 'delete from':
                return this.parseDeleteStatement(segment, statementIndex);

            case 'create table':
            case 'create temporary table':
            case 'create unlogged table':
                return this.parseCreateTableStatement(segment, statementIndex);

            case 'merge into':
                return this.parseMergeStatement(segment, statementIndex);

            case 'create index':
            case 'create unique index':
                return this.parseCreateIndexStatement(segment, statementIndex);

            case 'create schema':
                return this.parseCreateSchemaStatement(segment, statementIndex);

            case 'create sequence':
            case 'create temporary sequence':
            case 'create temp sequence':
                return this.parseCreateSequenceStatement(segment, statementIndex);

            case 'drop table':
                return this.parseDropTableStatement(segment, statementIndex);

            case 'drop schema':
                return this.parseDropSchemaStatement(segment, statementIndex);

            case 'drop index':
                return this.parseDropIndexStatement(segment, statementIndex);

            case 'alter table':
                return this.parseAlterTableStatement(segment, statementIndex);

            case 'alter sequence':
                return this.parseAlterSequenceStatement(segment, statementIndex);

            case 'drop constraint':
                return this.parseDropConstraintStatement(segment, statementIndex);
            case 'comment on table':
            case 'comment on column':
                return this.parseCommentOnStatement(segment, statementIndex);

            case 'analyze':
                return this.parseAnalyzeStatement(segment, statementIndex);

            case 'explain':
                return this.parseExplainStatement(segment, statementIndex);

            case 'vacuum':
            case 'vacuum full':
                return this.parseVacuumStatement(segment, statementIndex);

            case 'reindex':
            case 'reindex table':
            case 'reindex index':
            case 'reindex schema':
                return this.parseReindexStatement(segment, statementIndex);

            case 'cluster':
                return this.parseClusterStatement(segment, statementIndex);

            case 'checkpoint':
                return this.parseCheckpointStatement(segment, statementIndex);

            default:
                throw new Error(`[SqlParser] Statement ${statementIndex} starts with unsupported token "${segment.lexemes[0].value}".`);
        }
    }

    private static parseSelectStatement(segment: StatementLexemeResult, statementIndex: number): SelectQuery {
        return this.parseStatementWithParser(segment, statementIndex, 'SELECT', (lexemes, startIndex) => SelectQueryParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseExplainStatement(segment: StatementLexemeResult, statementIndex: number): ExplainStatement {
        return this.parseStatementWithCallback(segment, statementIndex, 'EXPLAIN', () =>
            ExplainStatementParser.parseFromLexeme(segment.lexemes, 0, (lexemes, nestedStart) => {
                if (nestedStart >= lexemes.length) {
                    throw new Error("[ExplainStatementParser] Missing statement after EXPLAIN options.");
                }

                const nestedSegment: StatementLexemeResult = {
                    lexemes: lexemes.slice(nestedStart),
                    statementStart: segment.statementStart,
                    statementEnd: segment.statementEnd,
                    nextPosition: segment.nextPosition,
                    rawText: segment.rawText,
                    leadingComments: segment.leadingComments,
                };

                const statement = this.dispatchParse(nestedSegment, statementIndex);
                return { value: statement, newIndex: lexemes.length };
            }),
            `EXPLAIN statement ${statementIndex}`
        );
    }

    private static parseVacuumStatement(segment: StatementLexemeResult, statementIndex: number): VacuumStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'VACUUM', (lexemes, startIndex) => VacuumStatementParser.parseFromLexeme(lexemes, startIndex), `VACUUM statement ${statementIndex}`);
    }

    private static parseReindexStatement(segment: StatementLexemeResult, statementIndex: number): ReindexStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'REINDEX', (lexemes, startIndex) => ReindexStatementParser.parseFromLexeme(lexemes, startIndex), `REINDEX statement ${statementIndex}`);
    }

    private static parseClusterStatement(segment: StatementLexemeResult, statementIndex: number): ClusterStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'CLUSTER', (lexemes, startIndex) => ClusterStatementParser.parseFromLexeme(lexemes, startIndex), `CLUSTER statement ${statementIndex}`);
    }

    private static parseCheckpointStatement(segment: StatementLexemeResult, statementIndex: number): CheckpointStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'CHECKPOINT', (lexemes, startIndex) => CheckpointStatementParser.parseFromLexeme(lexemes, startIndex), `CHECKPOINT statement ${statementIndex}`);
    }

    private static parseInsertStatement(segment: StatementLexemeResult, statementIndex: number): InsertQuery {
        return this.parseStatementWithParser(segment, statementIndex, 'INSERT', (lexemes, startIndex) => InsertQueryParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseUpdateStatement(segment: StatementLexemeResult, statementIndex: number): UpdateQuery {
        return this.parseStatementWithParser(segment, statementIndex, 'UPDATE', (lexemes, startIndex) => UpdateQueryParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseDeleteStatement(segment: StatementLexemeResult, statementIndex: number): DeleteQuery {
        return this.parseStatementWithParser(segment, statementIndex, 'DELETE', (lexemes, startIndex) => DeleteQueryParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseCreateTableStatement(segment: StatementLexemeResult, statementIndex: number): CreateTableQuery {
        return this.parseStatementWithParser(segment, statementIndex, 'CREATE TABLE', (lexemes, startIndex) => CreateTableParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseDropTableStatement(segment: StatementLexemeResult, statementIndex: number): DropTableStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'DROP TABLE', (lexemes, startIndex) => DropTableParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseDropSchemaStatement(segment: StatementLexemeResult, statementIndex: number): DropSchemaStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'DROP SCHEMA', (lexemes, startIndex) => DropSchemaParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseDropIndexStatement(segment: StatementLexemeResult, statementIndex: number): DropIndexStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'DROP INDEX', (lexemes, startIndex) => DropIndexParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseCreateIndexStatement(segment: StatementLexemeResult, statementIndex: number): CreateIndexStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'CREATE INDEX', (lexemes, startIndex) => CreateIndexParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseCreateSchemaStatement(segment: StatementLexemeResult, statementIndex: number): CreateSchemaStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'CREATE SCHEMA', (lexemes, startIndex) => CreateSchemaParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseCreateSequenceStatement(segment: StatementLexemeResult, statementIndex: number): CreateSequenceStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'CREATE SEQUENCE', (lexemes, startIndex) => CreateSequenceParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseAlterSequenceStatement(segment: StatementLexemeResult, statementIndex: number): AlterSequenceStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'ALTER SEQUENCE', (lexemes, startIndex) => AlterSequenceParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseAlterTableStatement(segment: StatementLexemeResult, statementIndex: number): AlterTableStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'ALTER TABLE', (lexemes, startIndex) => AlterTableParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseDropConstraintStatement(segment: StatementLexemeResult, statementIndex: number): DropConstraintStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'DROP CONSTRAINT', (lexemes, startIndex) => DropConstraintParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseCommentOnStatement(segment: StatementLexemeResult, statementIndex: number): CommentOnStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'COMMENT ON', (lexemes, startIndex) => CommentOnParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseAnalyzeStatement(segment: StatementLexemeResult, statementIndex: number): AnalyzeStatement {
        return this.parseStatementWithParser(segment, statementIndex, 'ANALYZE', (lexemes, startIndex) => AnalyzeStatementParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseMergeStatement(segment: StatementLexemeResult, statementIndex: number): MergeQuery {
        return this.parseStatementWithParser(segment, statementIndex, 'MERGE', (lexemes, startIndex) => MergeQueryParser.parseFromLexeme(lexemes, startIndex));
    }

    private static parseStatementWithParser<T>(
        segment: StatementLexemeResult,
        statementIndex: number,
        statementLabel: string,
        parser: LexemeParser<T>,
        trailingContext = `statement ${statementIndex}`
    ): T {
        return this.parseStatementWithCallback(
            segment,
            statementIndex,
            statementLabel,
            () => parser(segment.lexemes, 0),
            trailingContext
        );
    }

    private static parseStatementWithCallback<T>(
        segment: StatementLexemeResult,
        statementIndex: number,
        statementLabel: string,
        parse: () => ParserResult<T>,
        trailingContext = `statement ${statementIndex}`
    ): T {
        try {
            const result = parse();

            // Keep trailing-token validation centralized so every statement parser reports the same shape of error.
            this.assertFullyConsumed(segment, result.newIndex, trailingContext);
            return result.value;
        } catch (error) {
            throw new Error(`[SqlParser] Failed to parse ${statementLabel} statement ${statementIndex}: ${this.errorMessage(error)}`);
        }
    }

    private static assertFullyConsumed(
        segment: StatementLexemeResult,
        newIndex: number,
        trailingContext: string
    ): void {
        if (newIndex >= segment.lexemes.length) {
            return;
        }

        const unexpected = segment.lexemes[newIndex];
        const position = unexpected.position?.startPosition ?? segment.statementStart;
        throw new Error(
            `[SqlParser] Unexpected token "${unexpected.value}" in ${trailingContext} at character ${position}.`
        );
    }

    private static errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    private static getCommandAfterWith(lexemes: Lexeme[]): string | null {
        try {
            const withResult = WithClauseParser.parseFromLexeme(lexemes, 0);
            const next = lexemes[withResult.newIndex];
            return next?.value.toLowerCase() ?? null;
        } catch {
            return null;
        }
    }

    private static readNextMeaningfulStatement(tokenizer: SqlTokenizer, cursor: number): StatementLexemeResult | null {
        let localCursor = cursor;
        let carry: string[] | null = null;

        while (true) {
            const segment = tokenizer.readNextStatement(localCursor, carry);
            carry = null;

            if (!segment) {
                return null;
            }

            if (segment.lexemes.length > 0) {
                return segment;
            }

            localCursor = segment.nextPosition;
            if (segment.leadingComments && segment.leadingComments.length > 0) {
                carry = segment.leadingComments;
            }
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


