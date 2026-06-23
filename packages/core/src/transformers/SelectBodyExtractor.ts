import { CreateTableQuery } from "../models/CreateTableQuery";
import { InsertQuery } from "../models/InsertQuery";
import { TokenType } from "../models/Lexeme";
import { SelectQuery } from "../models/SelectQuery";
import { SqlComponent } from "../models/SqlComponent";
import { ValuesQuery } from "../models/ValuesQuery";
import { TableSource } from "../models/Clause";
import { FullNameParser } from "../parsers/FullNameParser";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { SqlParser, ParsedStatement } from "../parsers/SqlParser";
import { SqlTokenizer } from "../parsers/SqlTokenizer";

export type SelectBodyWrapperKind =
    | "create-table-as"
    | "create-view"
    | "create-materialized-view"
    | "insert-select";

export interface SelectBodyExtractionResult {
    supported: boolean;
    kind: SelectBodyWrapperKind | null;
    targetName: string | null;
    selectQuery: SelectQuery | null;
    reason?: string;
}

export class SelectBodyExtractor {
    public static extract(input: string | SqlComponent): SelectBodyExtractionResult {
        if (typeof input === "string") {
            return this.extractFromSql(input);
        }

        return this.extractFromStatement(input);
    }

    private static extractFromSql(sql: string): SelectBodyExtractionResult {
        const lexemes = new SqlTokenizer(sql).readLexemes();
        if (this.isCreateViewStatement(lexemes)) {
            return this.extractCreateViewFromLexemes(lexemes);
        }

        return this.extractFromStatement(SqlParser.parse(sql));
    }

    private static extractFromStatement(statement: SqlComponent | ParsedStatement): SelectBodyExtractionResult {
        if (statement instanceof CreateTableQuery) {
            const targetName = this.createTableTargetName(statement);
            if (!statement.asSelectQuery) {
                return this.unsupported(targetName);
            }

            return {
                supported: true,
                kind: "create-table-as",
                targetName,
                selectQuery: statement.asSelectQuery
            };
        }

        if (statement instanceof InsertQuery) {
            const targetName = this.insertTargetName(statement);
            if (!statement.selectQuery || statement.selectQuery instanceof ValuesQuery) {
                return this.unsupported(targetName);
            }

            return {
                supported: true,
                kind: "insert-select",
                targetName,
                selectQuery: statement.selectQuery
            };
        }

        return {
            supported: false,
            kind: null,
            targetName: null,
            selectQuery: null,
            reason: "Statement type is not supported."
        };
    }

    private static extractCreateViewFromLexemes(lexemes: ReturnType<SqlTokenizer["readLexemes"]>): SelectBodyExtractionResult {
        let idx = 0;
        idx++; // CREATE

        const materialized = lexemes[idx]?.value.toLowerCase() === "materialized";
        if (materialized) {
            idx++;
        }

        if (lexemes[idx]?.value.toLowerCase() !== "view") {
            return this.unsupported(null, "Statement type is not supported.");
        }
        idx++;

        if (lexemes[idx]?.value.toLowerCase() === "if not exists") {
            idx++;
        }

        const targetResult = FullNameParser.parseFromLexeme(lexemes, idx);
        idx = targetResult.newIndex;
        const targetName = [...(targetResult.namespaces ?? []), targetResult.name.name].join(".");

        if (lexemes[idx]?.type === TokenType.OpenParen) {
            idx = this.consumeBalancedParentheses(lexemes, idx);
        }

        if (lexemes[idx]?.value.toLowerCase() !== "as") {
            return this.unsupported(targetName);
        }
        idx++;

        const selectResult = SelectQueryParser.parseFromLexeme(lexemes, idx);
        return {
            supported: true,
            kind: materialized ? "create-materialized-view" : "create-view",
            targetName,
            selectQuery: selectResult.value
        };
    }

    private static isCreateViewStatement(lexemes: ReturnType<SqlTokenizer["readLexemes"]>): boolean {
        if (lexemes[0]?.value.toLowerCase() !== "create") {
            return false;
        }

        const second = lexemes[1]?.value.toLowerCase();
        const third = lexemes[2]?.value.toLowerCase();
        return second === "view" || (second === "materialized" && third === "view");
    }

    private static consumeBalancedParentheses(lexemes: ReturnType<SqlTokenizer["readLexemes"]>, index: number): number {
        let idx = index;
        let depth = 0;
        while (idx < lexemes.length) {
            if (lexemes[idx].type === TokenType.OpenParen) {
                depth++;
            } else if (lexemes[idx].type === TokenType.CloseParen) {
                depth--;
                if (depth === 0) {
                    return idx + 1;
                }
            }
            idx++;
        }
        return idx;
    }

    private static createTableTargetName(query: CreateTableQuery): string {
        return [...(query.namespaces ?? []), query.tableName.name].join(".");
    }

    private static insertTargetName(query: InsertQuery): string | null {
        const source = query.insertClause.source;
        if (source.datasource instanceof TableSource) {
            return source.datasource.getSourceName();
        }
        return source.getAliasName();
    }

    private static unsupported(targetName: string | null, reason: string = "No embedded SELECT body found."): SelectBodyExtractionResult {
        return {
            supported: false,
            kind: null,
            targetName,
            selectQuery: null,
            reason
        };
    }
}
