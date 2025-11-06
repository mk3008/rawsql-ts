import { SqlTokenizer } from "./SqlTokenizer";
import { AnalyzeStatement } from "../models/DDLStatements";
import { Lexeme, TokenType } from "../models/Lexeme";
import { FullNameParser } from "./FullNameParser";
import { QualifiedName, IdentifierString } from "../models/ValueComponent";

/**
 * Parses ANALYZE statements.
 */
export class AnalyzeStatementParser {
    public static parse(sql: string): AnalyzeStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`[AnalyzeStatementParser] Unexpected token "${lexemes[result.newIndex].value}" after ANALYZE statement.`);
        }
        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: AnalyzeStatement; newIndex: number } {
        let idx = index;

        if (lexemes[idx]?.value.toLowerCase() !== "analyze") {
            throw new Error(`[AnalyzeStatementParser] Expected ANALYZE at index ${idx}.`);
        }
        idx++;

        // Capture optional VERBOSE modifier immediately after ANALYZE.
        let verbose = false;
        if (lexemes[idx]?.value.toLowerCase() === "verbose") {
            verbose = true;
            idx++;
        }

        // Parse optional target relation name if present.
        let target: QualifiedName | null = null;
        if (this.canStartQualifiedName(lexemes[idx])) {
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            target = new QualifiedName(namespaces, name);
            idx = newIndex;
        }

        // Parse optional column list guarded by parentheses.
        let columns: IdentifierString[] | null = null;
        if (lexemes[idx]?.type & TokenType.OpenParen) {
            if (!target) {
                throw new Error("[AnalyzeStatementParser] Column list requires a target relation before '('.");
            }

            idx++; // consume '('
            columns = [];

            // Loop through comma-separated column identifiers until closing parenthesis.
            while (idx < lexemes.length) {
                if (lexemes[idx].type & TokenType.CloseParen) {
                    if (columns.length === 0) {
                        throw new Error("[AnalyzeStatementParser] Column list must include at least one column identifier.");
                    }
                    idx++; // consume ')'
                    break;
                }

                const { name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
                columns.push(name);
                idx = newIndex;

                if (lexemes[idx]?.type & TokenType.Comma) {
                    idx++;
                    continue;
                }

                if (lexemes[idx]?.type & TokenType.CloseParen) {
                    idx++; // consume ')'
                    break;
                }

                throw new Error(`[AnalyzeStatementParser] Expected ',' or ')' after column identifier at index ${idx}.`);
            }

            if (columns === null || columns.length === 0) {
                throw new Error("[AnalyzeStatementParser] Column list cannot be empty.");
            }
        }

        // Reject trailing identifiers when no target was provided.
        if (!target && lexemes[idx] && !(lexemes[idx].type & TokenType.CloseParen)) {
            throw new Error(`[AnalyzeStatementParser] Unexpected token "${lexemes[idx].value}" after ANALYZE clause.`);
        }

        const statement = new AnalyzeStatement({ verbose, target, columns });
        return { value: statement, newIndex: idx };
    }

    private static canStartQualifiedName(lexeme: Lexeme | undefined): boolean {
        if (!lexeme) {
            return false;
        }

        if (lexeme.type & (TokenType.Identifier | TokenType.Command | TokenType.Function | TokenType.Type)) {
            return true;
        }

        return (lexeme.type & TokenType.OpenBracket) !== 0;
    }
}
