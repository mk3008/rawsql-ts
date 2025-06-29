import { CommonTable, WithClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { CommonTableParser } from "./CommonTableParser";

export class WithClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): WithClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The WITH clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: WithClause; newIndex: number } {
        let idx = index;

        // Expect WITH keyword
        if (idx < lexemes.length && lexemes[idx].value.toLowerCase() === "with") {
            idx++;
        } else {
            throw new Error(`Syntax error at position ${idx}: Expected WITH keyword.`);
        }

        // Check for RECURSIVE keyword
        const recursive = idx < lexemes.length && lexemes[idx].value.toLowerCase() === "recursive";
        if (recursive) {
            idx++;
        }

        // Parse CTEs
        const tables: CommonTable[] = [];

        // Parse first CTE (required)
        const firstCte = CommonTableParser.parseFromLexeme(lexemes, idx);
        tables.push(firstCte.value);
        idx = firstCte.newIndex;

        // Parse additional CTEs (optional)
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++; // Skip comma
            const cteResult = CommonTableParser.parseFromLexeme(lexemes, idx);
            tables.push(cteResult.value);
            idx = cteResult.newIndex;
        }

        // Create WITH clause
        return {
            value: new WithClause(recursive, tables),
            newIndex: idx
        };
    }
}