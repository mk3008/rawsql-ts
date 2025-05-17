import { Lexeme, TokenType } from "../models/Lexeme";

export class ParseError extends Error {
    constructor(message: string, public index: number, public context: string) {
        super(message);
        this.name = "ParseError";
    }

    public static fromUnparsedLexemes(lexemes: Lexeme[], index: number, messagePrefix: string): ParseError {
        const start = Math.max(0, index - 2);
        const end = Math.min(lexemes.length, index + 3);
        const context = lexemes.slice(start, end).map((lexeme, idx) => {
            const marker = idx + start === index ? '>' : ' ';
            const typeName = TokenType[lexeme.type] || lexeme.type; // Convert type to name if possible
            return `${marker} ${idx + start}:${lexeme.value} [${typeName}]`;
        }).join('\n');

        const message = `${messagePrefix} Unparsed lexeme remains at index ${index}: ${lexemes[index].value}\nContext:\n${context}`;
        return new ParseError(message, index, context);
    }
}
