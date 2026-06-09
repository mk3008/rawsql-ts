import { GroupByClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ValueComponent } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class GroupByClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): GroupByClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The GROUP BY clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: GroupByClause; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'group by') {
            throw new Error(`Syntax error at position ${idx}: Expected 'GROUP BY' keyword but found "${lexemes[idx].value}". GROUP BY clauses must start with the GROUP BY keywords.`);
        }
        idx++;

        let mode: "all" | "distinct" | null = null;
        if (lexemes[idx]?.value === "all" || lexemes[idx]?.value === "distinct") {
            mode = lexemes[idx].value as "all" | "distinct";
            idx++;
        }

        if (idx >= lexemes.length) {
            if (mode === "all") {
                return { value: new GroupByClause([], mode), newIndex: idx };
            }
            throw new Error(`Syntax error: Unexpected end of input after 'GROUP BY' keyword. The GROUP BY clause requires at least one expression to group by.`);
        }

        const items: ValueComponent[] = [];
        if (!this.isClauseBoundary(lexemes[idx])) {
            const item = this.parseItem(lexemes, idx);
            items.push(item.value);
            idx = item.newIndex;

            while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
                idx++;
                const item = this.parseItem(lexemes, idx);
                items.push(item.value);
                idx = item.newIndex;
            }
        }

        if (items.length === 0 && mode !== "all") {
            throw new Error(`Syntax error at position ${index}: No grouping expressions found. The GROUP BY clause requires at least one expression to group by.`);
        } else {
            const clause = new GroupByClause(items, mode);
            return { value: clause, newIndex: idx };
        }
    }

    private static isClauseBoundary(lexeme: Lexeme): boolean {
        return [
            "having",
            "window",
            "order by",
            "limit",
            "offset",
            "fetch",
            "for",
        ].includes(lexeme.value);
    }

    private static parseItem(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        const parsedValue = ValueParser.parseFromLexeme(lexemes, idx);
        const value = parsedValue.value;
        idx = parsedValue.newIndex;
        return { value, newIndex: idx };
    }
}
