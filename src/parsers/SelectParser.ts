import { SelectClause, SelectComponent, SelectItem, SelectList } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference } from "../models/ValueComponent";
import { SqlTokenizer } from "./sqlTokenizer";
import { ValueParser } from "./ValueParser";

export class SelectClauseParser {
    public static ParseFromText(query: string): SelectClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.Parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newPosition < lexemes.length) {
            throw new Error(`Unexpected token at position ${result.newPosition}: ${lexemes[result.newPosition].value}`);
        }

        return result.value;
    }

    private static Parse(lexemes: Lexeme[], position: number): { value: SelectClause; newPosition: number } {
        let p = position;

        if (lexemes[p].value !== 'select') {
            throw new Error(`Expected 'SELECT' at position ${p}`);
        }
        p++;

        const items: SelectItem[] = [];

        while (p < lexemes.length && lexemes[p].type !== TokenType.Command) {
            const item = this.ParseItem(lexemes, p);
            items.push(item.value);
            p = item.newPosition;

            if (p < lexemes.length && lexemes[p].type === TokenType.Comma) {
                p++;
            } else {
                break;
            }
        }

        if (items.length === 0) {
            throw new Error(`No select items found at position ${position}`);
        } else if (items.length === 1) {
            const clause = new SelectClause(items[0]);
            return { value: clause, newPosition: p };
        } else {
            const clause = new SelectClause(new SelectList(items));
            return { value: clause, newPosition: p };
        }
    }

    private static ParseItem(lexemes: Lexeme[], position: number): { value: SelectItem; newPosition: number } {
        let p = position;
        const comment = lexemes[p].comments;

        const value = ValueParser.Parse(lexemes, p);
        p = value.newPosition;

        if (p < lexemes.length && lexemes[p].value === 'as') {
            p++;
        }

        const defaultName = value instanceof ColumnReference
            ? (value as unknown as ColumnReference).column.name
            : null;

        if (p < lexemes.length && lexemes[p].type === TokenType.Identifier) {
            const alias = lexemes[p].value;
            p++;
            return {
                value: new SelectItem(value.value, alias),
                newPosition: p,
            };
        } else if (defaultName) {
            return {
                value: new SelectItem(value.value, defaultName),
                newPosition: p,
            };
        }

        throw new Error(`Column name not found at position ${position}`);
    }
}