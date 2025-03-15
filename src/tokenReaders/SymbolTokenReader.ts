import { BaseTokenReader } from './BaseTokenReader';
import { TokenType } from '../enums/tokenType';
import { Lexeme } from '../models/Lexeme';

/**
 * Reads SQL symbol tokens (., ,, (, ))
 */
export class SymbolTokenReader extends BaseTokenReader {
    private static readonly SYMBOL_TOKENS: Record<string, TokenType> = {
        '.': TokenType.Dot,
        ',': TokenType.Comma,
        '(': TokenType.OpenParen,
        ')': TokenType.CloseParen,
    };

    /**
     * Try to read a symbol token
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const char = this.input[this.position];
        
        // symbol tokens
        if (char in SymbolTokenReader.SYMBOL_TOKENS) {
            this.position++;
            return this.createLexeme(
                SymbolTokenReader.SYMBOL_TOKENS[char],
                char,
                char.toLowerCase()
            );
        }
        return null;
    }
}
