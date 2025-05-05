import { FetchClause, FetchType, FetchUnit, FetchExpression } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { LiteralValue, ValueComponent } from "../models/ValueComponent";
import { ValueParser } from "./ValueParser";

export class FetchClauseParser {
    /**
     * Parses a FETCH clause from a lexeme array starting at the given index.
     * Supports syntax like: FETCH [FIRST|NEXT] <count> ROWS ONLY
     * @param lexemes The array of lexemes
     * @param index The starting index
     * @returns { value: FetchSpecification, newIndex: number }
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: FetchClause; newIndex: number } {
        let idx = index;
        if (lexemes[idx].value !== 'fetch') {
            throw new Error(`Syntax error at position ${idx}: Expected 'FETCH' keyword but found "${lexemes[idx].value}".`);
        }
        idx++;
        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'FETCH' keyword.`);
        }

        const fetchExprResult = FetchExpressionParser.parseFromLexeme(lexemes, idx);
        const fetchExpr = fetchExprResult.value;
        idx = fetchExprResult.newIndex;

        return { value: new FetchClause(fetchExpr), newIndex: idx };
    }
}

// FetchExpressionParser: parses FETCH [FIRST|NEXT] <count> ROWS ONLY ...
export class FetchExpressionParser {
    /**
     * Parses a FETCH expression (not the whole clause, just the fetch part)
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: FetchExpression; newIndex: number } {
        let idx = index;
        let type: FetchType;
        const typeToken = lexemes[idx].value;
        if (typeToken === 'first') {
            type = FetchType.First;
        } else if (typeToken === 'next') {
            type = FetchType.Next;
        } else {
            throw new Error(`Syntax error at position ${idx}: Expected 'FIRST' or 'NEXT' after 'FETCH' but found "${lexemes[idx].value}".`);
        }
        idx++;
        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'FETCH FIRST|NEXT'.`);
        }

        let count: ValueComponent | null = null;
        let unit: FetchUnit | null = null;

        // Omitted count notation
        if (lexemes[idx].value === 'row only' || lexemes[idx].value === 'rows only') {
            count = new LiteralValue(1);
            unit = FetchUnit.RowsOnly;
            idx++;
            return { value: new FetchExpression(type, count, unit), newIndex: idx };
        }

        // <count>
        const countResult = ValueParser.parseFromLexeme(lexemes, idx);
        count = countResult.value;
        idx = countResult.newIndex;
        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'FETCH FIRST|NEXT <count>'.`);
        }
        // ROWS ONLY (or other unit)

        if (lexemes[idx].value === 'rows only') {
            unit = FetchUnit.RowsOnly;
            idx++;
        } else if (lexemes[idx].value === 'percent') {
            unit = FetchUnit.Percent;
            idx++;
        } else if (lexemes[idx].value === 'percent with ties') {
            unit = FetchUnit.PercentWithTies;
            idx++;
        }
        if (!unit) {
            throw new Error(`Syntax error: Expected 'ROWS ONLY', 'PERCENT', or 'PERCENT WITH TIES' after 'FETCH FIRST|NEXT <count>'.`);
        }
        return { value: new FetchExpression(type, count, unit), newIndex: idx };
    }
}
