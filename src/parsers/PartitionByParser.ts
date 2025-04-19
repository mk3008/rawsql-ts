import { PartitionByClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ValueComponent, ValueList } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class PartitionByParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): PartitionByClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The PARTITION BY clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: PartitionByClause; newIndex: number } {
        let idx = index;
        if (lexemes[idx].value !== 'partition by') {
            throw new Error(`Syntax error at position ${idx}: Expected 'PARTITION BY' keyword but found "${lexemes[idx].value}". PARTITION BY clauses must start with the PARTITION BY keywords.`);
        }
        idx++;
        const items: ValueComponent[] = [];
        const item = ValueParser.parseFromLexeme(lexemes, idx);
        items.push(item.value);
        idx = item.newIndex;
        while (idx < lexemes.length && lexemes[idx].type === TokenType.Comma) {
            idx++;
            const item = ValueParser.parseFromLexeme(lexemes, idx);
            items.push(item.value);
            idx = item.newIndex;
        }
        if (items.length === 0) {
            throw new Error(`Syntax error at position ${index}: No partition expressions found. The PARTITION BY clause requires at least one expression to partition by.`);
        } else if (items.length === 1) {
            const clause = new PartitionByClause(items[0]);
            return { value: clause, newIndex: idx };
        } else {
            const clause = new PartitionByClause(new ValueList(items));
            return { value: clause, newIndex: idx };
        }
    }
}
