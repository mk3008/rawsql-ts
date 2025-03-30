import { OrderByClause, PartitionByClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { IdentifierString, OverExpression as OverExpression, WindowFrameExpression } from "../models/ValueComponent";
import { OrderByClauseParser } from "./OrderByClauseParser";
import { PartitionByParser } from "./PartitionByParser";
import { SqlTokenizer } from "./SqlTokenizer";

export class OverExpressionParser {
    public static parseFromText(query: string): OverExpression {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parse(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The OVER expression is complete but there are additional tokens.`);
        }

        return result.value;
    }

    public static parse(lexemes: Lexeme[], index: number): { value: OverExpression; newIndex: number } {
        let idx = index;

        if (lexemes[idx].value !== 'over') {
            throw new Error(`Syntax error at position ${idx}: Expected 'OVER' keyword but found "${lexemes[idx].value}". OVER expressions must start with the OVER keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'OVER' keyword. Expected either a window name or an opening parenthesis '('.`);
        }

        if (lexemes[idx].type === TokenType.Identifier) {
            // named window frame
            const name = lexemes[idx].value;
            idx++;
            return { value: new IdentifierString(name), newIndex: idx };
        }

        if (lexemes[idx].type === TokenType.OpenParen) {
            idx++;

            let partition: PartitionByClause | null = null;
            let order: OrderByClause | null = null;
            if (idx < lexemes.length && lexemes[idx].value === 'partition by') {
                const partitionResult = PartitionByParser.parse(lexemes, idx);
                partition = partitionResult.value;
                idx = partitionResult.newIndex;
            }
            if (idx < lexemes.length && lexemes[idx].value === 'order by') {
                const orderResult = OrderByClauseParser.parse(lexemes, idx);
                order = orderResult.value;
                idx = orderResult.newIndex;
            }
            if (idx >= lexemes.length || lexemes[idx].type !== TokenType.CloseParen) {
                throw new Error(`Syntax error at position ${idx}: Missing closing parenthesis ')' for OVER clause. Each opening parenthesis must have a matching closing parenthesis.`);
            }
            // read close paren
            idx++;
            return { value: new WindowFrameExpression(partition, order), newIndex: idx };
        }

        throw new Error(`Syntax error at position ${idx}: Expected a window name or opening parenthesis '(' after OVER keyword, but found "${lexemes[idx].value}".`);
    }
}
